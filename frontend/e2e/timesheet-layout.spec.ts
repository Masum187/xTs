import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-150: Layout-Abnahme der Stundenschreibung im Werkbank-Raster bei
// 375, 768, 1024 und 1280 px inkl. langer Texte und mehrzeiliger Meldungen.

const ADMIN = { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" };
// Ohne Komma: die Zuordnung uebernimmt nur den Teil vor dem ersten Komma.
const LONG_DESCRIPTION =
  "Sehr lange Kontierungsbezeichnung für die Layout-Abnahme: SAP-Implementierung Phase 2 mit Integrationstests und Datenmigration sowie Übergabe an den Betrieb (ÄÖÜ äöü ß)";
const LONG_REASON =
  "Bitte die Positionsbeschreibungen präzisieren: Für jede Position muss erkennbar sein, welches Arbeitspaket, welcher Kunde und welche Abstimmung betroffen war; außerdem fehlt die Begründung der Abweichung zwischen Arbeitszeit und Positionssumme. Danke.";

async function seedLongTexts(page: Page) {
  const request = page.request;
  await request.post(`${API}/CostObjects`, {
    headers: ADMIN,
    data: {
      coIdent: "700000000004",
      type: "OR",
      description: LONG_DESCRIPTION,
      active: true,
    },
  });
  // Die Kontingentzeile traegt die Bezeichnung der Zuordnung; diese wird
  // beim Upsert aus der Kontierung abgeleitet.
  await request.post(`${API}/CostObjectAssignments`, {
    headers: ADMIN,
    data: {
      id: "000001",
      extNr: "SCHILZ",
      coIdent: "700000000004",
      validFrom: "2026-02-01",
      validTo: "2027-02-28",
    },
  });
  await request.post(`${API}/TimesheetDays`, {
    data: {
      extNr: "SCHILZ",
      date: "2026-04-16",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      lines: [
        {
          coIdent: "700000000004",
          description:
            "Sehr lange Leistungsbeschreibung ohne Umbruchstellen_die_den_Rahmen_der_Zelle_sprengen_könnte_wenn_kein_Umbruch_erlaubt_wäre",
          hours: 8.5,
        },
      ],
    },
  });
  await request.post(`${API}/TimesheetApprovals`, {
    headers: ADMIN,
    data: {
      extNr: "SCHILZ",
      date: "2026-04-16",
      action: "reject",
      reason: LONG_REASON,
    },
  });
}

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    for (const cell of document.querySelectorAll(".ts-grid .xts-cell")) {
      const box = cell.getBoundingClientRect();
      if (box.right > main.right + 0.5) out.push("Zelle > Inhaltsbereich");
      for (const child of cell.querySelectorAll(
        "input, select, button, span, li",
      )) {
        const inner = child.getBoundingClientRect();
        if (inner.width === 0) continue;
        if (inner.right > box.right + 0.5 || inner.left < box.left - 0.5) {
          out.push(`${child.tagName.toLowerCase()} ragt aus Zelle`);
        }
      }
    }
    for (const notice of document.querySelectorAll(
      ".notice, .problems, .actions",
    )) {
      const box = notice.getBoundingClientRect();
      if (box.right > main.right + 0.5)
        out.push(`${notice.className} > Inhaltsbereich`);
    }
    return [...new Set(out)];
  });
  expect(issues, label).toEqual([]);
}

for (const width of [375, 768, 1024, 1280]) {
  test(`timesheet grid holds long texts and multi-line notices at ${width} px`, async ({
    page,
  }) => {
    await seedLongTexts(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

    // Zurueckgewiesener Tag mit langer Begruendung und langer Beschreibung.
    await page.getByLabel("Tagesdatum").fill("2026-04-16");
    await expect(page.getByTestId("rejection-banner")).toContainText("Danke.");
    await expect(page.getByTestId("cost-object-list")).toContainText(
      "Datenmigration sowie Übergabe an den Betrieb",
    );
    await expectContained(page, `${width} px: Rueckweisung`);

    // Mehrzeilige Problemliste: zweite Position ohne Beschreibung mit 24 Std.
    await page.getByLabel("Kontierung").selectOption("700000000004");
    await page.getByTestId("add-line").click();
    await page.getByLabel("Stunden").last().fill("24");
    const problems = page.getByTestId("timesheet-problems");
    await expect(problems).toContainText(
      "Beschreibung ist für die Freigabe Pflicht",
    );
    await expect(problems).toContainText("24 Stunden nicht überschreiten");
    await expectContained(page, `${width} px: Probleme`);

    // Halbzellen: ab 1280 px nebeneinander, darunter untereinander.
    const layout = await page.evaluate(() => {
      const quota = document
        .querySelector('[data-testid="quota-cell"]')!
        .getBoundingClientRect();
      const positions = document
        .querySelector('[data-testid="positions-cell"]')!
        .getBoundingClientRect();
      const columns = getComputedStyle(
        document.querySelector(".ts-grid")!,
      ).gridTemplateColumns.split(" ").length;
      return {
        columns,
        sideBySide:
          Math.abs(quota.top - positions.top) < 1 &&
          positions.left > quota.left,
        stacked:
          positions.top >= quota.bottom - 1 &&
          Math.abs(quota.left - positions.left) < 1,
      };
    });
    if (width >= 1280) {
      expect(layout.columns).toBe(4);
      expect(layout.sideBySide).toBe(true);
    } else if (width > 480) {
      expect(layout.columns).toBe(2);
      expect(layout.stacked).toBe(true);
    } else {
      expect(layout.columns).toBe(1);
      expect(layout.stacked).toBe(true);
    }

    // Fokusring auf Feldern per Tastatur.
    // Tastaturfokus: Zeitfelder haben interne Segmente, daher bis zum
    // Geht-Feld tabben und dort den Fokusring pruefen.
    await page.locator("label:has-text('Kommt') input").focus();
    const geht = page.locator("label:has-text('Geht') input");
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Tab");
      if (await geht.evaluate((element) => element === document.activeElement))
        break;
    }
    await expect(geht).toBeFocused();
    const outline = await geht.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    );
    expect(outline).toBe("solid");
    await openNavIfNarrow(page);
    await expect(page.getByTestId("sidebar")).toBeVisible();
  });
}
