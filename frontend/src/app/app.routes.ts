import { inject } from "@angular/core";
import type { CanDeactivateFn, Routes } from "@angular/router";

import { roleGuard } from "./auth/role.guard";
import { NotFoundComponent } from "./not-found.component";
import { UnsavedChangesService } from "./shared/unsaved-changes.service";
import { TimesheetComponent } from "./timesheet/timesheet.component";

/** Schutz vor Datenverlust (Audit Nr. 19): Verlassen nur nach Rueckfrage. */
const unsavedChangesGuard: CanDeactivateFn<unknown> = () =>
  inject(UnsavedChangesService).confirmDiscard();

/**
 * Audit Nr. 32 (Schritt 15 Teil B): jeder Screen ausser der Stundenschreibung
 * ist ein eigenes, verzoegert geladenes Bundle. Der Rollenschutz laeuft vor
 * dem Nachladen, ein abgewiesener Aufruf laedt den Screen nicht herunter.
 * Die Stundenschreibung bleibt bewusst im Initial-Bundle: sie ist die
 * Startseite jeder Identitaet.
 */
export const routes: Routes = [
  {
    path: "",
    component: TimesheetComponent,
    title: "xTS TimeSheet",
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: "approvals",
    loadComponent: () =>
      import("./approval/approval.component").then(
        (module) => module.ApprovalComponent,
      ),
    title: "xTS Genehmigung",
    canActivate: [roleGuard("approver")],
  },
  {
    path: "reports",
    loadComponent: () =>
      import("./reporting/reporting.component").then(
        (module) => module.ReportingComponent,
      ),
    title: "xTS Reporting",
    // Entscheidung 19: approver geschnitten, controller/admin ungeschnitten.
    canActivate: [roleGuard(["approver", "controller", "admin"])],
  },
  {
    path: "planning",
    loadComponent: () =>
      import("./planning/planning.component").then(
        (module) => module.PlanningComponent,
      ),
    title: "xTS Ressourcenplanung",
    canActivate: [roleGuard("planner")],
  },
  {
    path: "orders",
    loadComponent: () =>
      import("./orders/orders.component").then(
        (module) => module.OrdersComponent,
      ),
    title: "xTS Beauftragung",
    canActivate: [roleGuard("planner")],
  },
  {
    // XTS-154: Einstellungen als eigenes, verzoegert geladenes Bundle mit
    // Kindrouten je Bereich; der Rollenschutz liegt in den Kindrouten.
    path: "einstellungen",
    loadChildren: () =>
      import("./settings/settings.routes").then(
        (module) => module.SETTINGS_ROUTES,
      ),
  },
  {
    // Alte Adresse der Verwaltung: Weiterleitung, der Schutz greift am Ziel.
    path: "admin",
    redirectTo: "einstellungen",
  },
  {
    path: "**",
    component: NotFoundComponent,
    title: "xTS – Seite nicht gefunden",
  },
];
