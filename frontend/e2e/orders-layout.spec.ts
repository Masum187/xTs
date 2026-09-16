import type { APIRequestContext, Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-153: Layout- und Zustandsabnahme des Beauftragungsboards bei 375,
// 768, 1024 und 1280 px: drei Spalten, unabhaengige Ladezustaende,
// geschuetzte Textpuffer, Spaltenwechsel erst nach Servererfolg, lesbare
// Belegnummern.

const ROEPER = "christian.roeper@qualitytimes.de";
const PLANNER = { "x-mock-oauth-upn": ROEPER };
const LONG_TEXT =
  "Sehr langer BANF-Positionstext für die Layout-Abnahme: SAP-Implementierung Phase 2 mit Integrationstests, Datenmigration und Übergabe an den Betrieb, inklusive Abstimmungen mit Einkauf und Controlling (ÄÖÜ äöü ß) sowie einer_langen_Kette_ohne_Umbruchstellen_die_kontrolliert_umbrechen_muss";

async function seedReleased(
  request: APIRequestContext,
  extNr: string,
  coIdent: string,
  month: string,
  hours: number,
) {
  await request.post(`${API}/PlanningEntries`, {
    headers: PLANNER,
    data: { extNr, coIdent, month, hours },
  });
  await request.post(`${API}/PlanningReleases`, {
    headers: PLANNER,
    data: { extNr, coIdent, month },
  });
}

/** Kandidat -> Beauftragung -> BANF -> Bestellung per API, fuer Spalte 3. */
async function seedChain(request: APIRequestContext) {
  await seedReleased(request, "SCHILZ", "700000000004", "2026-06", 50);
  await seedReleased(request, "SCHILZ", "600000000001", "2026-04", 25);
  const created = await request.post(`${API}/Orders`, {
    headers: PLANNER,
    data: {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-06"],
      text: LONG_TEXT,
    },
  });
  // V2-Form verpackt Entitaeten in `d`.
  const body = (await created.json()) as {
    d?: { orderId: string };
    orderId?: string;
  };
  const order = { orderId: (body.d ?? body).orderId as string };
  await request.post(`${API}/OrderBanfs`, {
    headers: PLANNER,
    data: { orderId: order.orderId },
  });
  await request.post(`${API}/PurchaseOrderSyncRuns`, {
    headers: PLANNER,
    data: {},
  });
  return order.orderId;
}

/** Zaehler entsprechen den tatsaechlich dargestellten Karten je Spalte. */
async function expectCountsMatchCards(page: Page) {
  const candidates = await page
    .getByTestId("candidate-list")
    .locator(".card")
    .count();
  await expect(page.getByTestId("candidates-count")).toHaveText(
    new RegExp(`^\\s*${candidates} Vorschläge\\s*$`),
  );
  const columns = page.locator(".order-columns .column");
  const open = await columns.nth(0).locator(".card").count();
  const done = await columns.nth(1).locator(".card").count();
  await expect(page.getByTestId("open-count")).toHaveText(
    new RegExp(`^\\s*${open} offen\\s*$`),
  );
  await expect(page.getByTestId("done-count")).toHaveText(
    new RegExp(`^\\s*${done} bestellt\\s*$`),
  );
  return { candidates, open, done };
}

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function openOrders(page: Page) {
  await page.goto("/");
  await openNavIfNarrow(page);
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await openNavIfNarrow(page);
  await page.getByRole("link", { name: "Beauftragung" }).click();
  await expect(
    page.getByRole("heading", { name: "Beauftragung", exact: true }),
  ).toBeVisible();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    for (const panel of document.querySelectorAll(
      ".column, .protocol-panel, .notice",
    )) {
      const box = panel.getBoundingClientRect();
      if (box.right > main.right + 0.5) out.push(`${panel.className} > Inhalt`);
      for (const child of panel.querySelectorAll(
        "button, input, span, p, dd, strong",
      )) {
        const inner = child.getBoundingClientRect();
        if (inner.width === 0) continue;
        if (inner.right > box.right + 0.5 || inner.left < box.left - 0.5) {
          out.push(
            `${child.tagName.toLowerCase()} ragt aus ${panel.className}`,
          );
        }
      }
    }
    for (const number of document.querySelectorAll(".chain dd")) {
      const style = getComputedStyle(number);
      if (style.whiteSpace === "nowrap" || style.textOverflow === "ellipsis") {
        out.push("Belegnummer nowrap oder abgeschnitten");
      }
    }
    // Beschriftungen der Belegkette: nicht abgeschnitten, keine Ueberlappung.
    for (const chain of document.querySelectorAll(".chain")) {
      const fields = [...chain.querySelectorAll(":scope > div")];
      for (const field of fields) {
        const label = field.querySelector("dt")!;
        if (label.scrollWidth > label.clientWidth + 0.5) {
          out.push(`Beschriftung "${label.textContent?.trim()}" abgeschnitten`);
        }
      }
      const boxes = fields.map((field) => field.getBoundingClientRect());
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlapX =
            Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY =
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 0.5 && overlapY > 0.5)
            out.push("Belegkette ueberlappt");
        }
      }
    }
    return [...new Set(out)];
  });
  expect(issues, label).toEqual([]);
}

