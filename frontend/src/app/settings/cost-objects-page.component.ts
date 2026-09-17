import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { CostObject, CostObjectDraft } from "../admin/admin.models";
import { COST_OBJECT_TYPES } from "../admin/admin.models";
import { ApiError } from "../shared/api-error";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyCostObject(): CostObjectDraft {
  return { coIdent: "", type: "KS", description: "", active: true };
}

@Component({
  selector: "xts-cost-objects-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./cost-objects-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class CostObjectsPageComponent extends SettingsPage {
  protected readonly costObjectTypes = COST_OBJECT_TYPES;
  protected readonly costObjects = signal<CostObject[]>([]);
  protected newCostObject = emptyCostObject();

  constructor() {
    super();
    void this.load();
  }

  protected async saveCostObject(costObject: CostObjectDraft): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveCostObject(costObject);
      await this.loadCostObjects();
      if (costObject === this.newCostObject) {
        this.newCostObject = emptyCostObject();
      }
      return `Kontierung ${saved.coIdent} (${saved.type}) gespeichert.`;
    });
  }

  protected async deleteCostObject(costObject: CostObject): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveCostObject({ ...costObject, deleted: true });
      await this.loadCostObjects();
      return `Kontierung ${costObject.coIdent} logisch gelöscht. Sie wird in Planung und Stundenschreibung nicht mehr angeboten.`;
    });
  }

  protected async checkCostObject(costObject: CostObjectDraft): Promise<void> {
    await this.run(async () => {
      const result = await this.adminService.checkCostObject(costObject);
      if (!result.valid) {
        throw new ApiError(200, "CO_CHECK_FAILED", result.message);
      }
      return `SAP-CO-Prüfung (${result.source}): ${result.message}`;
    });
  }

  protected async load(): Promise<void> {
    await this.loader.track(
      () => this.adminService.getCostObjects(),
      "Kontierungen konnten nicht geladen werden.",
      (costObjects) => this.costObjects.set(costObjects),
    );
  }

  private async loadCostObjects(): Promise<void> {
    this.costObjects.set(await this.adminService.getCostObjects());
  }
}
