export const employees = [
  {
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    firstName: "Stephan",
    lastName: "Schilz",
    company: "QualityTimes",
    sapAccount: "SSCHILZ",
    active: true,
    teamId: "TRANSFORMATION_MC",
    roles: ["user"],
  },
  {
    extNr: "ROEPER",
    displayName: "Christian Roeper",
    firstName: "Christian",
    lastName: "Roeper",
    company: "QualityTimes",
    sapAccount: "CROEPER",
    active: true,
    teamId: "ENTW_SUPPORT",
    roles: ["user", "approver"],
  },
  {
    extNr: "ALTMANN",
    displayName: "Petra Altmann",
    firstName: "Petra",
    lastName: "Altmann",
    company: "QualityTimes",
    sapAccount: null,
    active: false,
    teamId: "ENTW_SUPPORT",
    roles: ["user"],
  },
];

// Simuliert das AD/OAuth-Mapping aus der Entscheidungsvorlage
// docs/entscheidungsvorlage-extnr-mapping.md. Ein Eintrag ohne extNr steht
// fuer einen OAuth-User, der (noch) nicht auf ZXTS_WIW_T gemappt ist.
export const oauthMappings = [
  { upn: "stephan.schilz@qualitytimes.de", extNr: "SCHILZ" },
  { upn: "christian.roeper@qualitytimes.de", extNr: "ROEPER" },
  { upn: "petra.altmann@qualitytimes.de", extNr: "ALTMANN" },
  { upn: "neu.extern@qualitytimes.de", extNr: null },
];

export const teams = [
  {
    id: "TRANSFORMATION_MC",
    name: "Transformation MC",
    active: true,
  },
  {
    id: "ENTW_SUPPORT",
    name: "Entw.-Support",
    active: true,
  },
];

export const costObjects = [
  {
    id: "000001",
    coIdent: "700000000004",
    type: "OR",
    description: "SAP-Implementierung, Stephan Schilz",
    active: true,
  },
  {
    id: "000002",
    coIdent: "600000000001",
    type: "KS",
    description: "SAP-Support, Stephan Schilz",
    active: true,
  },
  {
    id: "000003",
    coIdent: "600000000009",
    type: "KS",
    description: "Altprojekt Migration, Stephan Schilz",
    active: true,
  },
];

// Ampelgrenzen fuer den Budget-Monitor (XTS-071): simuliertes Customizing,
// spaeter aus ZXTS_REGELN_T.
export const budgetTrafficLight = {
  warnPercent: 80,
  criticalPercent: 95,
};

export const enabledCostObjects = [
  {
    id: "000001",
    extNr: "SCHILZ",
    coIdent: "700000000004",
    description: "SAP-Implementierung, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
    budgetHours: 320,
    remainingHours: 240,
  },
  {
    id: "000002",
    extNr: "SCHILZ",
    coIdent: "600000000001",
    description: "SAP-Support, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
    budgetHours: 160,
    remainingHours: 120,
  },
  {
    id: "000003",
    extNr: "SCHILZ",
    coIdent: "600000000009",
    description: "Altprojekt Migration, Stephan Schilz",
    validFrom: "2026-01-01",
    validTo: "2026-03-31",
    budgetHours: 80,
    remainingHours: 0,
  },
  {
    id: "000004",
    extNr: "ROEPER",
    coIdent: "600000000001",
    description: "SAP-Support, Christian Roeper",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
    budgetHours: 100,
    remainingHours: 60,
  },
];

export const timesheets = [
  {
    extNr: "SCHILZ",
    date: "2026-04-13",
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "E",
    lines: [
      {
        coIdent: "700000000004",
        description: "Daily Projektabstimmung",
        hours: 2,
      },
    ],
  },
  {
    extNr: "SCHILZ",
    date: "2026-04-10",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    location: "on-site",
    status: "A",
    rejectionReason: "Bitte Projektreferenz in der Beschreibung ergänzen.",
    lines: [
      {
        coIdent: "600000000001",
        description: "Support",
        hours: 7.5,
      },
    ],
  },
  {
    extNr: "SCHILZ",
    date: "2026-04-09",
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    location: "remote",
    status: "G",
    lines: [
      {
        coIdent: "700000000004",
        description: "Datenmodell Review",
        hours: 8,
      },
    ],
  },
  {
    extNr: "SCHILZ",
    date: "2026-04-08",
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 60,
    location: "remote",
    status: "F",
    lines: [
      {
        coIdent: "700000000004",
        description: "Migrationskonzept Kapitel 3",
        hours: 8,
      },
    ],
  },
  {
    extNr: "ROEPER",
    date: "2026-04-08",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    location: "on-site",
    status: "F",
    lines: [
      {
        coIdent: "600000000001",
        description: "Basis-Setup Testmandant",
        hours: 8,
      },
    ],
  },
  {
    extNr: "ROEPER",
    date: "2026-03-31",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    location: "remote",
    status: "F",
    lines: [
      {
        coIdent: "600000000001",
        description: "Transportstrategie Abstimmung",
        hours: 7.5,
      },
    ],
  },
];
