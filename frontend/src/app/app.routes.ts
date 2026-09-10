import { inject } from "@angular/core";
import type { CanActivateFn, CanDeactivateFn, Routes } from "@angular/router";
import { Router } from "@angular/router";

import { AdminComponent } from "./admin/admin.component";
import { ApprovalComponent } from "./approval/approval.component";
import { accessDeniedMessage } from "./auth/auth.logic";
import type { AuthRole } from "./auth/auth.models";
import { AuthService } from "./auth/auth.service";
import { NotFoundComponent } from "./not-found.component";
import { OrdersComponent } from "./orders/orders.component";
import { PlanningComponent } from "./planning/planning.component";
import { ReportingComponent } from "./reporting/reporting.component";
import { UnsavedChangesService } from "./shared/unsaved-changes.service";
import { TimesheetComponent } from "./timesheet/timesheet.component";

/** Zugang, wenn das Konto mindestens eine der Rollen hat. */
const roleGuard =
  (role: AuthRole | AuthRole[]): CanActivateFn =>
  async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    const roles = Array.isArray(role) ? role : [role];
    if (roles.some((item) => auth.hasRole(item))) return true;
    // Kein stilles Umleiten: der Grund wird in der Kopfzeile angezeigt.
    if (auth.state() === "ready") {
      auth.showAccessNotice(
        accessDeniedMessage(role, state.url),
        router.currentNavigation()?.id ?? 0,
      );
    }
    return router.parseUrl("/");
  };

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
    path: "admin",
    component: AdminComponent,
    title: "xTS Verwaltung",
    canActivate: [roleGuard("admin")],
  },
  {
    path: "**",
    component: NotFoundComponent,
    title: "xTS – Seite nicht gefunden",
  },
];
