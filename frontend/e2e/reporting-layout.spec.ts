import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-155: Layout- und Zustandsabnahme des Reportings bei 375, 768, 1024
// und 1280 px: vollstaendige Tabellen, seitlich scrollbar im eigenen,
// per Tastatur bedienbaren Container; Ampel mit Text und Kontrast; Lade-,
// Fehler-, Retry- und Leerzustaende aller drei Reports.

const ROEPER = "christian.roeper@qualitytimes.de";
const WEBER = "maria.weber@qualitytimes.de";
const ADMIN = { "x-mock-oauth-upn": ROEPER };
// Ohne Komma: die Zuordnung uebernimmt nur den Teil vor dem ersten Komma.
const LONG_DESCRIPTION =
  "Sehr lange Kontierungsbezeichnung für die Layout-Abnahme: SAP-Implementierung Phase 2 mit Integrationstests und Datenmigration sowie Übergabe an den Betrieb (ÄÖÜ äöü ß)";

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: number[], b: number[]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function parseRgb(value: string): number[] {
  return (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
}

async function seedLongTexts(page: Page) {
  await page.request.post(`${API}/CostObjects`, {
    headers: ADMIN,
    data: {
      coIdent: "700000000004",
      type: "OR",
      description: LONG_DESCRIPTION,
      active: true,
    },
  });
}

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function openReporting(page: Page, persona = ROEPER) {
  await page.goto("/");
  await openNavIfNarrow(page);
  await page.getByTestId("persona-select").selectOption(persona);
  await openNavIfNarrow(page);
  await page.getByRole("link", { name: "Reporting" }).click();
  await expect(page.getByRole("heading", { name: "Reporting" })).toBeVisible();
  await expect(page.getByTestId("lifecycle-table")).toBeVisible();
  await expect(page.getByTestId("budget-table")).toBeVisible();
  await expect(page.getByTestId("quota-table")).toBeVisible();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    for (const panel of document.querySelectorAll(".report-panel")) {
      const box = panel.getBoundingClientRect();
      if (box.right > main.right + 0.5 || box.left < main.left - 0.5) {
        out.push("Report ragt aus dem Inhaltsbereich");
      }
      for (const field of panel.querySelectorAll(
        ".filters input, .filters select, .filters label",
      )) {
        const inner = field.getBoundingClientRect();
        if (inner.right > box.right + 0.5)
          out.push("Filter ragt aus dem Report");
      }
      const wrap = panel.querySelector(".table-wrap")!;
      const wrapBox = wrap.getBoundingClientRect();
      if (wrapBox.right > box.right + 0.5)
        out.push("Tabellenbereich ragt aus dem Report");
      if (getComputedStyle(wrap).overflowX !== "auto")
        out.push("Tabellenbereich nicht scrollbar");
    }
    return [...new Set(out)];
  });
  expect(issues, label).toEqual([]);
}

