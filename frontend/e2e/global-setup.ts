// Setzt das Testdatenpaket vor jedem Lauf zurueck, damit ein lokal
// wiederverwendeter, zustandsbehafteter Mock (reuseExistingServer) keine
// Reste aus frueheren Laeufen in die Specs traegt (Audit Nr. 30).
import { SMOKE_TODAY } from "./playwright.config";

export default async function globalSetup(): Promise<void> {
  await assertResponseShape();
  try {
    const response = await fetch("http://127.0.0.1:4010/odata/TestDataResets", {
      method: "POST",
      headers: { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" },
    });
    if (!response.ok) {
      console.warn(`Testdaten-Reset fehlgeschlagen: HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(
      "Testdaten-Reset nicht möglich (Mock-API nicht erreichbar?)",
      error,
    );
  }
}

/**
 * Ein lokal wiederverwendeter Mock (reuseExistingServer) muss in der
 * Antwortform laufen, die der Lauf erwartet (XTS_ODATA); sonst wuerde
 * `test:smoke:v2` stillschweigend gegen die Mock-Form testen.
 */
async function assertResponseShape(): Promise<void> {
  const expected = process.env.XTS_ODATA === "v2" ? "v2" : "mock";
  let health: { odata?: string; today?: string };
  try {
    const response = await fetch("http://127.0.0.1:4010/health");
    health = (await response.json()) as { odata?: string; today?: string };
  } catch {
    return; // Kein Server: Playwright startet ihn selbst mit der Umgebung.
  }
  if (health.odata !== expected) {
    throw new Error(
      `Mock-API auf Port 4010 laeuft in Antwortform "${health.odata ?? "unbekannt"}", ` +
        `der Lauf erwartet "${expected}". Server mit XTS_ODATA=${expected === "v2" ? "v2" : ""} neu starten ` +
        "oder beenden, damit Playwright ihn startet.",
    );
  }
  if (health.today !== SMOKE_TODAY) {
    throw new Error(
      `Mock-API auf Port 4010 laeuft mit Systemdatum "${health.today ?? "unbekannt"}", ` +
        `die Smoke-Tests erwarten XTS_TODAY=${SMOKE_TODAY}. Server mit XTS_TODAY=${SMOKE_TODAY} neu starten ` +
        "oder beenden, damit Playwright ihn startet.",
    );
  }
}
