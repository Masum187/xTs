export type AuthRole = "user" | "approver" | "planner" | "admin";

export type AuthState =
  "loading" | "ready" | "not-mapped" | "inactive" | "error";

export interface AuthProfile {
  extNr: string;
  displayName: string;
  company: string;
  roles: AuthRole[];
}

export interface MockPersona {
  upn: string;
  label: string;
}

// Demo-Personas der Mock-API; entfaellt mit der echten OAuth-Anbindung (XTS-050).
export const MOCK_PERSONAS: MockPersona[] = [
  { upn: "stephan.schilz@qualitytimes.de", label: "Stephan Schilz (User)" },
  {
    upn: "christian.roeper@qualitytimes.de",
    label: "Christian Roeper (PL, RM & Admin)",
  },
  { upn: "petra.altmann@qualitytimes.de", label: "Petra Altmann (inaktiv)" },
  { upn: "neu.extern@qualitytimes.de", label: "Neuer Externer (ohne Mapping)" },
];
