import { D, type Decoder } from "../shared/decode";
import type { AuthProfile } from "./auth.models";

export const authProfile: Decoder<AuthProfile> = D.object<AuthProfile>({
  extNr: D.string,
  displayName: D.string,
  company: D.text,
  roles: D.array(D.literal("user", "approver", "planner", "admin")),
  aadUpn: D.optional(D.nullable(D.string)),
  mappedBy: D.optional(D.literal("oid", "upn")),
  today: D.optional(D.date),
  timesheetWindow: D.optional(
    D.object<{ from: string; to: string }>({ from: D.date, to: D.date }),
  ),
});
