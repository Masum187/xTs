export const employees = [
  {
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    firstName: "Stephan",
    lastName: "Schilz",
    company: "QualityTimes",
    sapAccount: "SSCHILZ",
    active: true,
  },
  {
    extNr: "ROEPER",
    displayName: "Christian Roeper",
    firstName: "Christian",
    lastName: "Roeper",
    company: "QualityTimes",
    sapAccount: "CROEPER",
    active: true,
  },
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

export const enabledCostObjects = [
  {
    id: "000001",
    extNr: "SCHILZ",
    coIdent: "700000000004",
    description: "SAP-Implementierung, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
    remainingHours: 240,
  },
  {
    id: "000002",
    extNr: "SCHILZ",
    coIdent: "600000000001",
    description: "SAP-Support, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
    remainingHours: 120,
  },
  {
    id: "000003",
    extNr: "SCHILZ",
    coIdent: "600000000009",
    description: "Altprojekt Migration, Stephan Schilz",
    validFrom: "2026-01-01",
    validTo: "2026-03-31",
    remainingHours: 0,
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
];
