import { inject } from "@angular/core";
import type { CanActivateFn, Routes } from "@angular/router";
import { Router } from "@angular/router";

import { ApprovalComponent } from "./approval/approval.component";
import { AuthService } from "./auth/auth.service";
import { TimesheetComponent } from "./timesheet/timesheet.component";

const approverGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  return auth.hasRole("approver") ? true : router.parseUrl("/");
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
    canActivate: [approverGuard],
  },
];
