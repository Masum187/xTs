import { DatePipe, DecimalPipe } from "@angular/common";
import type { ElementRef } from "@angular/core";
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../auth/auth.service";
import { ApprovalBadgeService } from "../shared/approval-badge.service";
import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";

import { formatSignedHours } from "../shared/hours";
import { dayVariance, sumLineHours } from "../timesheet/timesheet.logic";
import type { ApprovalDay, TimesheetLine } from "../timesheet/timesheet.models";
import {
  filterApprovals,
  keepSelection,
  nextSelectionAfter,
  uniqueEmployees,
  uniqueMonths,
} from "./approval.logic";

/** Screen-lokaler Umbruch: Liste und Detail nebeneinander erst ab 1280 px. */
const STACKED_QUERY = "(max-width: 1279px)";
import { ApprovalService } from "./approval.service";

@Component({
  selector: "xts-approval",
  imports: [DatePipe, DecimalPipe, FormsModule, LoadStatusComponent],
  templateUrl: "./approval.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./approval.component.css",
})
export class ApprovalComponent {
  private readonly approvalService = inject(ApprovalService);
  private readonly auth = inject(AuthService);
  private readonly badge = inject(ApprovalBadgeService);

  protected readonly loader = new LoadState();
  protected readonly busy = new BusyState();
  protected readonly days = signal<ApprovalDay[]>([]);
  protected readonly monthFilter = signal<string>("");
  protected readonly employeeFilter = signal<string>("");
  protected readonly message = signal<string>("");
  protected readonly rejectingKey = signal<string>("");
  protected readonly rejectReason = signal<string>("");
  /** Anzahl eigener Genehmigerzuordnungen (Entscheidung 19). */
  protected readonly responsibilityCount = signal<number>(0);
  /** admin sieht alles; approver braucht mindestens eine Zuordnung. */
  protected readonly hasResponsibility = computed(
    () => this.auth.hasRole("admin") || this.responsibilityCount() > 0,
  );

  protected readonly months = computed(() => uniqueMonths(this.days()));
  protected readonly employees = computed(() => uniqueEmployees(this.days()));
  protected readonly filteredDays = computed(() =>
    filterApprovals(this.days(), this.monthFilter(), this.employeeFilter()),
  );
  /**
   * Auswahl fuer die Detailansicht (XTS-151), rein praesentativ: stabiler
   * Schluessel aus Mitarbeiter und Datum. Filterwechsel und Nachladen
   * korrigieren eine Auswahl, die nicht mehr in der Liste steht.
   */
  protected readonly selectedKey = linkedSignal<ApprovalDay[], string>({
    source: this.filteredDays,
    computation: (days, previous) =>
      keepSelection(
        days.map((day) => this.dayKey(day)),
        previous?.value ?? "",
      ),
  });
  protected readonly selectedDay = computed(
    () =>
      this.filteredDays().find(
        (day) => this.dayKey(day) === this.selectedKey(),
      ) ?? null,
  );
  private readonly detail = viewChild<ElementRef<HTMLElement>>("detail");

  constructor() {
    // Jeder tatsaechliche Auswahlwechsel, auch durch Filter oder Nachladen,
    // verwirft einen begonnenen Rueckweisungsgrund; er bleibt nur, solange
    // sein Tag ausgewaehlt ist (Serverfehler lassen die Auswahl stehen).
    effect(() => {
      const selected = this.selectedKey();
      if (this.rejectingKey() && this.rejectingKey() !== selected) {
        this.cancelReject();
      }
    });
    void this.load();
  }

  protected dayKey(day: ApprovalDay): string {
    return `${day.extNr}|${day.date}`;
  }

  protected totalHours(day: ApprovalDay): number {
    return sumLineHours(day.lines);
  }

  /** Abweichung Positionssumme zu Arbeitszeit als Text oder null bei 0. */
  protected varianceOf(day: ApprovalDay): string | null {
    const variance = dayVariance(day);
    return variance === null || variance === 0
      ? null
      : formatSignedHours(variance);
  }

