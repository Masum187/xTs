import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { Rule } from "./admin.models";
import { AdminService } from "./admin.service";

const INFOTYPE_LABELS: Record<number, string> = {
  1: "Aggregation Beauftragung",
  2: "Freischaltung Stundenschreibung",
};

const VALUE_OPTIONS: Record<number, { value: string; label: string }[]> = {
  1: [{ value: "MA_KONT", label: "Je Mitarbeiter und Kontierung" }],
  2: [
    { value: "P", label: "P – ab BANF vorhanden" },
    { value: "B", label: "B – ab Bestellung vorhanden" },
  ],
};

@Component({
  selector: "xts-admin",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./admin.component.html",
  styleUrl: "./admin.component.css",
})
export class AdminComponent {
  private readonly adminService = inject(AdminService);

  protected readonly rules = signal<Rule[]>([]);
  protected readonly message = signal<string>("");

  constructor() {
    void this.load();
  }

  protected infotypeLabel(rule: Rule): string {
    return INFOTYPE_LABELS[rule.infotype];
  }

  protected valueOptions(rule: Rule): { value: string; label: string }[] {
    return VALUE_OPTIONS[rule.infotype];
  }

  protected updateRule(rule: Rule, patch: Partial<Rule>): void {
    this.rules.update((rules) =>
      rules.map((candidate) =>
        candidate.infotype === rule.infotype
          ? { ...candidate, ...patch }
          : candidate,
      ),
    );
  }

  protected async saveRule(rule: Rule): Promise<void> {
    const saved = await this.adminService.saveRule(rule);
    this.message.set(
      `Regel „${this.infotypeLabel(saved)}" gespeichert (${saved.value}, ${
        saved.active ? "aktiv" : "inaktiv"
      }). Die Freischaltungen werden sofort neu abgeleitet.`,
    );
    await this.load();
  }

  private async load(): Promise<void> {
    this.rules.set(await this.adminService.getRules());
  }
}
