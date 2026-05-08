import { expect, test } from "@playwright/test";

test("loads timesheet and submits draft", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
});
