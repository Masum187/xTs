import { expect, test } from "@playwright/test";
import { errorMessageOf, itemsOf, numberOf } from "./odata";

test("loads timesheet and submits draft", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stundenschreibung" }),
  ).toBeVisible();
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  // Standardtag ist das Systemdatum des Servers (Entscheidung 18), nicht das
  // Browserdatum; der Fixture-Entwurf liegt im April.
  await expect(page.getByLabel("Tagesdatum")).toHaveValue("2026-05-05");
  await expect(page.getByTestId("date-locked")).toHaveCount(0);
  await page.getByLabel("Tagesdatum").fill("2026-04-13");
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
  // 08:30–17:30 mit 30 Min. Pause = 8,5 Std. Arbeitszeit bei 8 Std. Positionen.
  await expect(page.getByTestId("work-hours")).toContainText("8,5 Std.");
  await expect(page.getByTestId("day-variance")).toContainText("−0,5 Std.");
  await expect(problems).toContainText("weicht von der Arbeitszeit");
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();
  await page
    .getByLabel("Abweichungsbegründung")
    .fill("Reisezeit ohne Kontierung");
  await expect(problems).toBeHidden();
  await expect(page.getByTestId("submit-timesheet")).toBeEnabled();
  await page.locator("label:has-text('Geht') input").fill("17:00");
  await expect(page.getByTestId("day-variance")).toContainText("0 Std.");
  await expect(page.getByLabel("Abweichungsbegründung")).toHaveCount(0);
});

test("approvers see work time and explained variances", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4010/odata/TimesheetDays", {
    data: {
      extNr: "SCHILZ",
      date: "2026-04-05",
      startTime: "08:00",
      endTime: "16:30",
      breakMinutes: 30,
      location: "on-site",
      status: "F",
      varianceReason: "Anreise zum Kunden",
      lines: [{ coIdent: "700000000004", description: "Workshop", hours: 6 }],
    },
  });
  await page.goto("/");
  await page
    .getByTestId("persona-select")
    .selectOption("christian.roeper@qualitytimes.de");
  await page.getByRole("link", { name: "Genehmigung" }).click();
  await expect(page.getByTestId("worktime-SCHILZ-2026-04-05")).toContainText(
    "08:00–16:30 · Pause 30 Min. · Arbeitszeit 8 Std.",
  );
  await expect(page.getByTestId("variance-SCHILZ-2026-04-05")).toContainText(
    "Abweichung −2 Std. · Anreise zum Kunden",
  );
  await expect(page.getByTestId("variance-SCHILZ-2026-04-08")).toHaveCount(0);
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
    const items = itemsOf<{ coIdent: string; remainingHours: unknown }>(
      await response.json(),
    );
    return numberOf(
      items.find((item) => item.coIdent === "600000000001")!.remainingHours,
    );
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
    // Die Restbuchung weicht von der Arbeitszeit ab und braucht eine Begruendung.
    const reason = page.getByLabel("Abweichungsbegründung");
    if ((await reason.count()) > 0) {
      await reason.fill("Kontingentprobe");
    }
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

test("days outside the recording window are read-only, weekends only warn", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");

  // Vor dem Fenster (Systemdatum 2026-05-05, Monatsabschluss 5): gesperrt.
  await page.getByLabel("Tagesdatum").fill("2026-03-31");
  await expect(page.getByTestId("date-locked")).toContainText(
    "01.04.2026 bis 05.05.2026",
  );
  await expect(page.getByLabel("Kontierung")).toBeDisabled();
  await expect(page.getByTestId("save-draft")).toBeDisabled();
  await expect(page.getByTestId("submit-timesheet")).toBeDisabled();

  // Wochenende im Fenster: Hinweis, aber bearbeitbar.
  await page.getByLabel("Tagesdatum").fill("2026-04-11");
  await expect(page.getByTestId("weekend-hint")).toBeVisible();
  await expect(page.getByTestId("date-locked")).toHaveCount(0);
  await expect(page.getByLabel("Kontierung")).toBeEnabled();

  // Der Server sperrt ebenfalls, auch fuer Entwuerfe in der Zukunft.
  const future = await request.post(
    "http://127.0.0.1:4010/odata/TimesheetDays",
    {
      data: {
        extNr: "SCHILZ",
        date: "2026-05-06",
        startTime: "08:00",
        endTime: "12:00",
        breakMinutes: 0,
        location: "remote",
        status: "E",
        lines: [{ coIdent: "700000000004", description: "Zukunft", hours: 4 }],
      },
    },
  );
  expect(future.status()).toBe(400);
  expect(errorMessageOf(await future.json())).toContain(
    "erfassbaren Zeitraums",
  );
});

test("group problems are linked to every affected hours field", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("profile")).toContainText("Stephan Schilz");
  // 2026-04-30: von keinem anderen Test belegt (Kontingent-Schleife endet frueher).
  await page.getByLabel("Tagesdatum").fill("2026-04-30");
  await page.getByLabel("Kontierung").selectOption("700000000004");
  await page.getByTestId("add-line").click();
  await page.getByTestId("add-line").click();
  const hours = page.getByLabel("Stunden");
  await hours.nth(0).fill("12.5");
  await hours.nth(1).fill("12.5");
  await expect(page.getByTestId("timesheet-problems")).toContainText(
    "24 Stunden nicht überschreiten",
  );
  for (const index of [0, 1]) {
    await expect(hours.nth(index)).toHaveAttribute("aria-invalid", "true");
    const describedBy = await hours.nth(index).getAttribute("aria-describedby");
    expect(describedBy).toContain("DAY_HOURS_EXCEEDED");
    for (const id of describedBy!.split(" ")) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  }
  // Einzelfehler bleibt am eigenen Feld: Geht vor Kommt.
  await page.locator("label:has-text('Kommt') input").fill("08:30");
  const endTime = page.locator("label:has-text('Geht') input");
  await endTime.fill("07:00");
  await expect(endTime).toHaveAttribute("aria-invalid", "true");
  await expect(hours.nth(0)).toHaveAttribute("aria-invalid", "true");
});
