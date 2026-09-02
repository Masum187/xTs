// Gemeinsame Fehlerbehandlung fuer Mock-API/OData-Antworten (XTS-081):
// der technische Code bleibt fuer Logik und Tests, die vom Server gelieferte
// fachliche Meldung geht 1:1 an den Anwender.

interface ErrorBody {
  error?: string;
  message?: string;
  fields?: string[];
  allowed?: string[];
  conflictId?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: string[] = [],
    readonly conflictId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readApiJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      body = {};
    }
    throw new ApiError(
      response.status,
      body.error ?? "UNKNOWN",
      body.message ??
        `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`,
      body.fields ?? body.allowed ?? [],
      body.conflictId,
    );
  }
  return (await response.json()) as T;
}

export function describeApiError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
