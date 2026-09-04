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
