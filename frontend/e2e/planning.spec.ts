import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function openPlanningAsPlanner(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByRole("heading", { name: "Ressourcenplanung" }),
  ).toBeVisible();
}

test("shows 12 months from the start month with locked entries", async ({
  page,
}) => {
  await openPlanningAsPlanner(page);

  const grid = page.getByTestId("planning-grid");
  await expect(grid).toContainText("03.2026");
  await expect(grid).toContainText("02.2027");
  await expect(grid.locator("thead th")).toHaveCount(13);

  await expect(
    page.getByTestId("cell-SCHILZ-600000000001-2026-03"),
  ).toContainText("30 · P");
  await expect(
    page.getByTestId("cell-ROEPER-600000000001-2026-04"),
  ).toContainText("20 · F");
  await expect(
    page.getByTestId("cell-SCHILZ-600000000009-2026-04"),
  ).toContainText("nicht gültig");
  await expect(
    page.getByTestId("input-SCHILZ-600000000009-2026-04"),
  ).toBeHidden();

  await page.getByLabel("Startmonat").fill("13.2026");
  await page.getByLabel("Startmonat").press("Tab");
  await expect(page.getByTestId("start-error")).toBeVisible();
});

test("saves plan hours and warns about overplanning", async ({ page }) => {
  await openPlanningAsPlanner(page);

  const input = page.getByTestId("input-SCHILZ-700000000004-2026-05");
  await input.fill("200");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "gespeichert",
  );
  await expect(page.getByTestId("overbooked-warning")).toContainText(
    "200 Std. geplant bei 160 Std. verfügbar",
  );
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-05"),
  ).toHaveClass(/overbooked/);
});

test("releases a V entry for BANF and locks it", async ({ page }) => {
  await openPlanningAsPlanner(page);

  await page.getByTestId("release-SCHILZ-700000000004-2026-04").click();
  await expect(page.getByTestId("planning-message")).toContainText(
    "für BANF freigegeben",
  );
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-04"),
  ).toContainText("60 · F");
  await expect(
    page.getByTestId("input-SCHILZ-700000000004-2026-04"),
  ).toBeHidden();
});

test("filters rows by employee", async ({ page }) => {
  await openPlanningAsPlanner(page);

  await page.getByLabel("Mitarbeiter").selectOption("ROEPER");
  const grid = page.getByTestId("planning-grid");
  await expect(grid).toContainText("Christian Roeper");
  await expect(grid).not.toContainText("Stephan Schilz");
});

test("planning is not reachable without planner role", async ({ page }) => {
  await page.goto("/planning");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Planung" })).toBeHidden();
});

test("plan hours are validated before sending and need a team assignment", async ({
  page,
}) => {
  await openPlanningAsPlanner(page);

  const input = page.getByTestId("input-SCHILZ-700000000004-2026-09");
  await input.fill("0.333");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "ganzen Minuten",
  );
  await input.fill("1000");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "zwischen 0 und 744",
  );
  // Schilz hat 2027 keine Teamzuordnung: Zelle ist gesperrt.
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2027-01"),
  ).toContainText("keine Teamzuordnung");
  await expect(
    page.getByTestId("input-SCHILZ-700000000004-2027-01"),
  ).toBeHidden();
});
