import { Component, ChangeDetectionStrategy, inject } from "@angular/core";

import { AuthService } from "../auth/auth.service";
import { ApprovalBadgeService } from "../shared/approval-badge.service";
import { SettingsPage } from "./settings-page";

export const RESET_TEST_DATA_MESSAGE =
  "Testdaten zurücksetzen? Stamm- und Bewegungsdaten der Mock-API werden auf den Ausgangsstand gesetzt.";

@Component({
  selector: "xts-test-data-page",
  imports: [],
  templateUrl: "./test-data-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class TestDataPageComponent extends SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly badge = inject(ApprovalBadgeService);

  /**
   * Rueckfrage vor dem Reset (Audit Nr. 23): Abbrechen sendet keinen
   * Request, Bestaetigen genau einen. Danach werden Profil und Badge aus
   * den Serverdaten aktualisiert; die Unterseiten laden beim Oeffnen neu.
   */
  protected async resetTestData(): Promise<void> {
    if (!window.confirm(RESET_TEST_DATA_MESSAGE)) return;
    await this.run(async () => {
      const result = await this.adminService.resetTestData();
      await this.auth.refreshProfile();
      await this.badge.refresh(this.auth.profile());
      return `Testdatenpaket ${result.package} zurückgesetzt (${result.counts["timesheetDays"]} Stundenzettel-Tage, ${result.counts["orders"]} Beauftragungen, ${result.counts["planningEntries"]} Planzeilen).`;
    });
  }

  protected async load(): Promise<void> {
    // Keine Daten auf dieser Seite.
  }
}
