import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Schmale Breiten (Audit Nr. 26): kein horizontales Scrollen der ganzen
// Seite; breite Tabellen scrollen nur innerhalb ihres Panels.

/** Unter 1024 px liegt die Navigation im modalen Menue (XTS-142). */
async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function expectNoHorizontalPageScroll(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, `${label}: Seite breiter als der Viewport`).toBe(
    widths.client,
  );
}

for (const width of [375, 768, 1024]) {
  test(`all screens fit a ${width} px viewport without page-wide scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
    await page.getByLabel("Tagesdatum").fill("2026-04-13");
    await expect(page.getByLabel("Stunden").first()).toBeVisible();
    await expectNoHorizontalPageScroll(page, "Stundenschreibung");

    await openNavIfNarrow(page);
    await page
      .getByTestId("persona-select")
      .selectOption("christian.roeper@qualitytimes.de");
    await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
    for (const [link, heading, ready] of [
      ["Genehmigung", "Genehmigung", "approval-list"],
      ["Reporting", "Reporting", "budget-table"],
      ["Planung", "Ressourcenplanung", "planning-grid"],
      ["Beauftragung", "Beauftragung", /candidate-list|candidates-empty/],
      ["Einstellungen", "Einstellungen", "employee-table"],
    ] as [string, string, string | RegExp][]) {
      await openNavIfNarrow(page);
      await page.getByRole("link", { name: link }).click();
      await expect(
        page.getByRole("heading", { name: heading, level: 1, exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId(ready)).toBeVisible();
      await expectNoHorizontalPageScroll(page, heading);
    }
  });
}
