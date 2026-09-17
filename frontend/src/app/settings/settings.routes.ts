import type { Routes } from "@angular/router";

import { roleGuard } from "../auth/role.guard";
import { ApproversPageComponent } from "./approvers-page.component";
import { AuditLogPageComponent } from "./audit-log-page.component";
import { CostObjectAssignmentsPageComponent } from "./cost-object-assignments-page.component";
import { CostObjectsPageComponent } from "./cost-objects-page.component";
import { EmployeesPageComponent } from "./employees-page.component";
import { RulesPageComponent } from "./rules-page.component";
import { settingsLockGuard } from "./settings-lock.service";
import { SettingsShellComponent } from "./settings-shell.component";
import { TeamAssignmentsPageComponent } from "./team-assignments-page.component";
import { TeamsPageComponent } from "./teams-page.component";
import { TestDataPageComponent } from "./test-data-page.component";

const DEFAULT_PAGE = "organisation/mitarbeiter";

function page(
  path: string,
  component: Routes[number]["component"],
  title: string,
) {
  return {
    path,
    component,
    title: `xTS Einstellungen – ${title}`,
    canDeactivate: [settingsLockGuard],
  };
}

/**
 * Einstellungen (XTS-154): Rollenschutz an Eltern- und Kindrouten, damit
 * Direktaufrufe und Reloads jeder Unterseite ihn durchlaufen; die Sperre
 * waehrend einer Pflegeaktion blockiert jeden Routenwechsel.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: "",
    component: SettingsShellComponent,
    canActivate: [roleGuard("admin")],
    canActivateChild: [roleGuard("admin")],
    canDeactivate: [settingsLockGuard],
    children: [
      { path: "", pathMatch: "full", redirectTo: DEFAULT_PAGE },
      page("organisation/mitarbeiter", EmployeesPageComponent, "Mitarbeiter"),
      page("organisation/teams", TeamsPageComponent, "Teams"),
      page(
        "organisation/teamzuordnungen",
        TeamAssignmentsPageComponent,
        "Teamzuordnungen",
      ),
      page(
        "organisation/kontierungen",
        CostObjectsPageComponent,
        "Kontierungen",
      ),
      page(
        "organisation/mitarbeiter-kontierungen",
        CostObjectAssignmentsPageComponent,
        "Mitarbeiter-Kontierungen",
      ),
      page("organisation/genehmiger", ApproversPageComponent, "Genehmiger"),
      page("regelwerk", RulesPageComponent, "Regelwerk"),
      page("system/protokoll", AuditLogPageComponent, "Protokoll"),
      page("system/testdaten", TestDataPageComponent, "Testdaten"),
      { path: "**", redirectTo: DEFAULT_PAGE },
    ],
  },
];
