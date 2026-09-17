import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type {
  CostObject,
  CostObjectAssignment,
  CostObjectAssignmentDraft,
  Employee,
} from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyCostObjectAssignment(): CostObjectAssignmentDraft {
  return { extNr: "", coIdent: "", validFrom: "", validTo: "" };
}

@Component({
  selector: "xts-cost-object-assignments-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./cost-object-assignments-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class CostObjectAssignmentsPageComponent extends SettingsPage {
  protected readonly assignments = signal<CostObjectAssignment[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly costObjects = signal<CostObject[]>([]);
  protected newAssignment = emptyCostObjectAssignment();

  constructor() {
    super();
    void this.load();
  }

  protected activeEmployees(): Employee[] {
    return this.employees().filter((employee) => !employee.deleted);
  }

  protected availableCostObjects(): CostObject[] {
    return this.costObjects().filter((item) => !item.deleted);
  }

  protected async saveAssignment(
    assignment: CostObjectAssignmentDraft,
  ): Promise<void> {
    await this.run(async () => {
      const saved =
        await this.adminService.saveCostObjectAssignment(assignment);
      await this.loadAssignments();
      if (assignment === this.newAssignment) {
        this.newAssignment = emptyCostObjectAssignment();
      }
      return `Zuordnung ${saved.id} gespeichert (${saved.description}, ${saved.validFrom} – ${saved.validTo}).`;
    });
  }

  protected async deleteAssignment(
    assignment: CostObjectAssignment,
  ): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveCostObjectAssignment({
        ...assignment,
        deleted: true,
      });
      await this.loadAssignments();
      return `Zuordnung ${assignment.id} logisch gelöscht.`;
    });
  }

  protected async load(): Promise<void> {
    await this.loader.track(
      () =>
        Promise.all([
          this.adminService.getCostObjectAssignments(),
          this.adminService.getEmployees(),
          this.adminService.getCostObjects(),
        ]),
      "Mitarbeiter-Kontierungen konnten nicht geladen werden.",
      ([assignments, employees, costObjects]) => {
        this.assignments.set(assignments);
        this.employees.set(employees);
        this.costObjects.set(costObjects);
      },
    );
  }

  private async loadAssignments(): Promise<void> {
    this.assignments.set(await this.adminService.getCostObjectAssignments());
  }
}
