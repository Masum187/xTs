import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-151: Layout- und Randfall-Abnahme der Genehmigung als Liste und
// Detailansicht bei 375, 768, 1024 und 1280 px.

const ROEPER = "christian.roeper@qualitytimes.de";
const WEBER = "maria.weber@qualitytimes.de";
const LONG_LINE =
  "Sehr lange Leistungsbeschreibung ohne Umbruchstellen_die_den_Rahmen_der_Zelle_sprengen_könnte_wenn_kein_Umbruch_erlaubt_wäre und danach noch ein zweiter Satz mit normalem Text.";
const LONG_REASON =
  "Abweichung wegen eines längeren Abstimmungstermins mit dem Kunden, der nicht auf eine Kontierung gebucht werden konnte; die Differenz ist mit dem Projektleiter abgestimmt und dokumentiert.";
const LONG_ERROR =
  "Wareneingang konnte nicht gebucht werden: Die Bestellung 4500001234 ist für die Buchungsperiode 04/2026 gesperrt. Bitte die Periode im Einkauf öffnen lassen und den Vorgang anschließend erneut auslösen. Referenz: SAP-Meldung M7 053 (Buchung nur in Periode 05/2026 möglich).";
const LONG_DAY = "2026-04-16";
// Werktage im April 2026 ohne Kollision mit Fixtures und anderen Specs.
const EXTRA_DAYS = ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23"];

async function seed(page: Page) {
  const request = page.request;
  await request.post(`${API}/TimesheetDays`, {
    data: {
      extNr: "SCHILZ",
      date: LONG_DAY,
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      varianceReason: LONG_REASON,
      lines: [
        { coIdent: "700000000004", description: LONG_LINE, hours: 3 },
        { coIdent: "700000000004", description: "Zweite Position", hours: 1.5 },
        { coIdent: "700000000004", description: "Dritte Position", hours: 1 },
        { coIdent: "600000000001", description: "Support (fremd)", hours: 1.5 },
      ],
    },
  });
  for (const date of EXTRA_DAYS) {
    await request.post(`${API}/TimesheetDays`, {
      data: {
        extNr: "SCHILZ",
        date,
        startTime: "08:00",
        endTime: "16:30",
        breakMinutes: 30,
        location: "remote",
        status: "F",
        lines: [{ coIdent: "700000000004", description: "Arbeit", hours: 8 }],
      },
    });
  }
}

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function openApprovals(page: Page, persona = ROEPER) {
  await page.goto("/");
  // Unter 1024 px liegen Persona-Wahl und Navigation im modalen Menue; der
  // Persona-Wechsel schliesst es wieder.
  await openNavIfNarrow(page);
  await page.getByTestId("persona-select").selectOption(persona);
  await openNavIfNarrow(page);
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(page.getByTestId("approval-list")).toBeVisible();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    const roots = document.querySelectorAll(
      ".list-panel, .detail-panel, .filters, .notice",
    );
    for (const root of roots) {
      const box = root.getBoundingClientRect();
      if (box.right > main.right + 0.5) out.push(`${root.className} > Inhalt`);
      for (const child of root.querySelectorAll(
        "button, input, select, span, p, h2, strong, em",
      )) {
        const inner = child.getBoundingClientRect();
        if (inner.width === 0) continue;
        if (inner.right > box.right + 0.5 || inner.left < box.left - 0.5) {
          out.push(`${child.tagName.toLowerCase()} ragt aus ${root.className}`);
        }
      }
    }
    return [...new Set(out)];
  });
  expect(issues, label).toEqual([]);
}

async function selectedKey(page: Page) {
  return page
    .getByTestId("approval-list")
    .locator('[aria-current="true"]')
    .getAttribute("data-testid");
}

