import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Audit Nr. 32 (Schritt 15 Teil B): Genehmigung, Reporting, Planung und
// Beauftragung sind eigene, verzoegert geladene Bundles. Die Stundenschreibung
// bleibt bewusst im Initial-Bundle. Der Rollenschutz laeuft vor dem Nachladen:
// ein abgewiesener Direktaufruf oder Reload laedt den Screen nicht herunter.

const ROEPER = "christian.roeper@qualitytimes.de";

/** ASCII-Marker aus dem jeweiligen Screen (Bundles koennen Umlaute escapen). */
const TIMESHEET_MARKER = "Stundenzettel konnten nicht geladen werden.";
const LAZY_SCREENS = [
  {
    path: "/approvals",
    link: /^Genehmigung/,
    heading: "Genehmigung",
    marker: "Freigegebene Arbeitstage konnten nicht geladen werden.",
  },
  {
    path: "/reports",
    link: /^Reporting/,
    heading: "Reporting",
    marker: "Ressourcen-Live-Circle konnte nicht geladen werden.",
  },
  {
    path: "/planning",
    link: /^Planung/,
    heading: "Ressourcenplanung",
    marker: "Planstunden konnten nicht gespeichert werden.",
  },
  {
    path: "/orders",
    link: /^Beauftragung/,
    heading: "Beauftragung",
    marker: "Beauftragungskandidaten konnten nicht geladen werden.",
  },
] as const;

type ScriptLog = { urls: Set<string>; bodies: () => Promise<string[]> };

function trackScripts(page: Page): ScriptLog {
  const urls = new Set<string>();
  page.on("response", (response) => {
    const url = response.url();
    if (url.endsWith(".js") && url.includes("127.0.0.1:4200")) urls.add(url);
  });
  return {
    urls,
    bodies: async () => {
      const bodies: string[] = [];
      for (const url of urls) {
        bodies.push(await (await page.request.get(url)).text());
      }
      return bodies;
    },
  };
}

test("the start loads only the timesheet, no other screen bundle", async ({
  page,
}) => {
  const scripts = trackScripts(page);
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-13");
  await expect(page.getByLabel("Stunden").first()).toBeVisible();

  const bodies = await scripts.bodies();
  expect(bodies.length).toBeGreaterThan(0);
  expect(bodies.some((body) => body.includes(TIMESHEET_MARKER))).toBe(true);
  for (const screen of LAZY_SCREENS) {
    for (const body of bodies) {
      expect(body, screen.path).not.toContain(screen.marker);
    }
  }
});

test("each lazy screen loads on navigation and works after reload of the app", async ({
  page,
}) => {
  const scripts = trackScripts(page);
  await page.goto("/");
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");

  for (const screen of LAZY_SCREENS) {
    const before = new Set(scripts.urls);
    await page.getByRole("link", { name: screen.link }).click();
    await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
    await expect(
      page.getByRole("heading", { name: screen.heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("loading")).toHaveCount(0);
    await expect(page.getByTestId("load-error")).toHaveCount(0);
    const fresh = [...scripts.urls].filter((url) => !before.has(url));
    let found = false;
    for (const url of fresh) {
      const body = await (await page.request.get(url)).text();
      if (body.includes(screen.marker)) found = true;
    }
    expect(found, `${screen.path} bundle nachgeladen`).toBe(true);
  }

  // Ein Screen, der schon geladen ist, wird beim erneuten Oeffnen nicht
  // erneut heruntergeladen.
  const loaded = scripts.urls.size;
  await page.getByRole("link", { name: /^Genehmigung/ }).click();
  await expect(
    page.getByRole("heading", { name: "Genehmigung", exact: true }),
  ).toBeVisible();
  expect(scripts.urls.size).toBe(loaded);
});

for (const screen of LAZY_SCREENS) {
  test(`direct call and reload of ${screen.path} without the role redirect before the bundle loads`, async ({
    page,
  }) => {
    const scripts = trackScripts(page);
    // Direktaufruf mit der Standardpersona (nur Rolle user).
    await page.goto(screen.path);
    await expect(page.getByTestId("access-denied")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Stundenschreibung" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // Reload derselben Adresse: der Schutz greift erneut (Mock-Modus faellt
    // auf die Standardpersona zurueck), das Bundle bleibt ungeladen.
    await page.goto(screen.path);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Stundenschreibung" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    for (const body of await scripts.bodies()) {
      expect(body).not.toContain(screen.marker);
    }
  });
}
