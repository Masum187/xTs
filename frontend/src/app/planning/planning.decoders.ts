import { D, type Decoder } from "../shared/decode";
import type {
  PlanningCell,
  PlanningMonth,
  PlanningOverview,
  PlanningRow,
  PlanningUtilization,
  PlanningUtilizationMonth,
  SaveEntryResult,
} from "./planning.models";

const planningStatus = D.literal("V", "F", "P", "B");

const capacitySource = D.literal("explicit", "fallback");

export const planningMonth: Decoder<PlanningMonth> = D.object<PlanningMonth>({
  month: D.string,
  availableHours: D.number,
  source: capacitySource,
  workdays: D.nullable(D.number),
  holidays: D.nullable(D.number),
});

export const planningCell: Decoder<PlanningCell> = D.object<PlanningCell>({
  month: D.string,
  hours: D.number,
  status: D.nullable(planningStatus),
  valid: D.boolean,
  teamMissing: D.optional(D.boolean),
  locked: D.boolean,
  overbooked: D.boolean,
});

export const planningRow: Decoder<PlanningRow> = D.object<PlanningRow>({
  extNr: D.string,
  displayName: D.string,
  teamId: D.text,
  coIdent: D.string,
  description: D.text,
  validFrom: D.date,
  validTo: D.date,
  cells: D.array(planningCell),
});

export const planningUtilizationMonth: Decoder<PlanningUtilizationMonth> =
  D.object<PlanningUtilizationMonth>({
    month: D.string,
    plannedHours: D.number,
    availableHours: D.number,
    utilizationPercent: D.nullable(D.number),
    overbooked: D.boolean,
  });

export const planningUtilization: Decoder<PlanningUtilization> =
  D.object<PlanningUtilization>({
    extNr: D.string,
    displayName: D.string,
    months: D.array(planningUtilizationMonth),
  });

export const planningOverview: Decoder<PlanningOverview> =
  D.object<PlanningOverview>({
    months: D.array(planningMonth),
    utilization: D.array(planningUtilization),
    rows: D.array(planningRow),
  });

export const saveEntryResult: Decoder<SaveEntryResult> =
  D.object<SaveEntryResult>({
    entry: D.object<SaveEntryResult["entry"]>({
      extNr: D.string,
      coIdent: D.string,
      month: D.string,
      hours: D.number,
      status: planningStatus,
    }),
    overbooked: D.boolean,
    availableHours: D.number,
    plannedTotal: D.number,
  });
