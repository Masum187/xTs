import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { AuditEntry } from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

const CATEGORY_LABELS: Record<string, string> = {
  status: "Statuswechsel",
  job: "Job",
  masterdata: "Stammdaten",
  rule: "Regelwerk",
  system: "System",
};

@Component({
  selector: "xts-audit-log-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./audit-log-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class AuditLogPageComponent extends SettingsPage {
  protected readonly auditEntries = signal<AuditEntry[]>([]);
  protected readonly auditCategory = signal<string>("");
  protected readonly auditSeverity = signal<string>("");
  protected readonly auditSearch = signal<string>("");

  constructor() {
    super();
    void this.load();
  }

  protected categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  protected formatTime(iso: string): string {
    return iso.replace("T", " ").slice(0, 19);
  }

  protected async updateAuditFilter(
    patch: Partial<{ category: string; severity: string; q: string }>,
  ): Promise<void> {
    if (patch.category !== undefined) this.auditCategory.set(patch.category);
    if (patch.severity !== undefined) this.auditSeverity.set(patch.severity);
    if (patch.q !== undefined) this.auditSearch.set(patch.q);
    await this.load();
  }

  /** Filterwechsel verwerfen ueberholte Antworten (LoadState). */
  protected async load(): Promise<void> {
    await this.loader.track(
      () =>
        this.adminService.getAuditLog({
          category: this.auditCategory(),
          severity: this.auditSeverity(),
          q: this.auditSearch().trim(),
        }),
      "Protokoll konnte nicht geladen werden.",
      (entries) => this.auditEntries.set(entries),
    );
  }
}
