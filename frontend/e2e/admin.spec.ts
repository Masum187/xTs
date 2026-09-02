import { expect, test } from "@playwright/test";

test("admin maintains the enablement rule and sees the effect", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await expect(page.getByRole("heading", { name: "Verwaltung" })).toBeVisible();

  const rule = page.getByTestId("rule-2");
  await expect(rule).toContainText("Freischaltung Stundenschreibung");
  await expect(page.getByTestId("rule-1")).toContainText(
    "Aggregation Beauftragung",
  );

  await page.getByTestId("rule-1").getByLabel("Aktiv Infotyp 1").uncheck();
  await page.getByTestId("rule-1").getByTestId("save-rule-1").click();
  await expect(page.getByTestId("admin-message")).toContainText("inaktiv");

  await page.getByRole("link", { name: "Beauftragung" }).click();
  await expect(page.getByTestId("candidates-empty")).toBeVisible();

  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page.getByTestId("rule-1").getByLabel("Aktiv Infotyp 1").check();
  await page.getByTestId("rule-1").getByTestId("save-rule-1").click();
  await page.getByRole("link", { name: "Beauftragung" }).click();
  await expect(page.getByTestId("candidate-ROEPER-600000000001")).toBeVisible();

  await page.getByRole("link", { name: "Verwaltung" }).click();
  await rule.getByLabel("Aktiv Infotyp 2").uncheck();
  await rule.getByTestId("save-rule-2").click();
  await expect(page.getByTestId("admin-message")).toContainText("inaktiv");

  await page.getByRole("link", { name: "Stundenschreibung" }).click();
  await expect(page.getByTestId("profile")).toContainText("Christian Roeper");
  await expect(page.getByTestId("cost-object-list")).not.toContainText(
    "600000000001",
  );

  await page
    .getByTestId("persona-select")
    .selectOption("stephan.schilz@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByTestId("submit-timesheet").click();
  await expect(
    page.getByText("Kontierung ist für diesen Tag nicht freigeschaltet"),
  ).toBeVisible();

  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page.getByTestId("rule-2").getByLabel("Aktiv Infotyp 2").check();
  await page.getByTestId("rule-2").getByTestId("save-rule-2").click();
  await expect(page.getByTestId("admin-message")).toContainText("aktiv");

  await page.getByRole("link", { name: "Stundenschreibung" }).click();
  await expect(page.getByTestId("cost-object-list")).toContainText(
    "600000000001",
  );
});

test("admin maintains master data and sees the effect in planning", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await expect(page.getByRole("heading", { name: "Verwaltung" })).toBeVisible();

  // XTS-010: Pflichtfelder werden validiert, Aenderer wird gesetzt.
  await page.getByLabel("Neu: EXTNR").fill("tester");
  await page.getByLabel("Neu: Vorname").fill("Toni");
  await page.getByTestId("create-employee").click();
  await expect(page.getByTestId("admin-message")).toContainText("NACHNAME");
  await page.getByLabel("Neu: Nachname").fill("Tester");
  await page.getByTestId("create-employee").click();
  await expect(page.getByTestId("admin-message")).toContainText("Toni Tester");
  await expect(page.getByTestId("employee-TESTER")).toContainText("ROEPER");

  // XTS-011: inaktive Teams werden in der Planung nicht angeboten.
  await page.getByLabel("Neu: Team-ID").fill("qa_team");
  await page.getByLabel("Neu: Teamname").fill("QA Team");
  await page.getByTestId("create-team").click();
  await expect(page.getByTestId("team-QA_TEAM")).toBeVisible();
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByLabel("Team").locator("option", { hasText: "QA Team" }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page.getByLabel("Aktiv Team QA_TEAM").uncheck();
  await page.getByTestId("save-team-QA_TEAM").click();
  await expect(page.getByTestId("admin-message")).toContainText("inaktiv");
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByLabel("Team").locator("option", { hasText: "QA Team" }),
  ).toHaveCount(0);

  // XTS-013: Kontierung anlegen, gegen SAP CO pruefen, zuordnen, loeschen.
  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page
    .getByLabel("Neu: Kontierung", { exact: true })
    .fill("600000000042");
  await page.getByLabel("Neu: Kontierungsart").selectOption("OR");
  await page.getByTestId("check-new-cost-object").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "nicht bestanden",
  );
  await page.getByLabel("Neu: Kontierungsart").selectOption("KS");
  await page.getByLabel("Neu: Bezeichnung").fill("QA Kostenstelle");
  await page.getByTestId("create-cost-object").click();
  await expect(page.getByTestId("cost-object-600000000042")).toBeVisible();
  await page.getByTestId("check-cost-object-600000000042").click();
  await expect(page.getByTestId("admin-message")).toContainText("gueltig");

  await page.getByLabel("Neu: Zuordnung Mitarbeiter").selectOption("SCHILZ");
  await page
    .getByLabel("Neu: Zuordnung Kontierung")
    .selectOption("600000000042");
  await page.getByLabel("Neu: Zuordnung gültig von").fill("2026-01-01");
  await page.getByLabel("Neu: Zuordnung gültig bis").fill("2026-12-31");
  await page.getByTestId("create-assignment").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "QA Kostenstelle, Stephan Schilz",
  );

  await page.getByRole("link", { name: "Planung" }).click();
  await expect(
    page.getByTestId("cell-SCHILZ-600000000042-2026-04"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Verwaltung" }).click();
  await page.getByTestId("delete-cost-object-600000000042").click();
  await expect(page.getByTestId("admin-message")).toContainText("gelöscht");
  await expect(page.getByTestId("cost-object-600000000042")).toContainText(
    "gelöscht",
  );
  await page.getByRole("link", { name: "Planung" }).click();
  await expect(page.getByTestId("planning-grid")).toBeVisible();
  await expect(
    page.getByTestId("cell-SCHILZ-600000000042-2026-04"),
  ).toBeHidden();
});

test("admin area is not reachable without admin role", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Verwaltung" })).toBeHidden();
});