for (const width of [375, 768, 1024, 1280]) {
  test(`reports keep all columns inside scrollable containers at ${width} px`, async ({
    page,
  }) => {
    await seedLongTexts(page);
    await page.setViewportSize({ width, height: 900 });
    await openReporting(page);

    // Alle Detailstufen eingeschaltet, lange Bezeichnung, Teamname mit
    // Sonderzeichen in der Auswahl.
    await page.getByLabel("Detailstufe").selectOption("day");
    await expect(page.getByTestId("budget-table")).toContainText(
      "Datenmodell Review",
    );
    await page.getByLabel("Tagesdetails").check();
    await expect(page.getByTestId("quota-table")).toContainText(
      "Datenmodell Review",
    );
    await expect(page.getByTestId("budget-700000000004")).toContainText(
      "Datenmigration sowie Übergabe",
    );
    await expect(
      page
        .getByLabel("Team")
        .locator("option", { hasText: "Entwicklung & Support (Süd)" }),
    ).toHaveCount(1);
    await expectContained(page, `${width} px`);

    // Zwoelf Spalten: unterhalb der Inhaltsbreite scrollt der Container, nicht
    // die Seite; alle Spalten bleiben vorhanden.
    const lifecycle = page.getByTestId("lifecycle-table");
    await expect(lifecycle.locator("thead th")).toHaveCount(12);
    const overflow = await lifecycle.evaluate((table) => {
      const wrap = table.parentElement!;
      return { scroll: wrap.scrollWidth, client: wrap.clientWidth };
    });
    if (width <= 768) expect(overflow.scroll).toBeGreaterThan(overflow.client);

    // Ampel: Text ohne Farberkennung, Kontrast der lokalen Farben >= 4,5:1.
    const traffic = page.getByTestId("traffic-700000000004");
    await expect(traffic).toHaveText(/im Plan|Warnung|kritisch/);
    const ratios = await traffic.evaluate((element) => {
      return ["green", "yellow", "red"].map((light) => {
        const probe = document.createElement("span");
        // Angulars Style-Scope-Attribut uebernehmen, sonst greifen die
        // Komponentenstyles nicht.
        for (const attribute of element.getAttributeNames()) {
          if (attribute.startsWith("_ngcontent"))
            probe.setAttribute(attribute, "");
        }
        probe.className = `traffic ${light}`;
        element.parentElement!.append(probe);
        const style = getComputedStyle(probe);
        const result = {
          light,
          color: style.color,
          background: style.backgroundColor,
        };
        probe.remove();
        return result;
      });
    });
    for (const ratio of ratios) {
      expect(
        contrast(parseRgb(ratio.color), parseRgb(ratio.background)),
        ratio.light,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("table regions are keyboard operable, named and without focus trap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openReporting(page);
  const region = page.getByRole("region", {
    name: "Tabelle Ressourcen-Live-Circle, seitlich scrollbar",
  });
  await expect(region).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Tabelle Budget-Monitor, seitlich scrollbar",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Tabelle Stundenkontingent-Monitor, seitlich scrollbar",
    }),
  ).toBeVisible();

  // Vom letzten Filter per Tab in den Scrollbereich, sichtbarer Fokus,
  // Pfeiltaste scrollt, naechstes Tab verlaesst den Bereich.
  await page.getByLabel("Bestellposition").focus();
  await page.keyboard.press("Tab");
  await expect(region).toBeFocused();
  expect(await region.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "solid",
  );
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => region.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Detailstufe")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(region).toBeFocused();
});

test("failed and slow reloads never show old rows as current results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = { fail: false, delay: 0 };
  for (const entity of [
    "ResourceLifecycle",
    "BudgetMonitor",
    "CostObjectQuota",
  ]) {
    await page.route(`${API}/${entity}*`, async (route) => {
      if (state.delay)
        await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.fail) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "INTERNAL", message: `${entity} weg` }),
        });
        return;
      }
      await route.continue();
    });
  }
  await openReporting(page);
  const sections = {
    lifecycle: page.locator(".report-panel", {
      hasText: "Ressourcen-Live-Circle",
    }),
    budget: page.locator(".report-panel", { hasText: "Budget-Monitor" }),
    quota: page.locator(".report-panel", {
      hasText: "Stundenkontingent-Monitor",
    }),
  };

  // Fehler beim Nachladen je Report: Fehlerzustand mit erneutem Versuch,
  // alte Zeilen verschwinden, die anderen Reports bleiben sichtbar.
  state.fail = true;
  await page.getByLabel("Einkaufsbeleg").fill("4500002001");
  await expect(sections.lifecycle.getByTestId("load-error")).toContainText(
    "ResourceLifecycle weg",
  );
  await expect(page.getByTestId("lifecycle-table")).toHaveCount(0);
  await expect(page.getByTestId("budget-table")).toBeVisible();
  await expect(page.getByTestId("quota-table")).toBeVisible();

  await page.getByLabel("Detailstufe").selectOption("employee");
  await expect(sections.budget.getByTestId("load-error")).toContainText(
    "BudgetMonitor weg",
  );
  await expect(page.getByTestId("budget-table")).toHaveCount(0);

  await page.getByLabel("Tagesdetails").check();
  await expect(sections.quota.getByTestId("load-error")).toContainText(
    "CostObjectQuota weg",
  );
  await expect(page.getByTestId("quota-table")).toHaveCount(0);

  // Erneuter Versuch laedt mit den aktuellen Filtern und Detailstufen.
  state.fail = false;
  await sections.lifecycle.getByTestId("retry").click();
  await expect(page.getByTestId("lifecycle-SCHILZ-600000000001")).toBeVisible();
  await expect(page.getByTestId("lifecycle-SCHILZ-700000000004")).toHaveCount(
    0,
  );
  await sections.budget.getByTestId("retry").click();
  await expect(page.getByTestId("budget-table")).toContainText(
    "Stephan Schilz",
  );
  await expect(page.getByTestId("budget-table")).not.toContainText(
    "Datenmodell Review",
  );
  await sections.quota.getByTestId("retry").click();
  await expect(page.getByTestId("quota-table")).toContainText(
    "Datenmodell Review",
  );

  // Langsames Nachladen: Ladezustand statt alter Zeilen.
  state.delay = 800;
  await page.getByLabel("Detailstufe").selectOption("day");
  await expect(sections.budget.getByTestId("loading")).toContainText(
    "Budget-Monitor wird geladen",
  );
  await expect(page.getByTestId("budget-table")).toHaveCount(0);
  await expect(page.getByTestId("budget-table")).toContainText(
    "Datenmodell Review",
  );
});

test("all three reports show their empty states", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await openReporting(page);
  await page.getByLabel("Bestellposition").fill("00099");
  await expect(page.getByTestId("lifecycle-empty")).toBeVisible();
  await page.getByLabel("Nachname").fill("gibtesnicht");
  await expect(page.getByTestId("quota-empty")).toBeVisible();

  // Genehmiger ohne Zuordnung: Budget-Monitor ohne Kontierungen.
  const assignment = {
    id: "000004",
    coIdent: "700000000004",
    extNr: "WEBER",
    deputy: true,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  };
  await page.request.post(`${API}/CostObjectApprovers`, {
    headers: ADMIN,
    data: { ...assignment, deleted: true },
  });
  await openReporting(page, WEBER);
  await expect(page.getByTestId("budget-empty")).toBeVisible();
  await expect(page.getByTestId("lifecycle-empty")).toBeVisible();
  await expect(page.getByTestId("quota-empty")).toBeVisible();
  await page.request.post(`${API}/CostObjectApprovers`, {
    headers: ADMIN,
    data: assignment,
  });
});
