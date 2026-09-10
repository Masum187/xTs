import { DatePipe, DecimalPipe } from "@angular/common";
import {
  Component,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../auth/auth.service";
import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";

import { formatSignedHours } from "../shared/hours";
import { dayVariance, sumLineHours } from "../timesheet/timesheet.logic";
import type { ApprovalDay, TimesheetLine } from "../timesheet/timesheet.models";
import {
  filterApprovals,
  uniqueEmployees,
  uniqueMonths,
} from "./approval.logic";
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

  constructor() {
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
    this.days.update((days) =>
      days.filter((item) => this.dayKey(item) !== this.dayKey(day)),
    );
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
