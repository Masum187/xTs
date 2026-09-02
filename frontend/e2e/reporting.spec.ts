import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openReportingAsApprover(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
}

test("budget monitor shows totals, traffic light and day details", async ({
  page,
}) => {
  await openReportingAsApprover(page);

  const budgetRow = page.getByTestId("budget-700000000004");
  await expect(budgetRow).toContainText("SAP-Implementierung");
  await expect(budgetRow).toContainText("%");
  await expect(page.getByTestId("traffic-700000000004")).toBeVisible();

  await page.getByLabel("Detailstufe").selectOption("day");
  await expect(page.getByTestId("budget-table")).toContainText(
    "Datenmodell Review",
  );
  await expect(page.getByTestId("budget-table")).toContainText(
    "Stephan Schilz",
  );
});

test("quota monitor filters by last name and team", async ({ page }) => {
  await openReportingAsApprover(page);

  const table = page.getByTestId("quota-table");
  await expect(page.getByTestId("quota-SCHILZ-700000000004")).toBeVisible();
  await expect(page.getByTestId("quota-ROEPER-600000000001")).toBeVisible();

  await page.getByLabel("Nachname").fill("Roeper");
  await expect(page.getByTestId("quota-SCHILZ-700000000004")).toBeHidden();
  await expect(table).toContainText("Christian Roeper");

  await page.getByLabel("Nachname").fill("");
  await page.getByLabel("Team").selectOption("TRANSFORMATION_MC");
  await expect(page.getByTestId("quota-ROEPER-600000000001")).toBeHidden();
  await expect(page.getByTestId("quota-SCHILZ-700000000004")).toBeVisible();

  await page.getByLabel("Nachname").fill("gibtesnicht");
  await expect(page.getByTestId("quota-empty")).toBeVisible();
});

test("quota monitor shows optional day details", async ({ page }) => {
  await openReportingAsApprover(page);

  await expect(page.getByTestId("quota-table")).not.toContainText(
    "Datenmodell Review",
  );
  await page.getByLabel("Tagesdetails").check();
  await expect(page.getByTestId("quota-table")).toContainText(
    "Datenmodell Review",
  );
});

test("reporting is not reachable for regular users", async ({ page }) => {
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Reporting" })).toBeHidden();
});
