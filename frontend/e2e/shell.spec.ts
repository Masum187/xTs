import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-142: Shell mit rollenbasierter Navigation, Genehmigungs-Badge aus
// berechtigten Serverdaten und modalem Menue unter 1024 px (Entscheidung 21).

const ROEPER = "christian.roeper@qualitytimes.de";
const WEBER = "maria.weber@qualitytimes.de";
const KRAUSE = "jonas.krause@qualitytimes.de";
const SCHILZ = "stephan.schilz@qualitytimes.de";
const NAV = [
  "Stundenschreibung",
  "Genehmigung",
  "Reporting",
  "Planung",
  "Beauftragung",
  "Verwaltung",
];

async function switchTo(page: Page, upn: string, name: string) {
  await page.getByTestId("persona-select").selectOption(upn);
  await expect(page.getByTestId("nav-persona-name")).toContainText(name);
}

async function visibleLinks(page: Page): Promise<string[]> {
  const texts = await page
    .getByTestId("main-nav")
    .locator("a")
    .allTextContents();
  return texts.map((text) => text.trim().split(/\s+/)[0]);
}

test("navigation entries follow the roles of the active identity", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("nav-persona-name")).toContainText(
    "Stephan Schilz",
  );
  expect(await visibleLinks(page)).toEqual(["Stundenschreibung"]);

  await switchTo(page, WEBER, "Maria Weber");
  expect(await visibleLinks(page)).toEqual([
    "Stundenschreibung",
    "Genehmigung",
    "Reporting",
  ]);

  await switchTo(page, KRAUSE, "Jonas Krause");
  expect(await visibleLinks(page)).toEqual(["Stundenschreibung", "Reporting"]);

  await switchTo(page, ROEPER, "Christian Roeper");
  expect(await visibleLinks(page)).toEqual(NAV);
  await expect(page.getByTestId("sidebar")).toContainText("PL · RM · Admin");
});

test("approval badge shows the server count of the active identity only", async ({
  page,
  request,
}) => {
  const countFor = async (upn: string) => {
    const response = await request.get(`${API}/ApprovalTimesheets`, {
      headers: { "x-mock-oauth-upn": upn },
    });
    const body = (await response.json()) as {
      value?: unknown[];
      d?: { results?: unknown[] };
    };
    return (body.value ?? body.d?.results ?? []).length;
  };
  await page.goto("/");
  await expect(page.getByTestId("nav-persona-name")).toContainText(
    "Stephan Schilz",
  );
  await expect(page.getByTestId("nav-badge-approvals")).toHaveCount(0);

  await switchTo(page, ROEPER, "Christian Roeper");
  const roeper = await countFor(ROEPER);
  expect(roeper).toBeGreaterThan(0);
  await expect(page.getByTestId("nav-badge-approvals")).toHaveText(
    String(roeper),
  );

  await switchTo(page, WEBER, "Maria Weber");
  const weber = await countFor(WEBER);
  expect(weber).toBeGreaterThan(0);
  expect(weber).not.toBe(roeper);
  await expect(page.getByTestId("nav-badge-approvals")).toHaveText(
    String(weber),
  );

  // Identitaetswechsel: kein veralteter Wert, Schilz hat kein Badge.
  await switchTo(page, SCHILZ, "Stephan Schilz");
  await expect(page.getByTestId("nav-badge-approvals")).toHaveCount(0);
});

test("approval badge follows approvals and own submissions", async ({
  page,
}) => {
  await page.goto("/");
  await switchTo(page, ROEPER, "Christian Roeper");
  const badge = page.getByTestId("nav-badge-approvals");
  const before = Number(await badge.textContent());

  await page.getByRole("link", { name: "Genehmigung" }).click();
  await page.getByTestId("approve-SCHILZ-2026-04-08").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "Wareneingang",
  );
  await expect(badge).toHaveText(String(before - 1));

  // Eigener Tag freigegeben: Roeper (admin) sieht ihn in der Liste.
  await page.getByRole("link", { name: "Stundenschreibung" }).click();
  await page.getByLabel("Tagesdatum").fill("2026-04-15");
  await page.getByLabel("Kontierung").selectOption("600000000001");
  await page.getByTestId("add-line").click();
  await page.getByLabel("Leistungsbeschreibung").last().fill("Badge-Probe");
  await page.getByLabel("Stunden").last().fill("8");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
  await expect(badge).toHaveText(String(before));
});

test.describe("modal menu below 1024 px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("closed menu has no reachable entries, open menu traps focus and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
    await expect(page.getByTestId("main-nav")).toHaveCount(0);
    await expect(page.locator("#app-nav")).toHaveCount(0);
    const toggle = page.getByTestId("menu-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.locator("main")).toHaveAttribute("inert", "");
    await expect(page.getByTestId("menu-close")).toBeFocused();

    // Fokus bleibt im Menue (zyklisch).
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest("#app-nav"),
      );
      expect(inside, `Tab ${i + 1}`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(page.locator("#app-nav")).toHaveCount(0);
    await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    await expect(toggle).toBeFocused();
  });

  test("a link closes the menu after navigation and returns focus", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("persona-select").selectOption(ROEPER);
    await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
    // Der Persona-Wechsel navigiert zur Startseite und schliesst das Menue.
    await expect(page.locator("#app-nav")).toHaveCount(0);

    await page.getByTestId("menu-toggle").click();
    await page.getByRole("link", { name: "Planung" }).click();
    await expect(
      page.getByRole("heading", { name: "Ressourcenplanung" }),
    ).toBeVisible();
    await expect(page.locator("#app-nav")).toHaveCount(0);
    await expect(page.getByTestId("menu-toggle")).toBeFocused();
  });

  test("a cancelled navigation keeps the menu open and the input intact", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("menu-toggle").click();
    await page.getByTestId("persona-select").selectOption(ROEPER);
    await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
    await page.getByLabel("Tagesdatum").fill("2026-04-14");
    const breakInput = page.locator("label:has-text('Pause') input");
    await breakInput.fill("45");
    await expect(page.getByTestId("unsaved-hint")).toBeVisible();

    await page.getByTestId("menu-toggle").click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Planung" }).click();
    await expect(
      page.getByRole("heading", { name: "Stundenschreibung" }),
    ).toBeVisible();
    await expect(page.locator("#app-nav")).toBeVisible();
    await expect(page.getByTestId("menu-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.getByTestId("menu-close").click();
    await expect(breakInput).toHaveValue("45");
  });

  test("widening to desktop with an open menu removes inert and keeps focus visible", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("menu-toggle").click();
    await expect(page.locator("main")).toHaveAttribute("inert", "");

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId("menu-toggle")).toHaveCount(0);
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    await expect(page.getByTestId("menu-close")).toHaveCount(0);
    const focus = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        insideSidebar: !!active?.closest('[data-testid="sidebar"]'),
        visible: !!active && active.offsetParent !== null,
      };
    });
    expect(focus).toEqual({ insideSidebar: true, visible: true });
    // Auf dem Desktop faengt Tab nicht mehr: der Fokus verlaesst die Seitenleiste.
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(
      () => !!document.activeElement?.closest('[data-testid="sidebar"]'),
    );
    expect(stillInside).toBe(false);
  });
});
