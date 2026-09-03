import { expect, test } from "@playwright/test";

test("loads timesheet and submits draft", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await expect(page.getByTestId("day-status")).toHaveText("Entwurf");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
  await expect(page.getByTestId("day-status")).toHaveText(
    "Zur Genehmigung freigegeben",
  );
});

test("shows rejection reason and re-submits corrected day", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page.getByLabel("Tagesdatum").fill("2026-04-10");
  await expect(page.getByTestId("day-status")).toHaveText("Zurückgewiesen");
  await expect(page.getByTestId("rejection-banner")).toContainText(
    "Bitte Projektreferenz in der Beschreibung ergänzen.",
  );

  await page
    .getByLabel("Leistungsbeschreibung")
    .fill("Support PRJ-4711 Incident-Bearbeitung");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
  await expect(page.getByTestId("rejection-banner")).toBeHidden();
});

test("blocks invalid hours, times and breaks before anything is sent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-03");
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await page.getByTestId("add-line").click();
  const hours = page.getByLabel("Stunden").last();
  const problems = page.getByTestId("timesheet-problems");

  await hours.fill("-5");
  await expect(problems).toContainText("zwischen 0,25 und 24");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await hours.fill("25");
  await expect(problems).toContainText("zwischen 0,25 und 24");
  await hours.fill("1.3333");
  await expect(problems).toContainText("Viertelstunden");
  await page.getByTestId("save-draft").click();
  await expect(page.locator(".actions .message")).toContainText(
    "Viertelstunden",
  );

  await hours.fill("8");
  await page.getByLabel("Leistungsbeschreibung").last().fill("Validierung");
  await page.locator("label:has-text('Geht') input").fill("07:00");
  await expect(problems).toContainText("Geht muss nach Kommt liegen");
  await page.locator("label:has-text('Geht') input").fill("17:30");
  await page.locator("label:has-text('Pause') input").fill("-30");
  await expect(problems).toContainText("Pause");
  await page.locator("label:has-text('Pause') input").fill("30");
  await expect(problems).toBeHidden();
  await expect(page.getByTestId("submit-timesheet")).toBeEnabled();
});

test("locks approved days and blocks exhausted cost objects", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page.getByLabel("Tagesdatum").fill("2026-04-09");
  await expect(page.getByTestId("day-status")).toHaveText("Genehmigt");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await expect(page.getByTestId("save-draft")).toBeDisabled();

  await expect(page.getByTestId("cost-object-list")).toContainText(
    "nicht buchbar",
  );
});
