import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { SettingsLockService } from "./settings-lock.service";

interface SettingsEntry {
  key: string;
  label: string;
  path: string;
}

interface SettingsGroup {
  title: string;
  entries: SettingsEntry[];
}

/**
 * Baumnavigation der Einstellungen (XTS-154). Gruppen ohne Eintraege
 * (Integrationen: Rollen, Werkkalender, Connectoren, Jobs erst mit O6,
 * XTS-024, XTS-083, XTS-084) werden nicht gezeigt.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "Organisation",
    entries: [
      {
        key: "employees",
        label: "Mitarbeiter",
        path: "organisation/mitarbeiter",
      },
      { key: "teams", label: "Teams", path: "organisation/teams" },
      {
        key: "team-assignments",
        label: "Teamzuordnungen",
        path: "organisation/teamzuordnungen",
      },
      {
        key: "cost-objects",
        label: "Kontierungen",
        path: "organisation/kontierungen",
      },
      {
        key: "cost-object-assignments",
        label: "Mitarbeiter-Kontierungen",
        path: "organisation/mitarbeiter-kontierungen",
      },
      {
        key: "approvers",
        label: "Genehmiger",
        path: "organisation/genehmiger",
      },
    ],
  },
  {
    title: "Regelwerk",
    entries: [{ key: "rules", label: "Regelwerk", path: "regelwerk" }],
  },
  { title: "Integrationen", entries: [] },
  {
    title: "System",
    entries: [
      { key: "audit-log", label: "Protokoll", path: "system/protokoll" },
      { key: "test-data", label: "Testdaten", path: "system/testdaten" },
    ],
  },
];

@Component({
  selector: "xts-settings-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: "./settings-shell.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-shell.component.css",
})
export class SettingsShellComponent {
  protected readonly lock = inject(SettingsLockService);
  protected readonly groups = SETTINGS_GROUPS.filter(
    (group) => group.entries.length > 0,
  );
}
