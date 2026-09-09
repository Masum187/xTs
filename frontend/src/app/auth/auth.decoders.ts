import { D, type Decoder } from "../shared/decode";
import type { AuthProfile } from "./auth.models";

export const authProfile: Decoder<AuthProfile> = D.object<AuthProfile>({
  extNr: D.string,
  displayName: D.string,
  company: D.text,
  roles: D.array(
    D.literal("user", "approver", "planner", "admin", "controller"),
  ),
  aadUpn: D.optional(D.nullable(D.string)),
  mappedBy: D.optional(D.literal("oid", "upn")),
  // Pflicht (Entscheidung 18): ohne Zeitraum wuerde die Datumsregel im
  // Client stillschweigend entfallen, daher lieber INVALID_RESPONSE.
  today: D.date,
  timesheetWindow: D.object<{ from: string; to: string }>({
    from: D.date,
    to: D.date,
  }),
});
