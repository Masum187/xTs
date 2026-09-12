import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

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

test("resource lifecycle shows the chain and goods receipts after approval", async ({
  page,
  request,
}) => {
  const date = "2026-04-06";
  await request.post("http://127.0.0.1:4010/odata/TimesheetDays", {
    data: {
      extNr: "SCHILZ",
      date,
      startTime: "08:30",
      endTime: "12:30",
      breakMinutes: 0,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "700000000004", description: "Live-Circle Probe", hours: 4 },
      ],
    },
  });
  await request.post("http://127.0.0.1:4010/odata/TimesheetApprovals", {
    data: { extNr: "SCHILZ", date, action: "approve" },
    headers: { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" },
  });

  await openReportingAsApprover(page);

  const row = page.getByTestId("lifecycle-SCHILZ-700000000004");
  await expect(row).toContainText("SAP-Implementierung");
  await expect(row).toContainText("BEAUF-9001");
  await expect(row).toContainText("10009001/00010");
  await expect(row).toContainText("4500001234/00010");
  await expect(page.getByTestId("we-SCHILZ-700000000004")).toContainText("WE-");
  await expect(page.getByTestId("we-SCHILZ-700000000004")).toContainText(
    "WE ausstehend",
  );
  await expect(page.getByTestId("invoice-SCHILZ-700000000004")).toHaveText("–");

  await page.getByLabel("Einkaufsbeleg").fill("4500002001");
  await expect(row).toBeHidden();
  await expect(page.getByTestId("lifecycle-SCHILZ-600000000001")).toBeVisible();

  await page.getByLabel("Bestellposition").fill("00020");
  await expect(page.getByTestId("lifecycle-empty")).toBeVisible();

  await page.getByLabel("Einkaufsbeleg").fill("");
  await page.getByLabel("Bestellposition").fill("");
  await expect(page.getByTestId("lifecycle-SCHILZ-600000000009")).toBeVisible();
  await page.getByLabel("Zeitraum von").fill("2026-05");
  await page.getByLabel("Zeitraum bis").fill("2026-05");
  await expect(page.getByTestId("lifecycle-SCHILZ-600000000009")).toBeHidden();
  await expect(row).toBeVisible();
});

test("reporting is not reachable for regular users", async ({ page }) => {
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Reporting" })).toBeHidden();
});

test("approvers see only their cost objects in reporting", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("maria.weber@qualitytimes.de");
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();

  await expect(page.getByTestId("budget-700000000004")).toBeVisible();
  await expect(page.getByTestId("budget-600000000001")).toHaveCount(0);
  await expect(page.getByTestId("quota-SCHILZ-700000000004")).toBeVisible();
  await expect(page.getByTestId("quota-ROEPER-600000000001")).toHaveCount(0);
  await expect(page.getByTestId("lifecycle-SCHILZ-700000000004")).toBeVisible();
  await expect(page.getByTestId("lifecycle-SCHILZ-600000000001")).toHaveCount(
    0,
  );
});

test("controllers reach the unscoped reporting via navigation without approvals", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("jonas.krause@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Jonas Krause");
  await expect(page.getByRole("link", { name: "Genehmigung" })).toHaveCount(0);
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
  await expect(page.getByTestId("budget-700000000004")).toBeVisible();
  await expect(page.getByTestId("budget-600000000001")).toBeVisible();
  await expect(page.getByTestId("quota-ROEPER-600000000001")).toBeVisible();
});
