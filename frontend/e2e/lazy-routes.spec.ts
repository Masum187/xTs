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

type ScriptLog = {
  /** Eindeutige Script-Adressen (fuer die Marker-Pruefung der Bundles). */
  urls: Set<string>;
  /** Tatsaechliche Script-Requests, Mehrfachabrufe zaehlen mit. */
  requests: () => number;
  bodies: () => Promise<string[]>;
};

function trackScripts(page: Page): ScriptLog {
  const urls = new Set<string>();
  let requests = 0;
  page.on("request", (request) => {
    const url = request.url();
    if (url.endsWith(".js") && url.includes("127.0.0.1:4200")) {
      urls.add(url);
      requests += 1;
    }
  });
  return {
    urls,
    requests: () => requests,
    bodies: async () => {
      const bodies: string[] = [];
      for (const url of urls) {
        bodies.push(await (await page.request.get(url)).text());
      }
      return bodies;
    },
  };
}

/** Unbehandelte Fehler und Konsolenfehler der Seite (Audit Nr. 41). */
function trackErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return () => errors;
}

async function openScreen(
  page: Page,
  screen: (typeof LAZY_SCREENS)[number],
): Promise<void> {
  await page.getByRole("link", { name: screen.link }).click();
  await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
  await expect(
    page.getByRole("heading", { name: screen.heading, exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("loading")).toHaveCount(0);
  await expect(page.getByTestId("load-error")).toHaveCount(0);
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

test("each lazy screen loads once on navigation, without page or console errors, and is not fetched again", async ({
  page,
}) => {
  const scripts = trackScripts(page);
  const errors = trackErrors(page);
  await page.goto("/");
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");

  for (const screen of LAZY_SCREENS) {
    const before = new Set(scripts.urls);
    const requestsBefore = scripts.requests();
    await openScreen(page, screen);
    // Genau das Bundle des Screens kommt hinzu; Marker im nachgeladenen Code.
    expect(scripts.requests(), `${screen.path} Requests`).toBeGreaterThan(
      requestsBefore,
    );
    const fresh = [...scripts.urls].filter((url) => !before.has(url));
    let found = false;
    for (const url of fresh) {
      const body = await (await page.request.get(url)).text();
      if (body.includes(screen.marker)) found = true;
    }
    expect(found, `${screen.path} bundle nachgeladen`).toBe(true);
    expect(errors(), `${screen.path} ohne Fehler geoeffnet`).toEqual([]);
  }

  // Erneuter Besuch aller vier Screens: kein einziger weiterer Script-
  // Request (auch kein erneuter Abruf derselben Adresse), keine Fehler.
  const requestsAfterFirstRound = scripts.requests();
  for (const screen of LAZY_SCREENS) {
    await openScreen(page, screen);
  }
  expect(scripts.requests()).toBe(requestsAfterFirstRound);
  expect(errors()).toEqual([]);
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
