import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../auth/auth.service";
import { describeApiError } from "../shared/api-error";

import { formatSignedHours } from "../shared/hours";
import { dayVariance, sumLineHours } from "../timesheet/timesheet.logic";
import type { ApprovalDay } from "../timesheet/timesheet.models";
import {
  filterApprovals,
  uniqueEmployees,
  uniqueMonths,
} from "./approval.logic";
import { ApprovalService } from "./approval.service";

@Component({
  selector: "xts-approval",
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: "./approval.component.html",
  styleUrl: "./approval.component.css",
})
export class ApprovalComponent {
  private readonly approvalService = inject(ApprovalService);
  private readonly auth = inject(AuthService);

  protected readonly days = signal<ApprovalDay[]>([]);
  protected readonly monthFilter = signal<string>("");
  protected readonly employeeFilter = signal<string>("");
  protected readonly message = signal<string>("");
  protected readonly rejectingKey = signal<string>("");
  protected readonly rejectReason = signal<string>("");

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

  /** Vier-Augen-Prinzip: eigene Tage genehmigt eine andere Person. */
  protected isOwnDay(day: ApprovalDay): boolean {
    return day.extNr === this.auth.profile()?.extNr;
  }

  protected async approve(day: ApprovalDay): Promise<void> {
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
  }

  private removeDay(day: ApprovalDay): void {
    this.days.update((days) =>
      days.filter((item) => this.dayKey(item) !== this.dayKey(day)),
    );
  }

  private async load(): Promise<void> {
    this.days.set(await this.approvalService.getApprovalTimesheets());
  }
}
