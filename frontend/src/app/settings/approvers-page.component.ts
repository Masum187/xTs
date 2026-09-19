import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type {
  CostObject,
  CostObjectApprover,
  CostObjectApproverDraft,
  Employee,
} from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyCostObjectApprover(): CostObjectApproverDraft {
  return { coIdent: "", extNr: "", deputy: false, validFrom: "", validTo: "" };
}

@Component({
  selector: "xts-approvers-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./approvers-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./settings-page.css",
})
export class ApproversPageComponent extends SettingsPage {
  /** Genehmiger je Kontierung (Entscheidung 19, XTS-014). */
  protected readonly approvers = signal<CostObjectApprover[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly costObjects = signal<CostObject[]>([]);
  protected newApprover = emptyCostObjectApprover();

  constructor() {
    super();
    void this.load();
  }

  protected availableCostObjects(): CostObject[] {
    return this.costObjects().filter((item) => !item.deleted);
  }

  /** Nur aktive Mitarbeiter mit Rolle approver koennen Genehmiger sein. */
  protected approverEmployees(): Employee[] {
    return this.employees().filter(
      (employee) =>
        !employee.deleted &&
        employee.active &&
        employee.roles.includes("approver"),
    );
  }

  protected async saveApprover(
    approver: CostObjectApproverDraft,
  ): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveCostObjectApprover(approver);
      await this.loadApprovers();
      if (approver === this.newApprover) {
        this.newApprover = emptyCostObjectApprover();
      }
      return `Genehmigerzuordnung ${saved.id} gespeichert (${saved.coIdent}: ${saved.displayName ?? saved.extNr}${saved.deputy ? ", Vertretung" : ""}, ${saved.validFrom} – ${saved.validTo}).`;
    });
  }

  protected async deleteApprover(approver: CostObjectApprover): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveCostObjectApprover({
        ...approver,
        deleted: true,
      });
      await this.loadApprovers();
      return `Genehmigerzuordnung ${approver.id} logisch gelöscht.`;
    });
  }

  protected async load(): Promise<void> {
    await this.loader.track(
      () =>
        Promise.all([
          this.adminService.getCostObjectApprovers(),
          this.adminService.getEmployees(),
          this.adminService.getCostObjects(),
        ]),
      "Genehmigerzuordnungen konnten nicht geladen werden.",
      ([approvers, employees, costObjects]) => {
        this.approvers.set(approvers);
        this.employees.set(employees);
        this.costObjects.set(costObjects);
      },
    );
  }

  private async loadApprovers(): Promise<void> {
    this.approvers.set(await this.adminService.getCostObjectApprovers());
  }
}
