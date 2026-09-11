import { test as base, expect } from "@playwright/test";

// Testisolation (Audit Nr. 30): jeder Test startet auf dem dokumentierten
// Testdatenpaket. Die Specs teilen sich weiterhin einen Mock-Server
// (workers: 1), haengen aber nicht mehr von Reihenfolge oder Vorgaengern ab.

export const API = "http://127.0.0.1:4010/odata";
export const ADMIN_UPN = "christian.roeper@qualitytimes.de";

export async function resetTestData(): Promise<void> {
  const response = await fetch(`${API}/TestDataResets`, {
    method: "POST",
    headers: { "x-mock-oauth-upn": ADMIN_UPN },
  });
  if (!response.ok) {
    throw new Error(`Testdaten-Reset fehlgeschlagen: HTTP ${response.status}`);
  }
}

export const test = base.extend<{ isolatedTestData: void }>({
  isolatedTestData: [
    async ({}, use) => {
      await resetTestData();
      await use();
    },
    { auto: true },
  ],
});

export { expect };