for (const width of [375, 768, 1024, 1280]) {
  test(`board columns and cards fit at ${width} px`, async ({
    page,
    request,
  }) => {
    const orderId = await seedChain(request);
    await page.setViewportSize({ width, height: 900 });
    await openOrders(page);

    // Drei Spalten mit Karten: Vorschlag, Angelegt/BANF, Bestellung.
    await expect(
      page.getByTestId("candidate-SCHILZ-600000000001"),
    ).toBeVisible();
    await expect(page.getByTestId("candidates-count")).toContainText(
      "Vorschläge",
    );
    const purchased = page.getByTestId(`order-${orderId}`);
    await expect(purchased).toContainText("Bestellung vorhanden");
    await expect(purchased).toContainText("4500001234/00010");
    await expect(purchased).toContainText("kontrolliert_umbrechen_muss");
    await expect(page.getByTestId("orders-open-empty")).toBeVisible();
    await expect(page.getByTestId("order-protocol")).toBeVisible();
    const counts = await expectCountsMatchCards(page);
    expect(counts.done).toBeGreaterThanOrEqual(1);

    const layout = await page.evaluate(() => {
      const columns = [...document.querySelectorAll(".board .column")].map(
        (el) => el.getBoundingClientRect(),
      );
      const tops = columns.map((box) => box.top);
      return {
        count: columns.length,
        sideBySide: tops.every((top) => Math.abs(top - tops[0]!) < 1),
        stacked: columns.every((box, index) =>
          index === 0 ? true : box.top >= columns[index - 1]!.bottom - 1,
        ),
      };
    });
    expect(layout.count).toBe(3);
    if (width >= 1280) expect(layout.sideBySide).toBe(true);
    else expect(layout.stacked).toBe(true);
    await expectContained(page, `${width} px`);

    // Tastatur: Aktion der Kandidatenkarte erreichbar mit sichtbarem Fokus.
    const create = page.getByTestId("create-order-SCHILZ-600000000001");
    await page
      .getByTestId("candidate-SCHILZ-600000000001")
      .getByLabel("BANF-Positionstext")
      .focus();
    await page.keyboard.press("Tab");
    await expect(create).toBeFocused();
    expect(
      await create.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("solid");
  });
}

test("load errors keep the other columns and never look like empty columns", async ({
  page,
  request,
}) => {
  const orderId = await seedChain(request);
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = { candidates: false, orders: false };
  await page.route(`${API}/OrderCandidates*`, async (route) => {
    if (!state.candidates) return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "INTERNAL", message: "Kandidaten weg" }),
    });
  });
  await page.route(`${API}/Orders*`, async (route) => {
    if (!state.orders || route.request().method() !== "GET")
      return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "INTERNAL",
        message: "Beauftragungen weg",
      }),
    });
  });

  // Beauftragungen scheitern beim ersten Laden: Fehler statt leerer Spalten,
  // Kandidaten bleiben bedienbar.
  state.orders = true;
  await openOrders(page);
  const ordersArea = page.getByTestId("orders-table");
  await expect(ordersArea.getByTestId("load-error")).toContainText(
    "Beauftragungen weg",
  );
  await expect(page.getByTestId("orders-open-empty")).toHaveCount(0);
  await expect(page.getByTestId("orders-done-empty")).toHaveCount(0);
  await expect(page.getByTestId("order-protocol")).toHaveCount(0);
  await expect(page.getByTestId("candidate-SCHILZ-600000000001")).toBeVisible();
  state.orders = false;
  await ordersArea.getByTestId("retry").click();
  await expect(page.getByTestId(`order-${orderId}`)).toBeVisible();
  await expect(page.getByTestId("order-protocol")).toBeVisible();
  const counts = await expectCountsMatchCards(page);

  // Kandidatenfilter scheitert: nur Spalte 1 zeigt den Fehler; der Zaehler
  // zeigt keinen veralteten Wert.
  state.candidates = true;
  await page.getByLabel("Mitarbeiter-Nr.").fill("ROEPER");
  await expect(page.getByTestId("load-error")).toContainText("Kandidaten weg");
  await expect(page.getByTestId("candidate-list")).toHaveCount(0);
  await expect(page.getByTestId("candidates-count")).toHaveText(/unbekannt/);
  await expect(page.getByTestId("candidates-count")).not.toHaveText(/\d/);
  await expect(page.getByTestId("candidates-empty")).toHaveCount(0);
  await expect(ordersArea).toBeVisible();
  await expect(page.getByTestId("done-count")).toHaveText(
    new RegExp(`${counts.done} bestellt`),
  );
  await expect(page.getByTestId("order-protocol")).toBeVisible();
  state.candidates = false;
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("candidate-ROEPER-600000000001")).toBeVisible();
  await expectCountsMatchCards(page);
});