for (const width of [375, 768, 1024, 1280]) {
  test(`list and detail hold long texts at ${width} px`, async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width, height: 900 });
    // Weber ist nur fuer 700000000004 zustaendig: fremde Positionen sind
    // markiert, der Hinweis zur gesamthaften Tagesfreigabe erscheint.
    await openApprovals(page, WEBER);
    const list = page.getByTestId("approval-list");
    const detail = page.getByTestId("approval-detail");

    // Erster Eintrag ist vorausgewaehlt, Detail zeigt ihn.
    const first = await list
      .getByRole("button")
      .first()
      .getAttribute("data-testid");
    expect(await selectedKey(page)).toBe(first);

    // Langer Tag: alle Positionen, lange Texte, Abweichung mit Begruendung,
    // fremde Position mit Hinweis auf gesamthafte Tagesfreigabe. Die
    // Genehmigung zeigt wie bisher die Kontierungsnummer, nicht die
    // Bezeichnung.
    await page.getByTestId(`approval-SCHILZ-${LONG_DAY}`).click();
    await expect(detail).toContainText("zweiter Satz mit normalem Text");
    await expect(detail).toContainText("Support (fremd)");
    await expect(detail).toContainText("nicht in Ihrer Zuständigkeit");
    await expect(page.getByTestId(`variance-SCHILZ-${LONG_DAY}`)).toContainText(
      "abgestimmt und dokumentiert",
    );
    await expect(
      page.getByTestId(`scope-note-SCHILZ-${LONG_DAY}`),
    ).toBeVisible();
    await expect(detail.locator(".approval-line")).toHaveCount(4);
    await expectContained(page, `${width} px: Detail`);

    // Liste und Detail: nebeneinander ab 1280 px, darunter untereinander und
    // das Detail nach der Auswahl im sichtbaren Bereich.
    const layout = await page.evaluate(() => {
      const list = document
        .querySelector(".list-panel")!
        .getBoundingClientRect();
      const detail = document
        .querySelector(".detail-panel")!
        .getBoundingClientRect();
      return {
        sideBySide:
          Math.abs(list.top - detail.top) < 1 && detail.left > list.right - 1,
        stacked:
          detail.top >= list.bottom - 1 &&
          Math.abs(list.left - detail.left) < 1,
      };
    });
    if (width >= 1280) {
      expect(layout.sideBySide).toBe(true);
    } else {
      expect(layout.stacked).toBe(true);
      await expect
        .poll(async () => {
          const box = await detail.boundingBox();
          return box !== null && box.y >= 0 && box.y < 900;
        })
        .toBe(true);
    }

    // Mehrzeilige Servermeldung: Eintrag, Auswahl und Grund bleiben erhalten.
    await page.route(`${API}/TimesheetApprovals`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "WE_FAILED", message: LONG_ERROR }),
      });
    });
    await page.getByTestId(`reject-SCHILZ-${LONG_DAY}`).click();
    await page.getByLabel("Rückweisungsgrund").fill("Bitte Positionen prüfen.");
    await page.getByTestId("confirm-reject").click();
    await expect(page.getByTestId("approval-message")).toContainText(
      "Periode 05/2026",
    );
    await expect(page.getByTestId(`approval-SCHILZ-${LONG_DAY}`)).toBeVisible();
    expect(await selectedKey(page)).toBe(`approval-SCHILZ-${LONG_DAY}`);
    await expect(page.getByLabel("Rückweisungsgrund")).toHaveValue(
      "Bitte Positionen prüfen.",
    );
    await expectContained(page, `${width} px: Servermeldung`);
    await page.unroute(`${API}/TimesheetApprovals`);
  });
}

