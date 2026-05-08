import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { canSubmitTimesheet, sumLineHours } from "./timesheet.logic";
import {
  EnabledCostObject,
  EmployeeProfile,
  TimesheetDay,
} from "./timesheet.models";
import { TimesheetService } from "./timesheet.service";

@Component({
  selector: "xts-timesheet",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./timesheet.component.html",
  styleUrl: "./timesheet.component.css",
})
export class TimesheetComponent {
  protected readonly profile = signal<EmployeeProfile | null>(null);
  protected readonly costObjects = signal<EnabledCostObject[]>([]);
  protected readonly selectedCostObject = signal<string>("700000000004");
  protected readonly message = signal<string>("");
  protected readonly day = signal<TimesheetDay>({
    extNr: "SCHILZ",
    date: "2026-04-13",
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "E",
    lines: [
      {
        coIdent: "700000000004",
        description: "Daily Projektabstimmung",
        hours: 2,
      },
    ],
  });

  protected readonly totalHours = computed(() =>
    sumLineHours(this.day().lines),
  );
  protected readonly canSubmit = computed(() => canSubmitTimesheet(this.day()));

  constructor(private readonly timesheetService: TimesheetService) {
    void this.loadInitialData();
  }

  protected addLine(): void {
    const selected = this.costObjects().find(
      (item) => item.coIdent === this.selectedCostObject(),
    );
    if (!selected) return;

    this.day.update((day) => ({
      ...day,
      lines: [
        ...day.lines,
        {
          coIdent: selected.coIdent,
          description: "",
          hours: 0,
        },
      ],
    }));
  }

  protected updateLine(
    index: number,
    patch: Partial<TimesheetDay["lines"][number]>,
  ): void {
    this.day.update((day) => ({
      ...day,
      lines: day.lines.map((line, currentIndex) =>
        currentIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  protected async save(): Promise<void> {
    const saved = await this.timesheetService.saveTimesheet(this.day());
    this.day.set(saved);
    this.message.set("Entwurf gespeichert.");
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.day.update((day) => ({ ...day, status: "F" }));
    const saved = await this.timesheetService.saveTimesheet(this.day());
    this.day.set(saved);
    this.message.set("Zur Genehmigung freigegeben.");
  }

  private async loadInitialData(): Promise<void> {
    const [profile, costObjects] = await Promise.all([
      this.timesheetService.getProfile(),
      this.timesheetService.getEnabledCostObjects(this.day().date),
    ]);
    this.profile.set(profile);
    this.costObjects.set(costObjects);
    this.day.update((day) => ({ ...day, extNr: profile.extNr }));
  }
}