test("text buffers survive failures and BANF waits for the saved text", async ({
  page,
  request,
}) => {
  await seedReleased(request, "SCHILZ", "700000000004", "2026-06", 50);
  await page.setViewportSize({ width: 1024, height: 900 });
  const state = { failPost: false, delay: 0 };
  await page.route(`${API}/Orders`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (state.delay)
      await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.failPost) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Anlegen weg" }),
      });
      return;
    }
    await route.continue();
  });
  await openOrders(page);
  const candidate = page.getByTestId("candidate-SCHILZ-700000000004");
  const candidateText = candidate.getByLabel("BANF-Positionstext");
  await candidateText.fill("Text bleibt nach Fehler");

  // Fehlgeschlagenes Anlegen: Kandidat und Text bleiben.
  state.failPost = true;
  await candidate.getByTestId("create-order-SCHILZ-700000000004").click();
  await expect(page.getByTestId("orders-message")).toContainText("Anlegen weg");
  await expect(candidate).toBeVisible();
  await expect(candidateText).toHaveValue("Text bleibt nach Fehler");
  const before = await expectCountsMatchCards(page);

  // Verzoegertes Anlegen: kein optimistischer Wechsel, Ausloeser gesperrt.
  state.failPost = false;
  state.delay = 1200;
  await candidate.getByTestId("create-order-SCHILZ-700000000004").click();
  await expect(page.getByTestId("run-po-sync")).toBeDisabled();
  await expect(candidate).toBeVisible();
  await expect(page.getByTestId("open-count")).toHaveText(
    new RegExp(`${before.open} offen`),
  );
  await expect(page.getByTestId("orders-message")).toContainText("angelegt");
  await expect(candidate).toHaveCount(0);
  const after = await expectCountsMatchCards(page);
  expect(after.open).toBe(before.open + 1);
  expect(after.candidates).toBe(before.candidates - 1);
  state.delay = 0;
  const card = page.getByTestId("order-BEAUF-000001");
  const cardText = card.getByLabel("BANF-Positionstext BEAUF-000001");
  await expect(cardText).toHaveValue("Text bleibt nach Fehler");

  // Ungespeicherter Text: BANF gesperrt, auch erzwungen kein Request;
  // fehlgeschlagenes Speichern erhaelt den Text.
  await cardText.fill("Neuer Text ungespeichert");
  await expect(card.getByTestId("text-unsaved-BEAUF-000001")).toBeVisible();
  const banf = card.getByTestId("create-banf-BEAUF-000001");
  await expect(banf).toBeDisabled();
  const banfRequests: string[] = [];
  await page.route(`${API}/OrderBanfs`, async (route) => {
    banfRequests.push(route.request().url());
    await route.continue();
  });
  await banf.dispatchEvent("click");
  await expect(page.getByTestId("orders-message")).toContainText(
    "zuerst speichern",
  );
  expect(banfRequests).toEqual([]);
  state.failPost = true;
  await card.getByTestId("save-text-BEAUF-000001").click();
  await expect(page.getByTestId("orders-message")).toContainText("Anlegen weg");
  await expect(cardText).toHaveValue("Neuer Text ungespeichert");
  await expect(banf).toBeDisabled();

  // Erfolgreiches Speichern gibt die BANF frei; Wechsel erst nach Erfolg.
  state.failPost = false;
  await card.getByTestId("save-text-BEAUF-000001").click();
  await expect(page.getByTestId("orders-message")).toContainText("gespeichert");
  await expect(card.getByTestId("text-unsaved-BEAUF-000001")).toHaveCount(0);
  await expect(banf).toBeEnabled();
  await banf.click();
  await expect(card).toContainText("BANF vorhanden");
  await expect(card).toContainText("Neuer Text ungespeichert");
  expect(banfRequests.length).toBe(1);
  const final = await expectCountsMatchCards(page);
  expect(final.done).toBe(after.done);
});
