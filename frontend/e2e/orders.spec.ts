import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const PLANNER_HEADERS = {
  "x-mock-oauth-upn": "christian.roeper@qualitytimes.de",
};
const API = "http://127.0.0.1:4010/odata";

async function seedReleasedRow(
  request: APIRequestContext,
  extNr: string,
  coIdent: string,
  month: string,
  hours: number,
) {
  await request.post(`${API}/PlanningEntries`, {
    headers: PLANNER_HEADERS,
    data: { extNr, coIdent, month, hours },
  });
  await request.post(`${API}/PlanningReleases`, {
    headers: PLANNER_HEADERS,
    data: { extNr, coIdent, month },
  });
}

async function openOrdersAsPlanner(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Beauftragung" }).click();
  await expect(
    page.getByRole("heading", { name: "Beauftragung", exact: true }),
  ).toBeVisible();
}

test("full chain: candidate to order, BANF, purchase order sync", async ({
  page,
  request,
}) => {
  await seedReleasedRow(request, "SCHILZ", "700000000004", "2026-06", 50);
  await seedReleasedRow(request, "SCHILZ", "600000000001", "2026-04", 25);

  await openOrdersAsPlanner(page);

  const implementation = page.getByTestId("candidate-SCHILZ-700000000004");
  await expect(implementation).toContainText("50 Std.");
  await expect(implementation).toContainText("06.2026");
  await expect(page.getByTestId("candidate-ROEPER-600000000001")).toBeVisible();

  await page.getByLabel("Mitarbeiter-Nr.").fill("ROEPER");
  await expect(implementation).toBeHidden();
  await page.getByLabel("Mitarbeiter-Nr.").fill("");
  await expect(implementation).toBeVisible();

  await implementation
    .getByLabel("BANF-Positionstext")
    .fill("SAP-Implementierung Sprint Juni");
  await implementation.getByTestId("create-order-SCHILZ-700000000004").click();
  const orderRow = page.getByTestId("order-BEAUF-000001");
  await expect(orderRow).toContainText("Angelegt");
  const positionText = orderRow.getByLabel("BANF-Positionstext BEAUF-000001");
  await expect(positionText).toHaveValue("SAP-Implementierung Sprint Juni");
  await expect(implementation).toBeHidden();

  await positionText.fill("SAP-Implementierung Sprint Juni final");
  await orderRow.getByTestId("save-text-BEAUF-000001").click();
  await expect(page.getByTestId("orders-message")).toContainText(
    "BANF-Positionstext für BEAUF-000001 gespeichert.",
  );
  await expect(positionText).toHaveValue(
    "SAP-Implementierung Sprint Juni final",
  );

  await page.getByTestId("create-banf-BEAUF-000001").click();
  await expect(orderRow).toContainText("BANF vorhanden");
  await expect(orderRow).toContainText("SAP-Implementierung Sprint Juni final");
  await expect(orderRow).toContainText("10000001/00010");

  await page
    .getByTestId("candidate-SCHILZ-600000000001")
    .getByTestId("create-order-SCHILZ-600000000001")
    .click();
  await page.getByTestId("create-banf-BEAUF-000002").click();

  await page.getByTestId("run-po-sync").click();
  await expect(page.getByTestId("orders-message")).toContainText(
    "1 Beauftragung(en) aktualisiert, 1 Fehler",
  );
  await expect(orderRow).toContainText("Bestellung vorhanden");
  await expect(orderRow).toContainText("4500001234/00010");
  await expect(page.getByTestId("order-BEAUF-000002")).toContainText(
    "BANF vorhanden",
  );
  await expect(page.getByTestId("order-protocol")).toContainText(
    "Keine Bestellung zur BANF",
  );

  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-06"),
  ).toContainText("50 · B");
  await expect(
    page.getByTestId("cell-SCHILZ-600000000001-2026-04"),
  ).toContainText("25 · P");
});

test("orders are not reachable without planner role", async ({ page }) => {
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Beauftragung" })).toBeHidden();
});
