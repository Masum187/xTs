import { expect, test } from "@playwright/test";

test("loads timesheet and submits draft", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await expect(page.getByTestId("day-status")).toHaveText("Entwurf");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
  await expect(page.getByTestId("day-status")).toHaveText(
    "Zur Genehmigung freigegeben",
  );
});

test("shows rejection reason and re-submits corrected day", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page.getByLabel("Tagesdatum").fill("2026-04-10");
  await expect(page.getByTestId("day-status")).toHaveText("Zurückgewiesen");
  await expect(page.getByTestId("rejection-banner")).toContainText(
    "Bitte Projektreferenz in der Beschreibung ergänzen.",
  );

  await page
    .getByLabel("Leistungsbeschreibung")
    .fill("Support PRJ-4711 Incident-Bearbeitung");
  await page.getByTestId("submit-timesheet").click();
  await expect(page.getByText("Zur Genehmigung freigegeben.")).toBeVisible();
  await expect(page.getByTestId("rejection-banner")).toBeHidden();
});

test("blocks invalid hours, times and breaks before anything is sent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-03");
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await page.getByTestId("add-line").click();
  const hours = page.getByLabel("Stunden").last();
  const problems = page.getByTestId("timesheet-problems");

  await hours.fill("-5");
  await expect(problems).toContainText("zwischen 0,25 und 24");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await hours.fill("25");
  await expect(problems).toContainText("zwischen 0,25 und 24");
  await hours.fill("1.3333");
  await expect(problems).toContainText("Viertelstunden");
  await page.getByTestId("save-draft").click();
  await expect(page.locator(".actions .message")).toContainText(
    "Viertelstunden",
  );

  await hours.fill("8");
  await page.getByLabel("Leistungsbeschreibung").last().fill("Validierung");
  await page.locator("label:has-text('Geht') input").fill("07:00");
  await expect(problems).toContainText("Geht muss nach Kommt liegen");
  await page.locator("label:has-text('Geht') input").fill("17:30");
  await page.locator("label:has-text('Pause') input").fill("-30");
  await expect(problems).toContainText("Pause");
  await page.locator("label:has-text('Pause') input").fill("30");
  await expect(problems).toBeHidden();
  await expect(page.getByTestId("submit-timesheet")).toBeEnabled();
});

test("locks approved days and blocks exhausted cost objects", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  await page.getByLabel("Tagesdatum").fill("2026-04-09");
  await expect(page.getByTestId("day-status")).toHaveText("Genehmigt");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await expect(page.getByTestId("save-draft")).toBeDisabled();

  await expect(page.getByTestId("cost-object-list")).toContainText(
    "nicht buchbar",
  );
});

test("blocks bookings beyond the open quota before sending", async ({
  page,
  request,
}) => {
  const api = "http://127.0.0.1:4010/odata";
  const remainingOf = async () => {
    const response = await request.get(`${api}/MyEnabledCostObjects`);
    const body = (await response.json()) as {
      value: { coIdent: string; remainingHours: number }[];
    };
    return body.value.find((item) => item.coIdent === "600000000001")!
      .remainingHours;
  };
  // Kontingent 600000000001 per API auf unter 24 Std. bringen.
  let day = 14;
  while ((await remainingOf()) >= 24) {
    await request.post(`${api}/TimesheetDays`, {
      data: {
        extNr: "SCHILZ",
        date: `2026-04-${day}`,
        startTime: "00:00",
        endTime: "23:45",
        breakMinutes: 0,
        location: "remote",
        status: "E",
        lines: [
          {
            coIdent: "600000000001",
            description: "Kontingentprobe",
            hours: 23,
          },
        ],
      },
    });
    day += 1;
  }
  const remaining = await remainingOf();

  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  await page.getByLabel("Tagesdatum").fill("2026-04-29");
  await page.getByLabel("Kontierung").selectOption("600000000001");
  await page.getByTestId("add-line").click();
  await page.getByLabel("Leistungsbeschreibung").last().fill("Kontingent");
  const hours = page.getByLabel("Stunden").last();
  await hours.fill(String(remaining + 0.25));
  await expect(page.getByTestId("timesheet-problems")).toContainText(
    "Std. offen",
  );
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await page.getByTestId("save-draft").click();
  await expect(page.locator(".actions .message")).toContainText("Std. offen");

  if (remaining >= 0.25) {
    await hours.fill(String(remaining));
    await expect(page.getByTestId("timesheet-problems")).toBeHidden();
    await page.getByTestId("save-draft").click();
    await expect(page.locator(".actions .message")).toContainText(
      "Entwurf gespeichert.",
    );
    // Beauftragte Stunden koennen durch vorherige Specs abweichen; entscheidend
    // ist, dass die Anzeige nach dem Speichern sofort 0 offene Stunden zeigt.
    await expect(
      page
        .getByTestId("cost-object-list")
        .locator(".line-row", { hasText: "600000000001" }),
    ).toContainText(/ 0 von \d+ Std\. offen/);
  }
});
