// Laufzeitvalidierung fuer OData-Antworten (Audit Nr. 13, Entscheidung 17):
// Antworten werden nicht mehr per `as T` uebernommen, sondern Feld fuer Feld
// geprueft und in die App-Typen ueberfuehrt. Die Decoder nehmen die Formen
// der Mock-API (JSON-Zahlen, ISO-Datum, `HH:MM`) und von SAP Gateway OData V2
// (`Edm.Decimal` als String, `/Date(ms)/`, `Edm.Time` als `PT08H30M00S`)
// gleichermassen an und liefern immer die App-Form.

export type Decoder<T> = (input: unknown, path: string) => T;

/** Ein Decoder je Feld eines Modells; optionale Felder bleiben optional. */
export type Shape<T> = { [K in keyof T]-?: Decoder<T[K]> };

export class DecodeError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
    readonly actual: unknown,
  ) {
    super(
      `${path || "$"}: erwartet ${expected}, erhalten ${describeValue(actual)}`,
    );
    this.name = "DecodeError";
  }
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "nichts";
  if (Array.isArray(value)) return "Liste";
  if (typeof value === "string") {
    return `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  }
  return typeof value === "object" ? "Objekt" : String(value);
}

function childPath(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

export function decode<T>(decoder: Decoder<T>, input: unknown): T {
  return decoder(input, "");
}

const string: Decoder<string> = (input, path) => {
  if (typeof input === "string") return input;
  throw new DecodeError(path, "Text", input);
};

/** Text, bei dem `null` oder ein fehlendes Feld als leerer Text gilt. */
const text: Decoder<string> = (input, path) => {
  if (input === null || input === undefined) return "";
  return string(input, path);
};

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Zahl als JSON-Zahl oder als Dezimal-String (`Edm.Decimal`, z. B. "8.500"). */
const number: Decoder<number> = (input, path) => {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && DECIMAL.test(input.trim())) {
    return Number(input.trim());
  }
  throw new DecodeError(path, "Zahl", input);
};

const integer: Decoder<number> = (input, path) => {
  const value = number(input, path);
  if (Number.isInteger(value)) return value;
  throw new DecodeError(path, "ganze Zahl", input);
};

const boolean: Decoder<boolean> = (input, path) => {
  if (typeof input === "boolean") return input;
  throw new DecodeError(path, "Wahrheitswert", input);
};

const ODATA_DATE = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:$|T)/;

/** Kalendertag als `JJJJ-MM-TT`; nimmt ISO-Datum/-Zeitstempel und `/Date(ms)/`. */
const date: Decoder<string> = (input, path) => {
  if (typeof input === "string") {
    const odata = ODATA_DATE.exec(input);
    if (odata) return new Date(Number(odata[1])).toISOString().slice(0, 10);
    if (ISO_DATE.test(input)) return input.slice(0, 10);
  }
  throw new DecodeError(path, "Datum", input);
};

/** Zeitstempel als ISO-8601-Text; nimmt ISO-Text und `/Date(ms)/`. */
const dateTime: Decoder<string> = (input, path) => {
  if (typeof input === "string") {
    const odata = ODATA_DATE.exec(input);
    if (odata) return new Date(Number(odata[1])).toISOString();
    if (ISO_DATE.test(input)) return input;
  }
  throw new DecodeError(path, "Zeitstempel", input);
};

const CLOCK = /^(\d{2}):(\d{2})(?::\d{2})?$/;
const DURATION = /^PT(?:(\d{1,2})H)?(?:(\d{1,2})M)?(?:(\d{1,2})S)?$/;

/** Uhrzeit als `HH:MM`; nimmt `HH:MM`, `HH:MM:SS` und `Edm.Time` (`PT08H30M00S`). */
const time: Decoder<string> = (input, path) => {
  if (typeof input === "string") {
    const clock = CLOCK.exec(input);
    if (clock) return `${clock[1]}:${clock[2]}`;
    const duration = DURATION.exec(input);
    if (duration) {
      const hours = String(duration[1] ?? "0").padStart(2, "0");
      const minutes = String(duration[2] ?? "0").padStart(2, "0");
      return `${hours}:${minutes}`;
    }
  }
  throw new DecodeError(path, "Uhrzeit", input);
};

function literal<T extends string | number>(
  ...values: readonly T[]
): Decoder<T> {
  return (input, path) => {
    if ((values as readonly unknown[]).includes(input)) return input as T;
    throw new DecodeError(path, values.map(String).join(" | "), input);
  };
}

function nullable<T>(decoder: Decoder<T>): Decoder<T | null> {
  return (input, path) => (input === null ? null : decoder(input, path));
}

/** Fehlendes Feld oder `null` ergibt `undefined` (optionales Modellfeld). */
function optional<T>(decoder: Decoder<T>): Decoder<T | undefined> {
  return (input, path) =>
    input === undefined || input === null ? undefined : decoder(input, path);
}

/** Fehlendes Feld ergibt den Vorgabewert (z. B. bei rollenreduzierten Saetzen). */
function fallback<T>(decoder: Decoder<T>, value: T): Decoder<T> {
  return (input, path) => (input === undefined ? value : decoder(input, path));
}

function array<T>(decoder: Decoder<T>): Decoder<T[]> {
  return (input, path) => {
    if (!Array.isArray(input)) throw new DecodeError(path, "Liste", input);
    return input.map((item, index) => decoder(item, childPath(path, index)));
  };
}

function record<T>(decoder: Decoder<T>): Decoder<Record<string, T>> {
  return (input, path) => {
    if (!isObject(input)) throw new DecodeError(path, "Objekt", input);
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key.startsWith("__")) continue;
      result[key] = decoder(value, childPath(path, key));
    }
    return result;
  };
}

const unknown: Decoder<unknown> = (input) => input;

/** Objekt nach Modellform; unbekannte Felder (z. B. `__metadata`) entfallen. */
function object<T extends object>(shape: Shape<T>): Decoder<T> {
  return (input, path) => {
    if (!isObject(input)) throw new DecodeError(path, "Objekt", input);
    const result: Partial<T> = {};
    for (const key of Object.keys(shape) as (keyof T & string)[]) {
      const value = shape[key](input[key], childPath(path, key));
      if (value !== undefined) result[key] = value;
    }
    return result as T;
  };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const D = {
  string,
  text,
  number,
  integer,
  boolean,
  date,
  dateTime,
  time,
  literal,
  nullable,
  optional,
  fallback,
  array,
  record,
  unknown,
  object,
} as const;
