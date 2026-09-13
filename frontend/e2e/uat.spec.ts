import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// UAT-Drehbuch aus docs/testdaten-uat-v0.1.md (XTS-082). Das Testdatenpaket
// wird vor jedem Test zurueckgesetzt (fixtures.ts), die Reihenfolge der Specs
// spielt keine Rolle mehr.

const SCHILZ = "stephan.schilz@qualitytimes.de";
const ROEPER = "christian.roeper@qualitytimes.de";

async function switchPersona(page: Page, upn: string, name: string) {
  await page.getByTestId("persona-select").selectOption(upn);
  await expect(page.getByTestId("profile")).toContainText(name);
}

test("UAT-Fall A: Planung bis Genehmigung und Wareneingang", async ({
  page,
}) => {
  await page.goto("/");
  await switchPersona(page, ROEPER, "Christian Roeper");

  // Schritt 1–2: Planung und Freigabe
  await page.getByRole("link", { name: "Planung" }).click();
  const input = page.getByTestId("input-SCHILZ-700000000004-2026-05");
  await input.fill("40");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "gespeichert",
  );
  await expect(page.getByTestId("overbooked-warning")).toBeHidden();
  await page.getByTestId("release-SCHILZ-700000000004-2026-05").click();
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-05"),
  ).toContainText("40 · F");

  // Schritt 3–5: Beauftragung, BANF, Bestelldaten-Job
  await page.getByRole("link", { name: "Beauftragung" }).click();
  const candidate = page.getByTestId("candidate-SCHILZ-700000000004");
  await expect(candidate).toContainText("40 Std.");
  await candidate.getByTestId("create-order-SCHILZ-700000000004").click();
  const orderRow = page.getByTestId("order-BEAUF-000001");
  await expect(orderRow).toContainText("Angelegt");
  await page.getByTestId("create-banf-BEAUF-000001").click();
  await expect(orderRow).toContainText("BANF vorhanden");
  await expect(orderRow).toContainText("10000001/00010");
  await page.getByTestId("run-po-sync").click();
  await expect(orderRow).toContainText("Bestellung vorhanden");
  await expect(orderRow).toContainText("4500001234/00010");
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-05"),
  ).toContainText("40 · B");

  // Schritt 6: Stundenschreibung
  await switchPersona(page, SCHILZ, "Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-05-05");
  await expect(page.getByTestId("day-status")).toHaveText("Entwurf");
  await expect(page.getByTestId("cost-object-list")).toContainText(
    "von 360 Std. offen",
  );
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await page.getByTestId("add-line").click();
  await page
    .getByLabel("Leistungsbeschreibung")
    .last()
    .fill("UAT Fall A – Konzeptworkshop");
  await page.getByLabel("Stunden").last().fill("8");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();

  // Schritt 7: Genehmigung mit Wareneingang
  await switchPersona(page, ROEPER, "Christian Roeper");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await page.getByTestId("approval-SCHILZ-2026-05-05").click();
  await page.getByTestId("approve-SCHILZ-2026-05-05").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "Wareneingang WE-000001",
  );
  await expect(page.getByTestId("approval-SCHILZ-2026-05-05")).toBeHidden();

  // Schritt 8: Reporting
  await page.getByRole("link", { name: "Reporting" }).click();
  const lifecycle = page.getByTestId("lifecycle-SCHILZ-700000000004");
  await expect(lifecycle).toContainText("BEAUF-000001");
  await expect(page.getByTestId("we-SCHILZ-700000000004")).toContainText(
    "WE-000001",
  );
  const budget = page.getByTestId("budget-700000000004");
  await expect(budget).toContainText("360");
  await expect(budget).toContainText("16");

  // Schritt 9: genehmigter Tag ist gesperrt
  await switchPersona(page, SCHILZ, "Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-05-05");
  await expect(page.getByTestId("day-status")).toHaveText("Genehmigt");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
});

test("UAT-Fall B: Rückweisung, Korrektur, erneute Rückweisung", async ({
  page,
}) => {
  await page.goto("/");
  await switchPersona(page, ROEPER, "Christian Roeper");
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page.getByTestId("reset-test-data").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "Testdatenpaket uat-v0.1 zurückgesetzt",
  );

  // Schritt 1–2: zurueckgewiesenen Tag korrigieren
  await switchPersona(page, SCHILZ, "Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-10");
  await expect(page.getByTestId("day-status")).toHaveText("Zurückgewiesen");
  await expect(page.getByTestId("rejection-banner")).toContainText(
    "Bitte Projektreferenz in der Beschreibung ergänzen.",
  );
  await page
    .getByLabel("Leistungsbeschreibung")
    .fill("Support PRJ-4711 Incident-Bearbeitung");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByTestId("rejection-banner")).toBeHidden();
  await expect(page.getByTestId("day-status")).toHaveText(
    "Zur Genehmigung freigegeben",
  );

  // Schritt 3–4: erneute Rueckweisung mit Grund
  await switchPersona(page, ROEPER, "Christian Roeper");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await page.getByTestId("approval-SCHILZ-2026-04-10").click();
  await page.getByTestId("reject-SCHILZ-2026-04-10").click();
  await expect(page.getByTestId("confirm-reject")).toBeDisabled();
  await page
    .getByLabel("Rückweisungsgrund")
    .fill("UAT: Stundenanzahl bitte prüfen.");
  await page.getByTestId("confirm-reject").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "zurückgewiesen",
  );
  await expect(page.getByTestId("approval-SCHILZ-2026-04-10")).toBeHidden();

  // Schritt 5: Mitarbeiter sieht den neuen Grund
  await switchPersona(page, SCHILZ, "Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-10");
  await expect(page.getByTestId("day-status")).toHaveText("Zurückgewiesen");
  await expect(page.getByTestId("rejection-banner")).toContainText(
    "UAT: Stundenanzahl bitte prüfen.",
  );
  await expect(page.getByTestId("submit-timesheet")).toBeEnabled();

  // Schritt 6: zurueckgewiesene Stunden zaehlen nicht als gebucht
  await switchPersona(page, ROEPER, "Christian Roeper");
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByTestId("quota-SCHILZ-600000000001")).toContainText(
    "160",
  );
  await page.getByLabel("Tagesdetails").check();
  await expect(page.getByTestId("quota-table")).not.toContainText(
    "Support PRJ-4711",
  );
});
