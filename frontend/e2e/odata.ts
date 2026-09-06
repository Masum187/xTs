// Hilfen fuer direkte API-Zugriffe in den Specs: die Mock-API liefert je nach
// XTS_ODATA die Mock-Form (`value`, JSON-Zahlen) oder die SAP-OData-V2-Form
// (`d.results`, Decimal-Strings, V2-Fehlerobjekt).

export function itemsOf<T>(body: unknown): T[] {
  const root = body as { value?: T[]; d?: { results?: T[] } };
  return root.value ?? root.d?.results ?? [];
}

export function numberOf(value: unknown): number {
  return Number(value);
}

export function errorMessageOf(body: unknown): string {
  const root = body as {
    message?: string;
    error?: string | { message?: string | { value?: string } };
  };
  if (typeof root.message === "string") return root.message;
  const error =
    typeof root.error === "object" ? root.error?.message : undefined;
  return typeof error === "string" ? error : (error?.value ?? "");
}
