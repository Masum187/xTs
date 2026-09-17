import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { Employee, EmployeeDraft } from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyEmployee(): EmployeeDraft {
  return {
    extNr: "",
    firstName: "",
    lastName: "",
    company: "QualityTimes",
    sapAccount: "",
    aadOid: "",
    aadUpn: "",
    active: true,
    resourceManager: "",
  };
}

@Component({
  selector: "xts-employees-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./employees-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class EmployeesPageComponent extends SettingsPage {
  protected readonly employees = signal<Employee[]>([]);
  protected newEmployee = emptyEmployee();

  constructor() {
    super();
    void this.load();
  }

  protected activeEmployees(): Employee[] {
    return this.employees().filter((employee) => !employee.deleted);
  }

  protected async saveEmployee(employee: EmployeeDraft): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveEmployee(employee);
      await this.loadEmployees();
      if (employee === this.newEmployee) this.newEmployee = emptyEmployee();
      return `Mitarbeiter ${saved.extNr} (${saved.displayName}) gespeichert.`;
    });
  }

  protected async deleteEmployee(employee: Employee): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveEmployee({ ...employee, deleted: true });
      await this.loadEmployees();
      return `Mitarbeiter ${employee.extNr} logisch gelöscht.`;
    });
  }

  protected async load(): Promise<void> {
    await this.loader.track(
      () => this.adminService.getEmployees(),
      "Mitarbeiter konnten nicht geladen werden.",
      (employees) => this.employees.set(employees),
    );
  }

  private async loadEmployees(): Promise<void> {
    this.employees.set(await this.adminService.getEmployees());
  }
}
