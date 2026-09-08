import { D, type Decoder, type Shape } from "../shared/decode";
import type {
  ApprovalDay,
  EnabledCostObject,
  TimesheetDay,
  TimesheetLine,
} from "./timesheet.models";

export const timesheetLine: Decoder<TimesheetLine> = D.object<TimesheetLine>({
  coIdent: D.string,
  description: D.text,
  hours: D.number,
});

const timesheetDayShape: Shape<TimesheetDay> = {
  extNr: D.string,
  date: D.date,
  startTime: D.time,
  endTime: D.time,
  breakMinutes: D.integer,
  location: D.literal("remote", "on-site"),
  status: D.literal("E", "F", "G", "A"),
  workHours: D.optional(D.nullable(D.number)),
  varianceReason: D.optional(D.string),
  rejectionReason: D.optional(D.string),
  approvedBy: D.optional(D.string),
  approvedAt: D.optional(D.dateTime),
  weDocument: D.optional(D.string),
  lines: D.array(timesheetLine),
};

export const timesheetDay: Decoder<TimesheetDay> =
  D.object<TimesheetDay>(timesheetDayShape);

export const approvalDay: Decoder<ApprovalDay> = D.object<ApprovalDay>({
  ...timesheetDayShape,
  displayName: D.string,
});

export const enabledCostObject: Decoder<EnabledCostObject> =
  D.object<EnabledCostObject>({
    extNr: D.string,
    coIdent: D.string,
    description: D.text,
    validFrom: D.date,
    validTo: D.date,
    orderedHours: D.number,
    bookedHours: D.number,
    remainingHours: D.number,
  });
