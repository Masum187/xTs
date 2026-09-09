export type AuthRole = "user" | "approver" | "planner" | "admin" | "controller";

export type AuthState =
  | "loading"
  | "ready"
  | "not-mapped"
  | "inactive"
  | "signed-out"
  | "not-configured"
  | "error";

export interface AuthProfile {
  extNr: string;
  displayName: string;
  company: string;
  roles: AuthRole[];
  aadUpn?: string | null;
  /** Ueber welchen Token-Claim das Mapping auf EXTNR gelang (XTS-050). */
  mappedBy?: "oid" | "upn";
  /** Systemdatum des Servers (Entscheidung 18); fachliche Basis fuer "heute". */
  today: string;
  /** Erfassbarer Zeitraum der Stundenerfassung, inklusive (Entscheidung 18). */
  timesheetWindow: { from: string; to: string };
}

/** Token-Claims, die xTS fuer das EXTNR-Mapping auswertet (XTS-050). */
export interface AuthClaims {
  oid: string;
  upn: string;
}

export interface MockPersona extends AuthClaims {
  label: string;
}

// Demo-Personas der Mock-API mit simulierten Entra-Claims; entfaellt mit
// der echten OAuth-Anbindung (XTS-050).
export const MOCK_PERSONAS: MockPersona[] = [
  {
    oid: "3f1c2a7e-5b3d-4c8e-9a1f-0d2e4b6c8a10",
    upn: "stephan.schilz@qualitytimes.de",
    label: "Stephan Schilz (User)",
  },
  {
    oid: "7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42",
    upn: "christian.roeper@qualitytimes.de",
    label: "Christian Roeper (PL, RM & Admin)",
  },
  {
    oid: "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
    upn: "maria.weber@qualitytimes.de",
    label: "Maria Weber (PL, nur 700000000004)",
  },
  {
    oid: "c2d4e6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    upn: "petra.altmann@qualitytimes.de",
    label: "Petra Altmann (inaktiv)",
  },
  {
    oid: "00000000-0000-4000-8000-000000000099",
    upn: "neu.extern@qualitytimes.de",
    label: "Neuer Externer (ohne Mapping)",
  },
];
