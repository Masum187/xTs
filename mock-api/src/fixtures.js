// Mitarbeiter analog ZXTS_WIW_T (XTS-010) inkl. AAD_OID/AAD_UPN (XTS-050).
export const employees = [
  {
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    firstName: "Stephan",
    lastName: "Schilz",
    company: "QualityTimes",
    sapAccount: "SSCHILZ",
    aadOid: "3f1c2a7e-5b3d-4c8e-9a1f-0d2e4b6c8a10",
    aadUpn: "stephan.schilz@qualitytimes.de",
    active: true,
    deleted: false,
    resourceManager: "ROEPER",
    roles: ["user"],
  },
  {
    extNr: "ROEPER",
    displayName: "Christian Roeper",
    firstName: "Christian",
    lastName: "Roeper",
    company: "QualityTimes",
    sapAccount: "CROEPER",
    aadOid: "7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42",
    aadUpn: "christian.roeper@qualitytimes.de",
    active: true,
    deleted: false,
    resourceManager: null,
    roles: ["user", "approver", "planner", "admin"],
  },
  {
    extNr: "ALTMANN",
    displayName: "Petra Altmann",
    firstName: "Petra",
    lastName: "Altmann",
    company: "QualityTimes",
    sapAccount: null,
    aadOid: "c2d4e6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    aadUpn: "petra.altmann@qualitytimes.de",
    active: false,
    deleted: false,
    resourceManager: "ROEPER",
    roles: ["user"],
  },
];

// AD/OAuth-Mapping (XTS-050, Entscheidungsvorlage Option B, technisch
// vorbereitet): ZXTS_WIW_T traegt AAD_OID (Entra objectId, Claim `oid`) als
// fuehrendes Mapping und AAD_UPN als Anzeige-/Fallback-Attribut. Ein
// Token ohne Treffer (z. B. Persona "Neuer Externer") ist nicht gemappt.

// Teams analog ZXTS_TEAM_T (XTS-011).
export const teams = [
  {
    id: "TRANSFORMATION_MC",
    name: "Transformation MC",
    active: true,
    deleted: false,
  },
  {
    id: "ENTW_SUPPORT",
    name: "Entw.-Support",
    active: true,
    deleted: false,
  },
];

// Zeitliche Teamzuordnung analog ZXTS_MATEAM_T (XTS-012): ein Mitarbeiter
// gehoert je Zeitraum genau einem Team an; Ueberlappungen sind unzulaessig.
export const teamAssignments = [
  {
    id: "MT-000001",
    extNr: "SCHILZ",
    teamId: "TRANSFORMATION_MC",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    deleted: false,
  },
  {
    id: "MT-000002",
    extNr: "ROEPER",
    teamId: "ENTW_SUPPORT",
    validFrom: "2026-01-01",
    validTo: "2027-12-31",
    deleted: false,
  },
  {
    id: "MT-000003",
    extNr: "ALTMANN",
    teamId: "ENTW_SUPPORT",
    validFrom: "2025-01-01",
    validTo: "2025-12-31",
    deleted: false,
  },
];

// Kontierungen analog ZXTS_KONT_T (XTS-013).
export const costObjects = [
  {
    id: "000001",
    coIdent: "700000000004",
    type: "OR",
    description: "SAP-Implementierung, Stephan Schilz",
    active: true,
    deleted: false,
  },
  {
    id: "000002",
    coIdent: "600000000001",
    type: "KS",
    description: "SAP-Support, Stephan Schilz",
    active: true,
    deleted: false,
  },
  {
    id: "000003",
    coIdent: "600000000009",
    type: "KS",
    description: "Altprojekt Migration, Stephan Schilz",
    active: true,
    deleted: false,
  },
];

// Stub fuer die Gueltigkeitspruefung gegen SAP CO (XTS-013, Phase 1):
// bekannte Kontierungen mit ihrer CO-Objektart. Alles andere gilt als
// "in SAP CO nicht gefunden".
export const sapCostObjectStub = {
  700000000004: "OR",
  600000000001: "KS",
  600000000009: "KS",
  600000000042: "KS",
  700000000010: "PR",
};

// Ampelgrenzen fuer den Budget-Monitor (XTS-071): simuliertes Customizing,
// spaeter aus ZXTS_REGELN_T.
export const budgetTrafficLight = {
  warnPercent: 80,
  criticalPercent: 95,
};

// Regelwerk analog ZXTS_REGELN_T (XTS-040). Infotyp 1 steuert die
// Aggregation je Mitarbeiter/Kontierung, Infotyp 2 die Freischaltung der
// Stundenschreibung (MVP-Default: P = ab BANF vorhanden; B = ab Bestellung).
export const rules = [
  { infotype: 1, value: "MA_KONT", active: true },
  { infotype: 2, value: "P", active: true },
  // Entscheidung 18: Vormonat bis einschliesslich Tag 5 des Folgemonats.
  { infotype: 3, value: "5", active: true },
];

