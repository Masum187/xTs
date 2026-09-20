import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

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

  // XTS-152: vier Monate je Seite ueber den zwoelf Monaten des Horizonts.
  const grid = page.getByTestId("planning-grid");
  await expect(grid).toContainText("03.2026");
  await expect(page.getByTestId("months-page")).toHaveText(
    "Monate 1 bis 4 von 12",
  );
  await expect(
    page.getByTestId("month-head").locator(".month-chip"),
  ).toHaveCount(4);
  await page.getByTestId("months-next").click();
  await page.getByTestId("months-next").click();
  await expect(page.getByTestId("months-page")).toHaveText(
    "Monate 9 bis 12 von 12",
  );
  await expect(grid).toContainText("02.2027");
  await expect(page.getByTestId("months-next")).toBeDisabled();
  await page.getByTestId("months-prev").click();
  await page.getByTestId("months-prev").click();

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

  // XTS-152: Eingabe im Zelleneditor der ausgewaehlten Kachel.
  await page.getByTestId("cell-SCHILZ-700000000004-2026-05").click();
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

  await page.getByTestId("cell-SCHILZ-700000000004-2026-04").click();
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

  // 09.2026 liegt auf der zweiten Seite, 01.2027 auf der dritten.
  await page.getByTestId("months-next").click();
  await page.getByTestId("cell-SCHILZ-700000000004-2026-09").click();
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
  // Schilz hat 2027 keine Teamzuordnung: Zelle ist gesperrt. Der Seitenwechsel
  // verwirft die ungueltige Eingabe nach Rueckfrage.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("months-next").click();
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2027-01"),
  ).toContainText("keine Teamzuordnung");
  await expect(
    page.getByTestId("input-SCHILZ-700000000004-2027-01"),
  ).toBeHidden();
});

// XTS-157: Auslastung je Mitarbeiter ueber alle Kontierungen, serverseitig
// summiert; der Kontierungsfilter aendert die Summe nicht.
test("shows utilization per employee across all cost objects, independent of the cost object filter", async ({
  page,
}) => {
  await openPlanningAsPlanner(page);
  const block = page.getByTestId("utilization");
  await expect(
    block.getByRole("heading", { name: "Auslastung über alle Kontierungen" }),
  ).toBeVisible();
  // SCHILZ: 30 Std. (P, 600000000001) im Maerz, 60 Std. (V, 700000000004)
  // im April; ROEPER: 20 Std. (F) im April.
  await expect(page.getByTestId("utilization-SCHILZ-2026-03")).toContainText(
    "30 von 176 Std. · 17 %",
  );
  await expect(page.getByTestId("utilization-SCHILZ-2026-04")).toContainText(
    "60 von 168 Std. · 35,7 %",
  );
  await expect(page.getByTestId("utilization-ROEPER-2026-04")).toContainText(
    "20 von 168 Std. · 11,9 %",
  );
  await expect(page.getByTestId("utilization-filter-hint")).toHaveCount(0);

  // Kontierungsfilter: Matrix zeigt nur 700000000004, die Summe bleibt.
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await expect(page.getByTestId("utilization-filter-hint")).toBeVisible();
  await expect(page.getByTestId("utilization-SCHILZ-2026-03")).toContainText(
    "30 von 176 Std. · 17 %",
  );
  await expect(page.getByTestId("utilization-SCHILZ-2026-04")).toContainText(
    "60 von 168 Std. · 35,7 %",
  );
  await expect(page.getByTestId("utilization-ROEPER")).toHaveCount(0);

  // Mitarbeiterfilter bleibt wirksam.
  await page.getByLabel("Kontierung").selectOption("");
  await page.getByLabel("Mitarbeiter").selectOption("ROEPER");
  await expect(page.getByTestId("utilization-ROEPER-2026-04")).toBeVisible();
  await expect(page.getByTestId("utilization-SCHILZ")).toHaveCount(0);
});

test("overplanning keeps the real percentage readable while the bar stops at 100 %", async ({
  page,
}) => {
  await openPlanningAsPlanner(page);
  await page.getByTestId("cell-SCHILZ-700000000004-2026-05").click();
  const input = page.getByTestId("input-SCHILZ-700000000004-2026-05");
  await input.fill("200");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "gespeichert",
  );
  const cell = page.getByTestId("utilization-SCHILZ-2026-05");
  await expect(cell).toContainText("200 von 160 Std. · 125 %");
  await expect(cell).toContainText("Überplanung");
  await expect(cell).toHaveClass(/overbooked/);
  const widths = await cell.evaluate((node) => {
    const bar = node.querySelector(".utilization-bar") as HTMLElement;
    const fill = node.querySelector(".utilization-fill") as HTMLElement;
    return { bar: bar.clientWidth, fill: fill.clientWidth };
  });
  expect(widths.fill).toBeGreaterThan(0);
  expect(Math.abs(widths.fill - widths.bar)).toBeLessThanOrEqual(1);
  // Ueberplanung bleibt eine Warnung: die Zelle ist weiterhin bedienbar.
  await expect(page.getByTestId("overbooked-warning")).toBeVisible();
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-05"),
  ).toBeEnabled();
});

test("zero available hours show planned hours without a percentage, load errors show no utilization", async ({
  page,
}) => {
  // Werkkalender ohne verfuegbare Stunden im April: kein Prozentwert, keine
  // Division, keine scheinbaren 0 % (Antwort der Uebersicht gezielt veraendert).
  const zeroApril = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(zeroApril);
    if (value && typeof value === "object") {
      const record = { ...(value as Record<string, unknown>) };
      if (record["month"] === "2026-04" && "availableHours" in record) {
        record["availableHours"] = 0;
        if ("utilizationPercent" in record) record["utilizationPercent"] = null;
      }
      for (const key of Object.keys(record))
        record[key] = zeroApril(record[key]);
      return record;
    }
    return value;
  };
  await page.route(`${API}/PlanningOverview*`, async (route) => {
    const response = await route.fetch();
    const body = zeroApril(await response.json());
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await openPlanningAsPlanner(page);
  const april = page.getByTestId("utilization-SCHILZ-2026-04");
  await expect(april).toContainText(
    "60 Std. geplant · keine verfügbaren Stunden",
  );
  await expect(april).not.toContainText("%");
  await expect(april).toHaveClass(/unavailable/);
  await page.unroute(`${API}/PlanningOverview*`);

  // Ladefehler: Fehlerzustand mit Retry, keine Auslastung als "0 %".
  let fail = true;
  await page.route(`${API}/PlanningOverview*`, async (route) => {
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVER_ERROR" }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByLabel("Startmonat").fill("04.2026");
  await page.getByLabel("Startmonat").press("Tab");
  await expect(page.getByTestId("load-error")).toBeVisible();
  await expect(page.getByTestId("utilization")).toHaveCount(0);
  fail = false;
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("utilization-SCHILZ-2026-04")).toContainText(
    "60 von 168 Std.",
  );
});
