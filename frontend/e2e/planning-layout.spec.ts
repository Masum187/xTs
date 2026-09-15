import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-152: Layout- und Randfall-Abnahme der Planungsmatrix mit Pager und
// Zelleneditor bei 375, 768, 1024 und 1280 px.

const ROEPER = "christian.roeper@qualitytimes.de";
const CELL = "cell-SCHILZ-700000000004-2026-05";
const INPUT = "input-SCHILZ-700000000004-2026-05";
const OTHER = "cell-SCHILZ-700000000004-2026-06";

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function openPlanning(page: Page) {
  await page.goto("/");
  await openNavIfNarrow(page);
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await openNavIfNarrow(page);
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(page.getByTestId("planning-grid")).toBeVisible();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    for (const panel of document.querySelectorAll(
      ".matrix-panel, .editor-panel, .filters, .notice",
    )) {
      const box = panel.getBoundingClientRect();
      if (box.right > main.right + 0.5) out.push(`${panel.className} > Inhalt`);
      for (const child of panel.querySelectorAll(
        "button, input, select, span, p, h2",
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
    return [...new Set(out)];
  });
  expect(issues, label).toEqual([]);
}

async function editorVisible(page: Page, height: number) {
  const box = await page.getByTestId("cell-editor").boundingBox();
  return box !== null && box.y >= 0 && box.y + 160 <= height;
}

for (const width of [375, 768, 1024, 1280]) {
  test(`matrix tiles, pager and editor fit at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openPlanning(page);

    // Jede Kachel nennt ihren Monat; Kacheln je Zeile nach Breite.
    const row = page.getByTestId(CELL).locator("xpath=..");
    const tiles = row.locator(".tile");
    await expect(tiles).toHaveCount(4);
    for (const month of ["03.2026", "04.2026", "05.2026", "06.2026"]) {
      await expect(tiles.filter({ hasText: month })).toHaveCount(1);
    }
    const perRow = await tiles.evaluateAll((nodes) => {
      const top = nodes[0]!.getBoundingClientRect().top;
      return nodes.filter(
        (node) => Math.abs(node.getBoundingClientRect().top - top) < 1,
      ).length;
    });
    expect(perRow).toBe(width >= 768 ? 4 : width > 480 ? 2 : 1);
    await expectContained(page, `${width} px: Matrix`);

    // Editor: rechts ab 1280 px, darunter unter der Matrix und nach der
    // Auswahl im sichtbaren Bereich, auch bei erneutem Klick.
    await page.getByTestId(CELL).click();
    await expect(page.getByTestId(INPUT)).toBeVisible();
    await expect(page.getByTestId("cell-editor")).toContainText("05.2026");
    const layout = await page.evaluate(() => {
      const matrix = document
        .querySelector(".matrix-panel")!
        .getBoundingClientRect();
      const editor = document
        .querySelector(".editor-panel")!
        .getBoundingClientRect();
      return {
        sideBySide:
          Math.abs(matrix.top - editor.top) < 1 &&
          editor.left > matrix.right - 1,
        stacked: editor.top >= matrix.bottom - 1,
      };
    });
    if (width >= 1280) {
      expect(layout.sideBySide).toBe(true);
    } else {
      expect(layout.stacked).toBe(true);
      await expect
        .poll(() => editorVisible(page, 900), { timeout: 10000 })
        .toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await editorVisible(page, 900)).toBe(false);
      await page.getByTestId(CELL).click();
      await expect
        .poll(() => editorVisible(page, 900), { timeout: 10000 })
        .toBe(true);
    }
    await expectContained(page, `${width} px: Editor`);
  });
}

test("pager and selection work by keyboard and clear the selection on page or filter change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPlanning(page);

  // Kachel per Tab/Enter waehlen, Fokus sichtbar, aria-current gesetzt.
  const first = page.getByTestId("cell-SCHILZ-600000000001-2026-03");
  await first.focus();
  await page.keyboard.press("Tab");
  const second = page.locator(":focus");
  await expect(second).toHaveClass(/tile/);
  expect(await second.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "solid",
  );
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("cell-editor")).not.toContainText(
    "Keine Zelle",
  );

  // Seitenwechsel per Tastatur hebt die Auswahl auf; Startmonat setzt auf Seite 1.
  await page.getByTestId("months-next").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("months-page")).toHaveText(
    "Monate 5 bis 8 von 12",
  );
  await expect(page.getByTestId("cell-editor-empty")).toBeVisible();
  await page.getByLabel("Startmonat").fill("01.2026");
  await page.getByLabel("Startmonat").press("Tab");
  await expect(page.getByTestId("months-page")).toHaveText(
    "Monate 1 bis 4 von 12",
  );
  await expect(page.getByTestId("planning-grid")).toContainText("01.2026");

  // Filterwechsel entfernt die Zeile: Auswahl aufgehoben.
  await page.getByTestId("cell-SCHILZ-700000000004-2026-03").click();
  await expect(page.getByTestId("cell-editor")).toContainText("Stephan Schilz");
  await page.getByLabel("Mitarbeiter").selectOption("ROEPER");
  await expect(
    page.getByTestId("cell-SCHILZ-700000000004-2026-03"),
  ).toHaveCount(0);
  await expect(page.getByTestId("cell-editor-empty")).toBeVisible();
});

test("unsaved editor input is never discarded silently", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPlanning(page);
  await page.getByTestId(CELL).click();
  const input = page.getByTestId(INPUT);

  // Ungueltige Eingabe: Meldung vor dem Senden, Wert bleibt, Wechsel fragt nach.
  await input.fill("0.333");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "ganzen Minuten",
  );
  await expect(page.getByTestId("editor-unsaved")).toBeVisible();
  await expect(input).toHaveValue("0.333");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId(OTHER).click();
  await expect(page.getByTestId(CELL)).toHaveAttribute("aria-current", "true");
  await expect(input).toHaveValue("0.333");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("months-next").click();
  await expect(page.getByTestId("months-page")).toHaveText(
    "Monate 1 bis 4 von 12",
  );
  await expect(input).toHaveValue("0.333");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Mitarbeiter").selectOption("ROEPER");
  await expect(page.getByLabel("Mitarbeiter")).toHaveValue("");
  await expect(input).toHaveValue("0.333");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Startmonat").fill("01.2026");
  await page.getByLabel("Startmonat").press("Tab");
  await expect(page.getByLabel("Startmonat")).toHaveValue("03.2026");
  await expect(input).toHaveValue("0.333");

  // Bestaetigen verwirft und wechselt.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(OTHER).click();
  await expect(page.getByTestId(OTHER)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("editor-unsaved")).toHaveCount(0);
});

test("a failed save keeps selection and value, success shows the server state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const state = { fail: true, delay: 0 };
  await page.route(`${API}/PlanningEntries`, async (route) => {
    if (state.delay)
      await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Planung weg" }),
      });
      return;
    }
    await route.continue();
  });
  await openPlanning(page);
  await page.getByTestId(CELL).click();
  const input = page.getByTestId(INPUT);
  await input.fill("12");
  await input.press("Tab");
  await expect(page.getByTestId("planning-message")).toContainText(
    "Planung weg",
  );
  await expect(page.getByTestId(CELL)).toHaveAttribute("aria-current", "true");
  await expect(input).toHaveValue("12");
  await expect(page.getByTestId("editor-unsaved")).toBeVisible();

  // Erneut speichern ohne Neueingabe; waehrend der Aktion sind Kacheln,
  // Pager, Filter und Editor gesperrt.
  state.fail = false;
  state.delay = 1200;
  await page.getByTestId("save-SCHILZ-700000000004-2026-05").click();
  await expect(page.getByTestId(OTHER)).toBeDisabled();
  await expect(page.getByTestId("months-next")).toBeDisabled();
  await expect(page.getByLabel("Mitarbeiter")).toBeDisabled();
  await expect(page.getByLabel("Startmonat")).toBeDisabled();
  await expect(page.getByTestId("planning-message")).toContainText(
    "gespeichert",
  );
  await expect(page.getByTestId(OTHER)).toBeEnabled();
  await expect(page.getByTestId(CELL)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId(CELL)).toContainText("12 · V");
  await expect(input).toHaveValue("12");
  await expect(page.getByTestId("editor-unsaved")).toHaveCount(0);
  await expect(
    page.getByTestId("release-SCHILZ-700000000004-2026-05"),
  ).toBeVisible();
});
