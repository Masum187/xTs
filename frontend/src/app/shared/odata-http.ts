// OData-Adapter (Audit Nr. 13, Entscheidung 17: SAP OData V2 auf ECC).
// Einzige Stelle, die Antwortformen kennt:
// - Mock-API / OData V4-nah: Listen `{ value: [...] }`, Einzelobjekte direkt,
//   Folgeseite `@odata.nextLink`.
// - SAP Gateway OData V2: Listen `{ d: { results: [...], __next, __count } }`,
//   Einzelobjekte `{ d: {...} }`.
// Feldwerte (Decimal, Datum, Uhrzeit) wandeln die Decoder (`decode.ts`),
// Fehler-Bodies `api-error.ts`.

import { ApiError, apiErrorFrom } from "./api-error";
import { DecodeError, isObject, type Decoder } from "./decode";

export interface ODataPage {
  items: unknown[];
  nextLink: string | null;
  count: number | null;
}

export type QueryParams = Record<string, string | number | null | undefined>;

/** Obergrenze fuer servergesteuerte Folgeseiten je Liste. */
export const MAX_PAGES = 100;

export function unwrapCollection(body: unknown): ODataPage {
  if (isObject(body) && Array.isArray(body["value"])) {
    return {
      items: body["value"],
      nextLink: optionalString(body["@odata.nextLink"]),
      count: optionalCount(body["@odata.count"]),
    };
  }
  const d = isObject(body) ? body["d"] : undefined;
  if (isObject(d) && Array.isArray(d["results"])) {
    return {
      items: d["results"],
      nextLink: optionalString(d["__next"]),
      count: optionalCount(d["__count"]),
    };
  }
  throw new DecodeError("", "OData-Liste (value oder d.results)", body);
}

export function unwrapEntity(body: unknown): unknown {
  const d = isObject(body) ? body["d"] : undefined;
  return isObject(d) ? d : body;
}

/** Baut den Query-String; leere Werte entfallen. */
export function buildQuery(params?: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function optionalCount(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

/** Transportschicht ohne Angular-DI, damit sie ohne TestBed testbar ist. */
export class ODataHttp {
  constructor(
    private readonly baseUrl: string,
    private readonly headers: () => Record<string, string>,
  ) {}

  /**
   * Liest eine Liste vollstaendig und folgt Folgeseiten (`__next`/`nextLink`).
   * Wechselt waehrenddessen die Identitaet (Audit Nr. 12), bricht das
   * Nachladen ab, statt Seiten mit einer anderen Identitaet zu holen.
   */
  async list<T>(
    path: string,
    decoder: Decoder<T>,
    params?: QueryParams,
  ): Promise<T[]> {
    const items: T[] = [];
    const identity = JSON.stringify(this.headers());
    let url: string | null = `${this.baseUrl}/${path}${buildQuery(params)}`;
    for (let page = 0; url; page += 1) {
      if (page >= MAX_PAGES) {
        throw new ApiError(
          200,
          "TOO_MANY_PAGES",
          `Die Liste ${path} liefert mehr als ${MAX_PAGES} Seiten.`,
        );
      }
      if (page > 0 && JSON.stringify(this.headers()) !== identity) {
        throw new ApiError(
          0,
          "IDENTITY_CHANGED",
          `Das Laden von ${path} wurde durch einen Identitaetswechsel abgebrochen.`,
        );
      }
      const body = await this.request(url, { method: "GET" });
      const collection = this.decodeWith(path, () => unwrapCollection(body));
      items.push(
        ...this.decodeWith(path, () =>
          collection.items.map((item, index) => decoder(item, `[${index}]`)),
        ),
      );
      url = collection.nextLink
        ? this.resolveNextLink(path, collection.nextLink)
        : null;
    }
    return items;
  }

  /**
   * Folge-URLs muessen im eigenen OData-Service-Root liegen (gleiche Origin,
   * gleicher Pfadanfang); sonst wuerden Auth-/Persona-Header an eine fremde
   * Adresse gehen.
   */
  private resolveNextLink(path: string, nextLink: string): string {
    const root = new URL(`${this.baseUrl}/`);
    let next: URL;
    try {
      next = new URL(nextLink, root);
    } catch {
      throw this.invalidNextLink(path, nextLink);
    }
    if (
      next.origin !== root.origin ||
      !next.pathname.startsWith(root.pathname)
    ) {
      throw this.invalidNextLink(path, nextLink);
    }
    return next.toString();
  }

  private invalidNextLink(path: string, nextLink: string): ApiError {
    return new ApiError(
      200,
      "INVALID_NEXT_LINK",
      `Die Folgeseite von ${path} liegt ausserhalb des OData-Dienstes.`,
      { nextLink },
    );
  }

  async get<T>(
    path: string,
    decoder: Decoder<T>,
    params?: QueryParams,
  ): Promise<T> {
    const body = await this.request(
      `${this.baseUrl}/${path}${buildQuery(params)}`,
      { method: "GET" },
    );
    return this.decodeWith(path, () => decoder(unwrapEntity(body), ""));
  }

  async post<T>(
    path: string,
    payload: unknown,
    decoder: Decoder<T>,
  ): Promise<T> {
    const body = await this.request(`${this.baseUrl}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return this.decodeWith(path, () => decoder(unwrapEntity(body), ""));
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
        ...this.headers(),
      },
    });
    if (!response.ok) throw await apiErrorFrom(response);
    try {
      return await response.json();
    } catch {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "Die Antwort des Servers ist kein gueltiges JSON.",
      );
    }
  }

  private decodeWith<T>(path: string, work: () => T): T {
    try {
      return work();
    } catch (error) {
      if (error instanceof DecodeError) {
        throw new ApiError(
          200,
          "INVALID_RESPONSE",
          `Unerwartetes Antwortformat von ${path}: ${error.message}`,
          { path, expected: error.expected },
        );
      }
      throw error;
    }
  }
}
