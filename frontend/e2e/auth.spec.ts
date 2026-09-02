import { expect, test } from "@playwright/test";

test("unmapped OAuth user gets a clear error message", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page
    .getByTestId("persona-select")
    .selectOption("neu.extern@qualitytimes.de");
  await expect(page.getByTestId("auth-not-mapped")).toBeVisible();
  await expect(page.getByTestId("auth-not-mapped")).toContainText(
    "neu.extern@qualitytimes.de",
  );
  await expect(page.getByTestId("auth-not-mapped")).toContainText(
    "xTS-Administration",
  );
  await expect(page.getByTestId("auth-claims")).toContainText(
    "00000000-0000-4000-8000-000000000099",
  );
  await expect(page.getByRole("link", { name: "Genehmigung" })).toBeHidden();
});

test("inactive employee cannot record hours", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page
    .getByTestId("persona-select")
    .selectOption("petra.altmann@qualitytimes.de");
  await expect(page.getByTestId("auth-inactive")).toBeVisible();
  await expect(page.getByTestId("auth-inactive")).toContainText("inaktiv");
});

test("non-approver is redirected away from approvals", async ({ page }) => {
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Genehmigung" })).toBeHidden();
});

test("approver reaches approvals via navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(
    page.getByRole("heading", { name: "Genehmigung" }),
  ).toBeVisible();
});
