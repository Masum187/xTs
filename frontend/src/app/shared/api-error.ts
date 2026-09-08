// Gemeinsame Fehlerbehandlung fuer Mock-API- und SAP-OData-Antworten
// (XTS-081, Audit Nr. 13): der technische Code bleibt fuer Logik und Tests,
// die vom Server gelieferte fachliche Meldung geht 1:1 an den Anwender.
//
// Zwei Fehlerformen werden verstanden:
// - Mock-API: `{ error: "CODE", message, ...details }`
// - OData V2 (SAP Gateway): `{ error: { code, message: { lang, value },
//   innererror: { ...details } } }`

import { isObject } from "./decode";

export interface ErrorInfo {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Betroffene Felder (`fields`) bzw. erlaubte Werte (`allowed`). */
  get fields(): string[] {
    return stringList(this.details["fields"] ?? this.details["allowed"]);
  }

  get conflictId(): string | undefined {
    const value = this.details["conflictId"];
    return typeof value === "string" ? value : undefined;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function fallbackMessage(status: number): string {
  return `Die Anfrage ist fehlgeschlagen (HTTP ${status}).`;
}

/** Liest Code, Meldung und Zusatzangaben aus einem Fehler-Body beider Formen. */
export function parseErrorBody(body: unknown, status: number): ErrorInfo {
  if (!isObject(body)) {
    return { code: "UNKNOWN", message: fallbackMessage(status), details: {} };
  }
  const { error, message, ...rest } = body;
  if (typeof error === "string") {
    return {
      code: error,
      message: typeof message === "string" ? message : fallbackMessage(status),
      details: rest,
    };
  }
  if (isObject(error)) {
    const inner = error["innererror"];
    const text = isObject(error["message"])
      ? error["message"]["value"]
      : error["message"];
    return {
      code: typeof error["code"] === "string" ? error["code"] : "UNKNOWN",
      message: typeof text === "string" ? text : fallbackMessage(status),
      details: isObject(inner) ? inner : {},
    };
  }
  return { code: "UNKNOWN", message: fallbackMessage(status), details: rest };
}

/** Baut den `ApiError` aus einer nicht erfolgreichen Antwort. */
export async function apiErrorFrom(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const info = parseErrorBody(body, response.status);
  return new ApiError(response.status, info.code, info.message, info.details);
}

export function describeApiError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
