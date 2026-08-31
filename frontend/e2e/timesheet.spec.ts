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