// Stammdaten-Zuordnung Mitarbeiter/Kontierung mit Gueltigkeit (Planungsbasis).
// Die Freischaltung fuer die Stundenschreibung (ZXTS_MAZUKONT_T) wird seit
// Epic 5 aus den Beauftragungen abgeleitet, nicht mehr hier gepflegt.
export const assignments = [
  {
    id: "000001",
    extNr: "SCHILZ",
    coIdent: "700000000004",
    description: "SAP-Implementierung, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2027-02-28",
  },
  {
    id: "000002",
    extNr: "SCHILZ",
    coIdent: "600000000001",
    description: "SAP-Support, Stephan Schilz",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
  },
  {
    id: "000003",
    extNr: "SCHILZ",
    coIdent: "600000000009",
    description: "Altprojekt Migration, Stephan Schilz",
    validFrom: "2026-01-01",
    validTo: "2026-03-31",
  },
  {
    id: "000004",
    extNr: "ROEPER",
    coIdent: "600000000001",
    description: "SAP-Support, Christian Roeper",
    validFrom: "2026-02-01",
    validTo: "2026-04-30",
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
    varianceReason: "Restzeit interne Abstimmung ohne Kontierung",
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

// Simulierter SAP-Werkkalender (XTS-022): verfuegbare Arbeitsstunden je Monat.
export const workCalendar = {
  defaultHours: 160,
  months: {
    "2026-03": 176,
    "2026-04": 168,
    "2026-05": 160,
  },
};

// Planstunden analog ZXTS_MAPLAN_T (Epic 3). Status: V = Vorschlag
// (editierbar), F = fuer BANF freigegeben, P = BANF erstellt, B = Bestellung.
export const planningEntries = [
  {
    extNr: "SCHILZ",
    coIdent: "700000000004",
    month: "2026-04",
    hours: 60,
    status: "V",
  },
  {
    extNr: "SCHILZ",
    coIdent: "700000000004",
    month: "2026-05",
    hours: 80,
    status: "V",
  },
  {
    extNr: "SCHILZ",
    coIdent: "600000000001",
    month: "2026-03",
    hours: 30,
    status: "P",
  },
  {
    extNr: "ROEPER",
    coIdent: "600000000001",
    month: "2026-04",
    hours: 20,
    status: "F",
  },
];

// Simulierte MM-Bestellungen fuer den Bestelldaten-Job (XTS-033): je
// Kontierung eine Bestellung; Kontierungen ohne Eintrag erzeugen einen
// Fehlerprotokoll-Fall.
export const purchaseOrders = {
  700000000004: { ebeln: "4500001234" },
};

// Bestandsdaten der Beauftragung (Epic 4/5): bereits bestellte Beauftragungen,
// aus denen die Kontierungsfreischaltung (XTS-041) abgeleitet wird.
export const seedOrders = [
  {
    orderId: "BEAUF-9001",
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    coIdent: "700000000004",
    text: "SAP-Implementierung Stephan Schilz",
    periodFrom: "2026-02",
    periodTo: "2027-02",
    hours: 320,
    planningRefs: [],
    status: "bestellt",
    banfNumber: "10009001",
    banfItem: "00010",
    ebeln: "4500001234",
    ebelp: "00010",
  },
  {
    orderId: "BEAUF-9002",
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    coIdent: "600000000001",
    text: "SAP-Support Stephan Schilz",
    periodFrom: "2026-02",
    periodTo: "2026-04",
    hours: 160,
    planningRefs: [],
    status: "bestellt",
    banfNumber: "10009002",
    banfItem: "00010",
    ebeln: "4500002001",
    ebelp: "00010",
  },
  {
    orderId: "BEAUF-9003",
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    coIdent: "600000000009",
    text: "Altprojekt Migration Stephan Schilz",
    periodFrom: "2026-01",
    periodTo: "2026-03",
    hours: 80,
    planningRefs: [],
    status: "bestellt",
    banfNumber: "10009003",
    banfItem: "00010",
    ebeln: "4500002002",
    ebelp: "00010",
  },
  {
    orderId: "BEAUF-9004",
    extNr: "ROEPER",
    displayName: "Christian Roeper",
    coIdent: "600000000001",
    text: "SAP-Support Christian Roeper",
    periodFrom: "2026-02",
    periodTo: "2026-04",
    hours: 100,
    planningRefs: [],
    status: "bestellt",
    banfNumber: "10009004",
    banfItem: "00010",
    ebeln: "4500002003",
    ebelp: "00010",
  },
];
