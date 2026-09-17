import type { Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// XTS-154: Einstellungen in Unterseiten mit Baumnavigation. Abnahme:
// Layout bei 375, 768, 1024 und 1280 px, Rollenschutz fuer Direktaufrufe,
// Navigationssperre waehrend einer Pflegeaktion (auch Browser-Zurueck),
// abhaengige Auswahllisten, Textpuffer bei Fehlern, Reset-Rueckfrage und
// Lazy Loading des Einstellungs-Bundles.

const ROEPER = "christian.roeper@qualitytimes.de";
const SETTINGS_MARKER = "Testdatenpaket UAT";

async function openNavIfNarrow(page: Page) {
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible()) await toggle.click();
}

async function openSettings(page: Page) {
  await page.goto("/");
  await openNavIfNarrow(page);
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await openNavIfNarrow(page);
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(
    page.getByRole("heading", { name: "Einstellungen", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("employee-table")).toBeVisible();
}

async function expectContained(page: Page, label: string) {
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      out.push("Seite breiter als Viewport");
    const main = document.querySelector("main")!.getBoundingClientRect();
    for (const panel of document.querySelectorAll(
      ".settings-nav, .settings-page",
    )) {
      const box = panel.getBoundingClientRect();
      if (box.right > main.right + 0.5) out.push(`${panel.className} > Inhalt`);
      const wrap = panel.querySelector(".table-wrap");
      if (wrap) {
        if (wrap.getBoundingClientRect().right > box.right + 0.5)
          out.push("Tabellenbereich ragt");
        if (getComputedStyle(wrap).overflowX !== "auto")
          out.push("Tabellenbereich nicht scrollbar");
      }
      for (const child of panel.querySelectorAll(
        ".page-head *, .filters *, a, .rule *",
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

for (const width of [375, 768, 1024, 1280]) {
  test(`settings tree and pages fit at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSettings(page);
    await expect(page).toHaveURL(/\/einstellungen\/organisation\/mitarbeiter$/);
    await expect(page.getByTestId("settings-nav-employees")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const layout = await page.evaluate(() => {
      const nav = document
        .querySelector(".settings-nav")!
        .getBoundingClientRect();
      const content = document
        .querySelector(".settings-content")!
        .getBoundingClientRect();
      return {
        sideBySide:
          Math.abs(nav.top - content.top) < 1 && content.left > nav.right - 1,
        stacked: content.top >= nav.bottom - 1,
      };
    });
    if (width >= 1280) expect(layout.sideBySide).toBe(true);
    else expect(layout.stacked).toBe(true);
    await expectContained(page, `${width} px: Mitarbeiter`);

    // Elf Spalten der Mitarbeitertabelle bleiben; der Container scrollt.
    await expect(
      page.getByTestId("employee-table").locator("thead th"),
    ).toHaveCount(11);

    // Tastatur in der Baumnavigation: Tab zum naechsten Eintrag, Enter oeffnet.
    await page.getByTestId("settings-nav-employees").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("settings-nav-teams")).toBeFocused();
    expect(
      await page
        .getByTestId("settings-nav-teams")
        .evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("solid");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("team-table")).toBeVisible();
    await expect(page.getByTestId("settings-nav-teams")).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const [key, ready] of [
      ["approvers", "approver-table"],
      ["rules", "rules-list"],
      ["audit-log", "audit-table"],
      ["test-data", "reset-test-data"],
    ] as const) {
      await page.getByTestId(`settings-nav-${key}`).click();
      await expect(page.getByTestId(ready)).toBeVisible();
      await expectContained(page, `${width} px: ${key}`);
    }
  });
}

test("direct calls, reloads and /admin go through the admin role guard", async ({
  page,
}) => {
  // Ohne Adminrolle: Kindroute direkt, /admin und Reload landen auf der
  // Stundenschreibung mit Hinweis, das Einstellungs-Menue fehlt.
  await page.goto("/einstellungen/system/protokoll");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Einstellungen" })).toBeHidden();
  await expect(page.getByTestId("audit-table")).toHaveCount(0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();

  // Mit Adminrolle: /admin leitet weiter, Elternpfad oeffnet Mitarbeiter,
  // Kindrouten sind direkt erreichbar.
  await page.goto("/");
  await page.getByTestId("persona-select").selectOption(ROEPER);
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page).toHaveURL(/\/einstellungen\/organisation\/mitarbeiter$/);
  await page.getByTestId("settings-nav-rules").click();
  await expect(page).toHaveURL(/\/einstellungen\/regelwerk$/);
  await expect(page.getByTestId("rules-list")).toBeVisible();

  // Reload im Mock-Modus faellt auf die Standardpersona zurueck: der Schutz
  // greift auf der Kindroute erneut.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByTestId("rules-list")).toHaveCount(0);
});

test("a running maintenance action locks every route change until it ends", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const state = { delay: 0, fail: false };
  await page.route(`${API}/Teams`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (state.delay)
      await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Team weg" }),
      });
      return;
    }
    await route.continue();
  });
  await openSettings(page);
  await page.getByTestId("settings-nav-teams").click();
  await expect(page.getByTestId("team-table")).toBeVisible();
  await page.getByLabel("Neu: Team-ID").fill("lock_team");
  await page.getByLabel("Neu: Teamname").fill("Sperre");

  state.delay = 1500;
  await page.getByTestId("create-team").click();
  await expect(page.getByTestId("settings-nav-locked")).toBeVisible();
  await expect(page.getByTestId("settings-nav-employees")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByTestId("settings-nav-employees").click();
  await expect(page).toHaveURL(/organisation\/teams$/);
  await page.goBack();
  await expect(page).toHaveURL(/organisation\/teams$/);
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(page).toHaveURL(/organisation\/teams$/);
  await expect(page.getByTestId("admin-message")).toContainText("gespeichert");
  await expect(page.getByTestId("settings-nav-locked")).toHaveCount(0);
  await expect(page.getByTestId("team-LOCK_TEAM")).toBeVisible();

  // Nach einem Fehler ist die Sperre ebenfalls aufgehoben.
  state.delay = 0;
  state.fail = true;
  await page.getByLabel("Teamname LOCK_TEAM").fill("Sperre geaendert");
  await page.getByTestId("save-team-LOCK_TEAM").click();
  await expect(page.getByTestId("admin-message")).toContainText("Team weg");
  await expect(page.getByLabel("Teamname LOCK_TEAM")).toHaveValue(
    "Sperre geaendert",
  );
  await expect(page.getByTestId("settings-nav-locked")).toHaveCount(0);
  await page.getByTestId("settings-nav-employees").click();
  await expect(page).toHaveURL(/organisation\/mitarbeiter$/);
  await page.goBack();
  await expect(page).toHaveURL(/organisation\/teams$/);
});

test("dependent selections load per page, errors never look like empty lists, failed saves keep inputs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const state = { failTeams: false, failSave: false };
  await page.route(`${API}/Teams*`, async (route) => {
    if (route.request().method() !== "GET" || !state.failTeams)
      return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "INTERNAL", message: "Teams weg" }),
    });
  });
  await page.route(`${API}/TeamAssignments`, async (route) => {
    if (route.request().method() !== "POST" || !state.failSave)
      return route.continue();
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "INTERNAL", message: "Zuordnung weg" }),
    });
  });
  await openSettings(page);

  state.failTeams = true;
  await page.getByTestId("settings-nav-team-assignments").click();
  await expect(page.getByTestId("load-error")).toContainText("Teams weg");
  await expect(page.getByTestId("team-assignment-table")).toHaveCount(0);
  await expect(page.getByLabel("Neu: Teamzuordnung Team")).toHaveCount(0);
  state.failTeams = false;
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("team-assignment-table")).toBeVisible();
  await expect(
    page.getByLabel("Neu: Teamzuordnung Team").locator("option"),
  ).not.toHaveCount(1);

  // Fehlgeschlagenes Anlegen: alle Eingaben bleiben stehen.
  await page.getByLabel("Neu: Teamzuordnung Mitarbeiter").selectOption("WEBER");
  const teamSelect = page.getByLabel("Neu: Teamzuordnung Team");
  const teamValue = await teamSelect
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await teamSelect.selectOption(teamValue!);
  await page.getByLabel("Neu: Teamzuordnung gültig von").fill("2027-01-01");
  await page.getByLabel("Neu: Teamzuordnung gültig bis").fill("2027-12-31");
  state.failSave = true;
  await page.getByTestId("create-team-assignment").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "Zuordnung weg",
  );
  await expect(page.getByLabel("Neu: Teamzuordnung Mitarbeiter")).toHaveValue(
    "WEBER",
  );
  await expect(teamSelect).toHaveValue(teamValue!);
  await expect(page.getByLabel("Neu: Teamzuordnung gültig von")).toHaveValue(
    "2027-01-01",
  );
  await expect(page.getByLabel("Neu: Teamzuordnung gültig bis")).toHaveValue(
    "2027-12-31",
  );
});

test("test data reset asks first: cancel sends nothing, confirm sends exactly one request", async ({
  page,
}) => {
  const resets: string[] = [];
  await page.route(`${API}/TestDataResets`, async (route) => {
    resets.push(route.request().method());
    await route.continue();
  });
  await openSettings(page);
  await page.getByTestId("settings-nav-test-data").click();
  await expect(page.getByTestId("reset-test-data")).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("reset-test-data").click();
  await expect(page.getByTestId("admin-message")).toHaveCount(0);
  expect(resets).toEqual([]);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("reset-test-data").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "Testdatenpaket uat-v0.1 zurückgesetzt",
  );
  expect(resets).toEqual(["POST"]);
  // Profil und Badge sind aus dem Serverstand aktualisiert, die Seite steht.
  await expect(page.getByTestId("nav-persona-name")).toContainText(
    "Christian Roeper",
  );
  await expect(page.getByTestId("nav-badge-approvals")).toHaveText(/\d+/);
  await expect(page.getByTestId("reset-test-data")).toBeVisible();
  await page.getByTestId("settings-nav-employees").click();
  await expect(page.getByTestId("employee-SCHILZ")).toBeVisible();
});

test("the settings bundle is not loaded until the settings are opened", async ({
  page,
}) => {
  const scripts = new Set<string>();
  page.on("response", (response) => {
    const url = response.url();
    if (url.endsWith(".js") && url.includes("127.0.0.1:4200")) scripts.add(url);
  });
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-13");
  await expect(page.getByLabel("Stunden").first()).toBeVisible();
  const initial = [...scripts];
  expect(initial.length).toBeGreaterThan(0);
  for (const url of initial) {
    const body = await (await page.request.get(url)).text();
    expect(body, url).not.toContain(SETTINGS_MARKER);
  }

  await page.getByTestId("persona-select").selectOption(ROEPER);
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByTestId("employee-table")).toBeVisible();
  const lazy = [...scripts].filter((url) => !initial.includes(url));
  expect(lazy.length).toBeGreaterThan(0);
  let found = false;
  for (const url of lazy) {
    const body = await (await page.request.get(url)).text();
    if (body.includes(SETTINGS_MARKER)) found = true;
  }
  expect(found).toBe(true);
});
