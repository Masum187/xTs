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

test("admin area is not reachable without admin role", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Verwaltung" })).toBeHidden();
});