  /** Position auf einer Kontierung ausserhalb der eigenen Zustaendigkeit. */
  protected isForeign(day: ApprovalDay, line: TimesheetLine): boolean {
    return !day.responsibleCoIdents.includes(line.coIdent);
  }

  /** Tag enthaelt Positionen ausserhalb der Zustaendigkeit (Tagesfreigabe wirkt gesamthaft). */
  protected hasForeignLines(day: ApprovalDay): boolean {
    return day.lines.some((line) => this.isForeign(day, line));
  }

  /** Vier-Augen-Prinzip: eigene Tage genehmigt eine andere Person. */
  protected isOwnDay(day: ApprovalDay): boolean {
    return day.extNr === this.auth.profile()?.extNr;
  }

  protected reload(): void {
    void this.load();
  }

  protected isSelected(day: ApprovalDay): boolean {
    return this.dayKey(day) === this.selectedKey();
  }

  /**
   * Tag in der Liste auswaehlen. Waehrend einer Aktion gesperrt, damit der
   * sichtbare Tag zur laufenden Aktion passt. Auch der bereits ausgewaehlte
   * (z. B. vorausgewaehlte) Tag fuehrt zum Detail.
   */
  protected select(day: ApprovalDay): void {
    if (this.busy.active()) return;
    this.selectedKey.set(this.dayKey(day));
    this.revealDetail();
  }

  /** Unter 1280 px liegt das Detail unter der Liste: dorthin scrollen. */
  private revealDetail(): void {
    if (!window.matchMedia(STACKED_QUERY).matches) return;
    this.detail()?.nativeElement.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }

  protected async approve(day: ApprovalDay): Promise<void> {
    await this.busy.guard(async () => {
      try {
        const approved = await this.approvalService.approveDay(
          day.extNr,
          day.date,
        );
        this.removeDay(day);
        this.message.set(
          `Tag ${day.date} von ${day.displayName} genehmigt, Wareneingang ${approved.weDocument} gebucht.`,
        );
      } catch (error) {
        this.message.set(
          describeApiError(error, "Tag konnte nicht genehmigt werden."),
        );
      }
    });
  }

  protected startReject(day: ApprovalDay): void {
    this.rejectingKey.set(this.dayKey(day));
    this.rejectReason.set("");
  }

  protected cancelReject(): void {
    this.rejectingKey.set("");
    this.rejectReason.set("");
  }

  protected async confirmReject(day: ApprovalDay): Promise<void> {
    const reason = this.rejectReason().trim();
    if (!reason) return;
    await this.busy.guard(async () => {
      try {
        await this.approvalService.rejectDay(day.extNr, day.date, reason);
        this.removeDay(day);
        this.cancelReject();
        this.message.set(
          `Tag ${day.date} von ${day.displayName} zurückgewiesen.`,
        );
      } catch (error) {
        this.message.set(
          describeApiError(error, "Tag konnte nicht zurückgewiesen werden."),
        );
      }
    });
  }

  private removeDay(day: ApprovalDay): void {
    // Auswahl springt in der aktuellen Reihenfolge weiter (XTS-151).
    const next = nextSelectionAfter(
      this.filteredDays().map((item) => this.dayKey(item)),
      this.dayKey(day),
    );
    this.days.update((days) =>
      days.filter((item) => this.dayKey(item) !== this.dayKey(day)),
    );
    this.selectedKey.set(next);
    // Badge in der Navigation aus den Serverdaten nachziehen (XTS-142).
    void this.badge.refresh(this.auth.profile());
  }

  private async load(): Promise<void> {
    await this.loader.track(
      () =>
        Promise.all([
          this.approvalService.getApprovalTimesheets(),
          this.approvalService.getMyResponsibilities(),
        ]),
      "Freigegebene Arbeitstage konnten nicht geladen werden.",
      ([days, responsibilities]) => {
        this.days.set(days);
        this.responsibilityCount.set(responsibilities.length);
      },
    );
  }
}
