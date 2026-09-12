import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// XTS-141: Tokens und Bausteine werden auf einer isolierten Testseite
// geprueft (Kontrast, Tastaturfokus, Schrift). Die Fach-Screens verwenden
// die Klassen noch nicht; das sichert der letzte Test.

const PAGE = "/assets/design-system/index.html";

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

/** Liest Textfarbe und den ersten nicht-transparenten Hintergrund nach oben. */
async function colorsOf(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => {
    const parse = (value: string): number[] | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => Number(part.trim()));
      if (parts.length === 4 && parts[3] === 0) return null;
      return parts.slice(0, 3);
    };
    const fg = parse(getComputedStyle(element).color)!;
    let node: Element | null = element;
    let bg: number[] | null = null;
    while (node && !bg) {
      bg = parse(getComputedStyle(node).backgroundColor);
      node = node.parentElement;
    }
    return { fg, bg: bg ?? [255, 255, 255] };
  });
}

test("tokens keep WCAG AA contrast on the isolated test page", async ({
  page,
}) => {
  await page.goto(PAGE);
  await expect(page.getByTestId("ds-title")).toBeVisible();
  const samples = await page.locator("[data-check]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-testid")!,
      min: node.getAttribute("data-check") === "large" ? 3 : 4.5,
    })),
  );
  expect(samples.length).toBeGreaterThan(8);
  for (const sample of samples) {
    const { fg, bg } = await colorsOf(page, sample.id);
    const ratio = contrast(fg, bg);
    expect(
      ratio,
      `${sample.id}: ${ratio.toFixed(2)}:1 (mindestens ${sample.min}:1)`,
    ).toBeGreaterThanOrEqual(sample.min);
  }
});

test("keyboard focus shows the accent ring on buttons and inputs", async ({
  page,
}) => {
  await page.goto(PAGE);
  await page.keyboard.press("Tab");
  const primary = page.getByTestId("ds-btn-primary");
  await expect(primary).toBeFocused();
  const outline = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).toBe("2px");

  await page.getByTestId("ds-input").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("ds-input")).toBeFocused();
  const inputOutline = await page
    .getByTestId("ds-input")
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(inputOutline).toBe("solid");
});

test("Archivo is served locally and applied only via opt-in class", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(ttf|woff2?)(\?|$)/.test(request.url()))
      fontRequests.push(request.url());
  });
  await page.goto(PAGE);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('800 16px "Archivo"');
  });
  expect(loaded).toBe(true);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(
    fontRequests.every((url) =>
      url.startsWith("http://127.0.0.1:4200/assets/fonts/"),
    ),
  ).toBe(true);
  const family = await page
    .getByTestId("ds-title")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family).toContain("Archivo");
});

test("existing screens do not use the new classes or font yet", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  const usage = await page.evaluate(() => ({
    classes: document.querySelectorAll('[class*="xts-"]').length,
    bodyFont: getComputedStyle(document.body).fontFamily,
  }));
  expect(usage.classes).toBe(0);
  expect(usage.bodyFont).toContain("Inter");
});
