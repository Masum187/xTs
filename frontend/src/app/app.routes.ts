import { inject } from "@angular/core";
import type { CanActivateFn, Routes } from "@angular/router";
import { Router } from "@angular/router";

import { ApprovalComponent } from "./approval/approval.component";
import type { AuthRole } from "./auth/auth.models";
import { AuthService } from "./auth/auth.service";
import { PlanningComponent } from "./planning/planning.component";
import { ReportingComponent } from "./reporting/reporting.component";
import { TimesheetComponent } from "./timesheet/timesheet.component";

const roleGuard =
  (role: AuthRole): CanActivateFn =>
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    return auth.hasRole(role) ? true : router.parseUrl("/");
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
];
