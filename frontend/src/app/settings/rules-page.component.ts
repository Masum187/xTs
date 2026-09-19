import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { Rule } from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

const INFOTYPE_LABELS: Record<number, string> = {
  1: "Aggregation Beauftragung",
  2: "Freischaltung Stundenschreibung",
  3: "Monatsabschluss Stundenerfassung",
};

const VALUE_OPTIONS: Record<number, { value: string; label: string }[]> = {
  1: [{ value: "MA_KONT", label: "Je Mitarbeiter und Kontierung" }],
  2: [
    { value: "P", label: "P – ab BANF vorhanden" },
    { value: "B", label: "B – ab Bestellung vorhanden" },
  ],
  // Entscheidung 18: Vormonat erfassbar bis einschliesslich diesem Tag.
  3: Array.from({ length: 28 }, (_item, index) => ({
    value: String(index + 1),
    label: `Vormonat bis zum ${index + 1}. des Folgemonats`,
  })),
};

@Component({
  selector: "xts-rules-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./rules-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./settings-page.css",
})
export class RulesPageComponent extends SettingsPage {
  protected readonly rules = signal<Rule[]>([]);

  constructor() {
    super();
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
    await this.run(async () => {
      const saved = await this.adminService.saveRule(rule);
      this.rules.set(await this.adminService.getRules());
      return `Regel „${this.infotypeLabel(saved)}" gespeichert (${saved.value}, ${
        saved.active ? "aktiv" : "inaktiv"
      }). Die Freischaltungen werden sofort neu abgeleitet.`;
    });
  }

  protected async load(): Promise<void> {
    await this.loader.track(
      () => this.adminService.getRules(),
      "Regelwerk konnte nicht geladen werden.",
      (rules) => this.rules.set(rules),
    );
  }
}
