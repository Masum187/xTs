import { expect, test } from "@playwright/test";

test("filters, approves and rejects submitted days", async ({ page }) => {
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Genehmigung" }),
  ).toBeVisible();

  const list = page.getByTestId("approval-list");
  await expect(list.locator("article")).toHaveCount(3);

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
  await expect(list.locator("article")).toHaveCount(2);

  await page.getByTestId("reject-ROEPER-2026-04-08").click();
  await expect(page.getByTestId("confirm-reject")).toBeDisabled();
  await page
    .getByLabel("Rückweisungsgrund")
    .fill("Bitte Positionsbeschreibung präzisieren.");
  await page.getByTestId("confirm-reject").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "zurückgewiesen",
  );
  await expect(list.locator("article")).toHaveCount(1);
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
