// Setzt das Testdatenpaket vor jedem Lauf zurueck, damit ein lokal
// wiederverwendeter, zustandsbehafteter Mock (reuseExistingServer) keine
// Reste aus frueheren Laeufen in die Specs traegt (Audit Nr. 30).
export default async function globalSetup(): Promise<void> {
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
