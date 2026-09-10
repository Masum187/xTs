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

test("non-approver is redirected away from approvals with an explanation", async ({
  page,
}) => {
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Genehmigung" })).toBeHidden();
  await expect(page.getByTestId("access-denied")).toContainText(
    "Projektleiter (Genehmigung)",
  );
  await page.getByTestId("dismiss-notice").click();
  await expect(page.getByTestId("access-denied")).toHaveCount(0);
});

test("switching the identity never loads data with the previous one", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  // Erst wenn der Erstaufruf (inkl. Folgeseiten bei OData-Paginierung)
  // abgeschlossen ist, zaehlen Anfragen als "nach dem Wechsel".
  await page.waitForLoadState("networkidle");

  const requests: { url: string; upn: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.url().includes(":4010/odata/")) {
      requests.push({
        url: request.url(),
        upn: request.headers()["x-mock-oauth-upn"],
      });
    }
  });
  await page
    .getByTestId("persona-select")
    .selectOption("petra.altmann@qualitytimes.de");
  await expect(page.getByTestId("auth-inactive")).toBeVisible();
  await page.waitForTimeout(300);

  const withOldIdentity = requests.filter(
    (request) => request.upn === "stephan.schilz@qualitytimes.de",
  );
  expect(withOldIdentity).toEqual([]);
  const dataRequests = requests.filter((request) =>
    /MyTimesheets|MyEnabledCostObjects/.test(request.url),
  );
  expect(dataRequests).toEqual([]);
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

test("expected auth failures produce no application errors in the console", async ({
  page,
}) => {
  // Audit Nr. 41: der Browser meldet 403/404 als "Failed to load resource";
  // das ist HTTP-Semantik und bleibt. Die App selbst darf nichts loggen.
  const appErrors: string[] = [];
  page.on("pageerror", (error) =>
    appErrors.push(`pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/Failed to load resource/.test(message.text())) return;
    appErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page
    .getByTestId("persona-select")
    .selectOption("petra.altmann@qualitytimes.de");
  await expect(page.getByTestId("auth-inactive")).toBeVisible();
  await page
    .getByTestId("persona-select")
    .selectOption("neu.extern@qualitytimes.de");
  await expect(page.getByTestId("auth-not-mapped")).toBeVisible();
  await page
    .getByTestId("persona-select")
    .selectOption("stephan.schilz@qualitytimes.de");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  expect(appErrors).toEqual([]);
});