test("selection moves on in the current order after an action", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApprovals(page);
  const list = page.getByTestId("approval-list");
  await page.getByLabel("Mitarbeiter").selectOption("SCHILZ");
  const keys = async () =>
    list
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-testid")),
      );
  const before = await keys();
  expect(before.length).toBeGreaterThanOrEqual(6);

  // Erster Eintrag: danach der naechste in der Reihenfolge.
  await page.getByTestId(before[0]!).click();
  await page.getByTestId(before[0]!.replace("approval-", "approve-")).click();
  await expect(page.getByTestId("approval-message")).toContainText("genehmigt");
  await expect(page.getByTestId(before[0]!)).toHaveCount(0);
  expect(await selectedKey(page)).toBe(before[1]);

  // Letzter Eintrag: danach der vorherige.
  const afterFirst = await keys();
  const last = afterFirst[afterFirst.length - 1]!;
  await page.getByTestId(last).click();
  await page.getByTestId(last.replace("approval-", "reject-")).click();
  await page.getByLabel("Rückweisungsgrund").fill("Letzter Eintrag.");
  await page.getByTestId("confirm-reject").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "zurückgewiesen",
  );
  expect(await selectedKey(page)).toBe(afterFirst[afterFirst.length - 2]);

  // Leere Liste: keine Auswahl, Leerzustand.
  await page.getByLabel("Leistungsmonat").selectOption("2026-04");
  for (;;) {
    const remaining = await keys();
    if (remaining.length === 0) break;
    await page.getByTestId(remaining[0]!).click();
    await page
      .getByTestId(remaining[0]!.replace("approval-", "approve-"))
      .click();
    await expect(page.getByTestId(remaining[0]!)).toHaveCount(0);
  }
  await expect(page.getByTestId("approval-empty")).toBeVisible();
  await expect(page.getByTestId("approval-detail-empty")).toBeVisible();
});

test("a rejection reason stays with its day and actions lock selection and filters", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApprovals(page);
  const dayA = `approval-SCHILZ-${LONG_DAY}`;
  const dayB = `approval-SCHILZ-${EXTRA_DAYS[0]}`;

  // Grund an Tag A beginnen, Tag B waehlen: kein Grund an Tag B.
  await page.getByTestId(dayA).click();
  await page.getByTestId(`reject-SCHILZ-${LONG_DAY}`).click();
  await page.getByLabel("Rückweisungsgrund").fill("Nur für Tag A.");
  await page.getByTestId(dayB).click();
  await expect(page.getByLabel("Rückweisungsgrund")).toHaveCount(0);
  await page.getByTestId(`reject-SCHILZ-${EXTRA_DAYS[0]}`).click();
  await expect(page.getByLabel("Rückweisungsgrund")).toHaveValue("");
  await page.getByRole("button", { name: "Abbrechen" }).click();

  // Waehrend der Aktion sind Auswahl und Filter gesperrt.
  await page.route(`${API}/TimesheetApprovals`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.getByTestId(`approve-SCHILZ-${EXTRA_DAYS[0]}`).click();
  await expect(page.getByTestId(dayA)).toBeDisabled();
  await expect(page.getByLabel("Leistungsmonat")).toBeDisabled();
  await expect(page.getByLabel("Mitarbeiter")).toBeDisabled();
  await expect(page.getByTestId("approval-message")).toContainText("genehmigt");
  await expect(page.getByTestId(dayA)).toBeEnabled();
  await expect(page.getByLabel("Leistungsmonat")).toBeEnabled();
});

test("selection works by keyboard and stays reachable on narrow views", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 640 });
  await openApprovals(page);
  const list = page.getByTestId("approval-list");
  const entries = list.getByRole("button");
  await entries.first().focus();
  await page.keyboard.press("Tab");
  await expect(entries.nth(1)).toBeFocused();
  const outline = await entries
    .nth(1)
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(entries.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(entries.first()).not.toHaveAttribute("aria-current", "true");

  // Lange Liste: letzter Eintrag waehlen, Detail landet im sichtbaren Bereich.
  const last = entries.last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute("aria-current", "true");
  await expect
    .poll(async () => {
      const box = await page.getByTestId("approval-detail").boundingBox();
      return box !== null && box.y >= 0 && box.y < 640;
    })
    .toBe(true);
  await expectContained(page, "375 px: Auswahl");
});
