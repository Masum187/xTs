import { Injectable, inject, signal } from "@angular/core";

import { ApprovalService } from "../approval/approval.service";
import type { AuthProfile } from "../auth/auth.models";

/**
 * Zaehler offener Genehmigungen fuer die Navigation (XTS-142).
 * Quelle sind die berechtigten Serverdaten (`ApprovalTimesheets` des
 * angemeldeten Genehmigers, Entscheidung 19). Ein Laufzaehler sorgt dafuer,
 * dass weder ein Identitaetswechsel noch ueberlappende Aktualisierungen
 * einen aelteren Wert zurueckschreiben.
 */
@Injectable({
  providedIn: "root",
})
export class ApprovalBadgeService {
  private readonly approvals = inject(ApprovalService);
  private run = 0;

  /** null: kein Badge (keine Genehmigerrolle, noch nicht geladen, Fehler). */
  readonly count = signal<number | null>(null);

  /** Sofort leeren, z. B. beim Identitaetswechsel; laufende Antworten verfallen. */
  clear(): void {
    this.run += 1;
    this.count.set(null);
  }

  async refresh(profile: AuthProfile | null): Promise<void> {
    const run = ++this.run;
    if (!profile?.roles.includes("approver")) {
      this.count.set(null);
      return;
    }
    try {
      const days = await this.approvals.getApprovalTimesheets();
      if (run === this.run) this.count.set(days.length);
    } catch {
      if (run === this.run) this.count.set(null);
    }
  }
}
