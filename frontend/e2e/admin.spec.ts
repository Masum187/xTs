import { expect, test } from "@playwright/test";
import { errorMessageOf } from "./odata";

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
  await page.getByLabel("Tagesdatum").fill("2026-04-13");
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

test("admin sees status changes and job errors in the audit log", async ({
  page,
  request,
}) => {
  const API = "http://127.0.0.1:4010/odata";
  const ADMIN = { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" };
  await request.post(`${API}/TimesheetDays`, {
    data: {
      extNr: "SCHILZ",
      date: "2026-04-02",
      startTime: "08:30",
      endTime: "12:30",
      breakMinutes: 0,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "700000000004", description: "Protokollprobe", hours: 4 },
      ],
    },
  });
  await request.post(`${API}/TimesheetApprovals`, {
    headers: ADMIN,
    data: { extNr: "SCHILZ", date: "2026-04-02", action: "approve" },
  });
  const duplicateBanf = await request.post(`${API}/OrderBanfs`, {
    headers: ADMIN,
    data: { orderId: "BEAUF-9001" },
  });
  expect(duplicateBanf.status()).toBe(409);
  expect(errorMessageOf(await duplicateBanf.json())).toContain(
    "bereits eine BANF",
  );

  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Verwaltung" }).click();

  const table = page.getByTestId("audit-table");
  await expect(table).toContainText("SCHILZ/2026-04-02");
  await expect(table).toContainText("Wareneingang WE-");
  await expect(table).toContainText("F → G");

  await page.getByLabel("Protokoll Schweregrad").selectOption("error");
  await expect(table).toContainText("BANF-Anlage abgelehnt");
  await expect(table).not.toContainText("Wareneingang WE-");

  await page.getByLabel("Protokoll Schweregrad").selectOption("");
  await page.getByLabel("Protokoll Suche").fill("gibtesnicht");
  await expect(page.getByTestId("audit-empty")).toBeVisible();
});

test("admin area is not reachable without admin role", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Verwaltung" })).toBeHidden();
});

test("admin maintains approvers per cost object", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Verwaltung" }).click();
  const table = page.getByTestId("approver-table");
  await expect(table).toContainText("Maria Weber");
  // Nur aktive Mitarbeiter mit Rolle approver sind als Genehmiger waehlbar.
  await expect(
    page
      .getByLabel("Neu: Genehmiger Mitarbeiter")
      .locator("option", { hasText: "Stephan Schilz" }),
  ).toHaveCount(0);

  await page
    .getByLabel("Neu: Genehmiger Kontierung")
    .selectOption("600000000009");
  await page.getByLabel("Neu: Genehmiger Mitarbeiter").selectOption("WEBER");
  await page.getByLabel("Neu: Genehmiger gültig von").fill("2026-01-01");
  await page.getByLabel("Neu: Genehmiger gültig bis").fill("2026-12-31");
  await page.getByTestId("create-approver").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "Genehmigerzuordnung 000005 gespeichert",
  );
  await expect(page.getByTestId("approver-000005")).toContainText(
    "600000000009",
  );

  await page.getByTestId("delete-approver-000005").click();
  await expect(page.getByTestId("admin-message")).toContainText(
    "logisch gelöscht",
  );
  await expect(page.getByTestId("approver-000005")).toHaveCount(0);
});
