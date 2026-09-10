import { expect, test } from "@playwright/test";
import { errorMessageOf } from "./odata";

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
      endTime: "16:00",
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

test("approvers see only days on their cost objects, with all lines of the day", async ({
  page,
  request,
}) => {
  const API = "http://127.0.0.1:4010/odata";
  const WEBER = { "x-mock-oauth-upn": "maria.weber@qualitytimes.de" };
  // Gemischter Tag (Sonntag, sonst ungenutzt): Implementierung (Webers
  // Kontierung) und Support (fremd).
  await request.post(`${API}/TimesheetDays`, {
    data: {
      extNr: "SCHILZ",
      date: "2026-04-12",
      startTime: "08:00",
      endTime: "14:30",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "700000000004", description: "Implementierung", hours: 4 },
        { coIdent: "600000000001", description: "Support", hours: 2 },
      ],
    },
  });

  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("maria.weber@qualitytimes.de");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  const card = page.getByTestId("approval-SCHILZ-2026-04-12");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("approval-ROEPER-2026-03-31")).toHaveCount(0);
  await expect(page.getByTestId("approval-ROEPER-2026-04-08")).toHaveCount(0);
  // Alle Positionen bleiben sichtbar, fremde sind markiert.
  await expect(card).toContainText("Support");
  await expect(card).toContainText("nicht in Ihrer Zuständigkeit");
  await expect(page.getByTestId("scope-note-SCHILZ-2026-04-12")).toBeVisible();

  // Fremder Tag: der Server lehnt ab.
  const foreign = await request.post(`${API}/TimesheetApprovals`, {
    headers: WEBER,
    data: { extNr: "ROEPER", date: "2026-03-31", action: "approve" },
  });
  expect(foreign.status()).toBe(403);
  expect(errorMessageOf(await foreign.json())).toContain("zuständig");

  // Tagesfreigabe wirkt gesamthaft.
  await page.getByTestId("approve-SCHILZ-2026-04-12").click();
  await expect(page.getByTestId("approval-message")).toContainText(
    "Wareneingang WE-",
  );
  await expect(card).toBeHidden();

  // Ohne Zuordnung: Hinweis statt leerer Liste.
  const assignment = {
    id: "000004",
    coIdent: "700000000004",
    extNr: "WEBER",
    deputy: true,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  };
  const ADMIN = { "x-mock-oauth-upn": "christian.roeper@qualitytimes.de" };
  await request.post(`${API}/CostObjectApprovers`, {
    headers: ADMIN,
    data: { ...assignment, deleted: true },
  });
  // Kein Reload: im Mock-Modus faellt die Persona dabei auf Schilz zurueck.
  await page.getByRole("link", { name: "Stundenschreibung" }).click();
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(page.getByTestId("approval-no-responsibility")).toBeVisible();
  await request.post(`${API}/CostObjectApprovers`, {
    headers: ADMIN,
    data: assignment,
  });
});
