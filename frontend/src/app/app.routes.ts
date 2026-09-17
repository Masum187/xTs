import { inject } from "@angular/core";
import type { CanDeactivateFn, Routes } from "@angular/router";

import { ApprovalComponent } from "./approval/approval.component";
import { roleGuard } from "./auth/role.guard";
import { NotFoundComponent } from "./not-found.component";
import { OrdersComponent } from "./orders/orders.component";
import { PlanningComponent } from "./planning/planning.component";
import { ReportingComponent } from "./reporting/reporting.component";
import { UnsavedChangesService } from "./shared/unsaved-changes.service";
import { TimesheetComponent } from "./timesheet/timesheet.component";

/** Schutz vor Datenverlust (Audit Nr. 19): Verlassen nur nach Rueckfrage. */
const unsavedChangesGuard: CanDeactivateFn<unknown> = () =>
  inject(UnsavedChangesService).confirmDiscard();

export const routes: Routes = [
  {
    path: "",
    component: TimesheetComponent,
    title: "xTS TimeSheet",
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: "approvals",
    component: ApprovalComponent,
    title: "xTS Genehmigung",
    canActivate: [roleGuard("approver")],
  },
  {
    path: "reports",
    component: ReportingComponent,
    title: "xTS Reporting",
    // Entscheidung 19: approver geschnitten, controller/admin ungeschnitten.
    canActivate: [roleGuard(["approver", "controller", "admin"])],
  },
  {
    path: "planning",
    component: PlanningComponent,
    title: "xTS Ressourcenplanung",
    canActivate: [roleGuard("planner")],
  },
  {
    path: "orders",
    component: OrdersComponent,
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
