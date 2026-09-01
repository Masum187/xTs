import type { Routes } from "@angular/router";

import { ApprovalComponent } from "./approval/approval.component";
import { TimesheetComponent } from "./timesheet/timesheet.component";

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
  },
];
