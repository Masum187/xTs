import { expect, test } from "@playwright/test";

// Robustheit der Oberflaeche (Audit Nr. 10, 11, 20): Ladezustand, Fehler
// mit erneutem Versuch, Sperre gegen Doppelaktionen, unbekannte URL.

const API = "http://127.0.0.1:4010/odata";

test("unknown URLs show a not-found page with a way back", async ({ page }) => {
  await page.goto("/gibtsnicht");
  await expect(page.getByTestId("not-found")).toContainText(
    "Seite nicht gefunden",
  );
  await page.getByRole("link", { name: "Zur Stundenschreibung" }).click();
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
});

test("a slow save locks the buttons and sends exactly one request", async ({
  page,
}) => {
  let posts = 0;
  await page.route(`${API}/TimesheetDays`, async (route) => {
    posts += 1;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-04");
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await page.getByTestId("add-line").click();
  await page.getByLabel("Leistungsbeschreibung").last().fill("Doppelklick");
  await page.getByLabel("Stunden").last().fill("8");

  const save = page.getByTestId("save-draft");
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save).toContainText("Wird gespeichert");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  // Waehrend der Anfrage sind auch Datum, Tageskopf und Positionen gesperrt.
  await expect(page.getByLabel("Tagesdatum")).toBeDisabled();
  await expect(page.locator("label:has-text('Kommt') input")).toBeDisabled();
  await expect(page.getByLabel("Stunden").last()).toBeDisabled();
  await expect(page.getByTestId("add-line")).toBeDisabled();
  await save.click({ force: true }).catch(() => undefined);
  await expect(page.locator(".actions .message")).toContainText(
    "Entwurf gespeichert.",
    { timeout: 5000 },
  );
  await expect(save).toBeEnabled();
  expect(posts).toBe(1);
});

test("load errors show a message with retry instead of an empty list", async ({
  page,
}) => {
  let fail = true;
  await page.route(`${API}/ApprovalTimesheets`, async (route) => {
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Backend kaputt" }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(page.getByTestId("load-error")).toContainText("Backend kaputt");
  await expect(page.getByTestId("approval-empty")).toHaveCount(0);
  await expect(page.getByTestId("approval-list")).toHaveCount(0);

  fail = false;
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("approval-list")).toBeVisible();
  await expect(page.getByTestId("load-error")).toHaveCount(0);
});

test("filter reloads use the same error state with retry", async ({ page }) => {
  let fail = false;
  await page.route(`${API}/OrderCandidates*`, async (route) => {
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Kandidaten weg" }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Beauftragung" }).click();
  await expect(page.getByTestId("candidate-list")).toBeVisible();

  fail = true;
  await page.getByLabel("Mitarbeiter-Nr.").fill("ROEPER");
  await expect(page.getByTestId("load-error")).toContainText("Kandidaten weg");
  await expect(page.getByTestId("candidate-list")).toHaveCount(0);
  await expect(page.getByTestId("orders-table")).toBeVisible();

  fail = false;
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("candidate-list")).toBeVisible();
  await expect(page.getByTestId("candidate-ROEPER-600000000001")).toBeVisible();
});

test("a slow load shows a loading state before the data", async ({ page }) => {
  await page.route(`${API}/BudgetMonitor*`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByTestId("loading").first()).toContainText(
    "Budget-Monitor wird geladen",
  );
  await expect(page.getByTestId("budget-table")).toBeVisible();
});

test("a failed window change retries the requested day, not the old one", async ({
  page,
}) => {
  // Startfenster ist April bis Juni (Server-Heute 2026-05-05). Das August-
  // Fenster (Juli bis September) scheitert einmal.
  let failAugust = true;
  await page.route(`${API}/MyTimesheets*`, async (route) => {
    if (failAugust && route.request().url().includes("from=2026-07-01")) {
      failAugust = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "August weg" }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-13");
  await expect(page.getByTestId("day-status")).toHaveText("Entwurf");

  await page.getByLabel("Tagesdatum").fill("2026-08-03");
  await expect(page.getByTestId("load-error")).toContainText("August weg");
  await page.getByTestId("retry").click();
  await expect(page.getByLabel("Tagesdatum")).toHaveValue("2026-08-03");
  await expect(page.getByTestId("day-status")).toHaveText("Entwurf");
});

test("unsaved timesheet changes ask before navigation and persona switch", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
  await page.getByLabel("Tagesdatum").fill("2026-04-14");
  await expect(page.getByTestId("unsaved-hint")).toHaveCount(0);
  await page.locator("label:has-text('Pause') input").fill("45");
  await expect(page.getByTestId("unsaved-hint")).toBeVisible();

  // Navigation abbrechen: Screen und Eingabe bleiben.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.locator("label:has-text('Pause') input")).toHaveValue("45");

  // Persona-Wechsel abbrechen: Persona bleibt.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByTestId("persona-select")
    .selectOption("stephan.schilz@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
  await expect(page.getByTestId("persona-select")).toHaveValue(
    "christian.roeper@qualitytimes.de",
  );

  // Verwerfen bestaetigen: Navigation laeuft.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(page.getByRole("heading", { name: "Planung" })).toBeVisible();
  await page.getByRole("link", { name: "Stundenschreibung" }).click();
  await expect(page.getByTestId("unsaved-hint")).toHaveCount(0);
});

test("unsaved timesheet changes ask before changing the day", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
  const dateInput = page.getByLabel("Tagesdatum");
  const breakInput = page.locator("label:has-text('Pause') input");
  await dateInput.fill("2026-04-14");
  await breakInput.fill("45");
  await expect(page.getByTestId("unsaved-hint")).toBeVisible();

  // Datumsfeld: Abbruch behaelt Datum und Eingabe.
  page.once("dialog", (dialog) => dialog.dismiss());
  await dateInput.fill("2026-04-15");
  await expect(dateInput).toHaveValue("2026-04-14");
  await expect(breakInput).toHaveValue("45");
  await expect(page.getByTestId("unsaved-hint")).toBeVisible();

  // Folgetag: Abbruch behaelt Datum und Eingabe.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("next-day").click();
  await expect(dateInput).toHaveValue("2026-04-14");
  await expect(breakInput).toHaveValue("45");

  // Fensterwechsel (August liegt ausserhalb April bis Juni): Abbruch ebenso.
  page.once("dialog", (dialog) => dialog.dismiss());
  await dateInput.fill("2026-08-03");
  await expect(dateInput).toHaveValue("2026-04-14");
  await expect(breakInput).toHaveValue("45");

  // Verwerfen bestaetigen: Folgetag oeffnet ohne Aenderungen.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("next-day").click();
  await expect(dateInput).toHaveValue("2026-04-15");
  await expect(page.getByTestId("unsaved-hint")).toHaveCount(0);
});
