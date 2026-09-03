import { expect, test } from "@playwright/test";

test("filters, approves and rejects submitted days", async ({
  page,
  request,
}) => {
  // Eigener Tag zum Zurueckweisen: Roeper darf seine Tage nicht selbst
  // bearbeiten (Vier-Augen-Prinzip), daher ein aelterer Schilz-Tag.
  await request.post("http://127.0.0.1:4010/odata/TimesheetDays", {
    data: {
      extNr: "SCHILZ",
      date: "2026-04-01",
      startTime: "08:30",
      endTime: "16:30",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "700000000004", description: "Rückweisungsprobe", hours: 7 },
      ],
    },
  });
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(
    page.getByRole("heading", { name: "Genehmigung" }),
  ).toBeVisible();

  const list = page.getByTestId("approval-list");
  await expect(list.locator("article")).toHaveCount(4);
  await expect(page.getByTestId("own-day-ROEPER-2026-04-08")).toBeVisible();
  await expect(page.getByTestId("approve-ROEPER-2026-04-08")).toHaveCount(0);

  await page.getByLabel("Mitarbeiter").selectOption("ROEPER");
  await expect(list.locator("article")).toHaveCount(2);
  await page.getByLabel("Leistungsmonat").selectOption("2026-03");
  await expect(list.locator("article")).toHaveCount(1);
  await page.getByLabel("Leistungsmonat").selectOption("");
  await page.getByLabel("Mitarbeiter").selectOption("");

  await page.getByTestId("approve-SCHILZ-2026-04-08").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "Wareneingang WE-",
  );
  await expect(list.locator("article")).toHaveCount(3);

  await page.getByTestId("reject-SCHILZ-2026-04-01").click();
  await expect(page.getByTestId("confirm-reject")).toBeDisabled();
  await page
    .getByLabel("Rückweisungsgrund")
    .fill("Bitte Positionsbeschreibung präzisieren.");
  await page.getByTestId("confirm-reject").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "zurückgewiesen",
  );
  await expect(list.locator("article")).toHaveCount(2);
});

test("approved day is locked in the timesheet view", async ({
  page,
  request,
}) => {
  const date = "2026-04-07";
  await request.post("http://127.0.0.1:4010/odata/TimesheetDays", {
    data: {
      extNr: "SCHILZ",
      date,
      startTime: "08:30",
      endTime: "17:30",
      breakMinutes: 60,
      location: "remote",
      status: "F",
      lines: [
        {
          coIdent: "700000000004",
          description: "Genehmigungsprobe",
          hours: 8,
        },
      ],
    },
  });
  await request.post("http://127.0.0.1:4010/odata/TimesheetApprovals", {
    headers: { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" },
    data: {
      extNr: "SCHILZ",
      date,
      action: "approve",
    },
  });

  await page.goto("/");
  await page.getByLabel("Tagesdatum").fill(date);
  await expect(page.getByTestId("day-status")).toHaveText("Genehmigt");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
});
