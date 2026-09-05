import { inject } from "@angular/core";
import type { CanActivateFn, Routes } from "@angular/router";
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
import { TimesheetComponent } from "./timesheet/timesheet.component";

const roleGuard =
  (role: AuthRole): CanActivateFn =>
  async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    if (auth.hasRole(role)) return true;
    // Kein stilles Umleiten: der Grund wird in der Kopfzeile angezeigt.
    if (auth.state() === "ready") {
      auth.showAccessNotice(
        accessDeniedMessage(role, state.url),
        router.currentNavigation()?.id ?? 0,
      );
    }
    return router.parseUrl("/");
  };

export const routes: Routes = [
  {
    path: "",
    component: TimesheetComponent,
    title: "xTS TimeSheet",
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
    canActivate: [roleGuard("approver")],
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
