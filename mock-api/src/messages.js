// Fachlich verstaendliche Fehlermeldungen (XTS-081) zu den technischen
// Fehlercodes der Mock-API. Die Codes bleiben der stabile Kontrakt fuer
// Tests und Frontend-Logik, die Texte gehen 1:1 an den Anwender.

const MESSAGES = {
  NO_EXTNR_MAPPING:
    "Ihr Benutzerkonto ist noch keinem xTS-Mitarbeiter (EXTNR) zugeordnet.",
  EMPLOYEE_INACTIVE:
    "Ihr Mitarbeiterstamm ist inaktiv oder gelöscht. Eine Anmeldung ist nicht möglich.",
  NOT_AUTHORIZED: "Für diese Aktion fehlt die erforderliche Berechtigung.",
  INVALID_TOKEN:
    "Das Anmelde-Token konnte nicht gelesen werden. Bitte melden Sie sich erneut an.",
  TIMESHEET_KEY_REQUIRED: "Mitarbeiter und Tagesdatum sind Pflicht.",
  INVALID_TIMESHEET: "Der Stundenzettel enthält ungültige Werte.",
  INVALID_JSON: "Die Anfrage enthält kein gültiges JSON.",
  PROTECTED_FIELDS:
    "Genehmigungsfelder werden vom System gesetzt und dürfen nicht mitgesendet werden.",
  INVALID_STATUS:
    "Mitarbeiter können einen Tag nur als Entwurf speichern (E) oder zur Genehmigung freigeben (F).",
  TIMESHEET_LOCKED:
    "Der Tag ist freigegeben oder genehmigt und kann nicht mehr geändert werden.",
  SUBMIT_REQUIRES_HOURS:
    "Zur Genehmigung freigeben ist nur mit mindestens einer Position und Stunden größer 0 möglich.",
  APPROVAL_FIELDS_REQUIRED:
    "Mitarbeiter, Tagesdatum und Aktion sind für die Genehmigung Pflicht.",
  INVALID_APPROVAL_ACTION: "Die Aktion muss genehmigen oder zurückweisen sein.",
  TIMESHEET_NOT_FOUND: "Der Tag wurde nicht gefunden.",
  TIMESHEET_NOT_SUBMITTED:
    "Nur zur Genehmigung freigegebene Tage (Status F) können bearbeitet werden.",
  SELF_APPROVAL:
    "Eigene Tage dürfen nicht selbst genehmigt oder zurückgewiesen werden (Vier-Augen-Prinzip).",
  TIMESHEET_EMPTY:
    "Der Tag enthält keine Stunden und kann nicht genehmigt werden.",
  REJECTION_REASON_REQUIRED: "Für die Rückweisung ist ein Grund erforderlich.",
  COST_OBJECT_NOT_ENABLED:
    "Kontierung ist für diesen Tag nicht freigeschaltet oder das Kontingent ist ausgeschöpft.",
  INVALID_RULE: "Der Regelwert ist für diesen Infotyp nicht zulässig.",
  INVALID_START_MONTH:
    "Der Startmonat muss im Format JJJJ-MM angegeben werden.",
  INVALID_PLANNING_ENTRY:
    "Planstunden müssen eine Zahl größer oder gleich 0 sein.",
  UNKNOWN_PLANNING_COMBINATION:
    "Für diese Kombination aus Mitarbeiter, Kontierung und Monat gibt es keine gültige Planungszeile.",
  PLANNING_ENTRY_LOCKED:
    "Die Planzeile ist bereits freigegeben oder beauftragt und kann nicht mehr geändert werden.",
  PLANNING_ENTRY_NOT_FOUND: "Für diesen Monat sind keine Planstunden erfasst.",
  PLANNING_ENTRY_NOT_RELEASABLE:
    "Nur Vorschläge (Status V) mit Stunden größer 0 können für die BANF freigegeben werden.",
  INVALID_ORDER:
    "Für die Beauftragung fehlen Mitarbeiter, Kontierung oder Planmonate.",
  DUPLICATE_PLANNING_REFS:
    "Ein Planmonat darf in einer Beauftragung nur einmal referenziert werden.",
  PLANNING_ROWS_NOT_AVAILABLE:
    "Mindestens ein Planmonat ist nicht mehr freigegeben oder bereits beauftragt.",
  ORDER_NOT_FOUND: "Die Beauftragung wurde nicht gefunden.",
  ORDER_TEXT_LOCKED:
    "Der BANF-Positionstext kann nach Anlage der BANF nicht mehr geändert werden.",
  INVALID_ORDER_TEXT: "Der BANF-Positionstext darf nicht leer sein.",
  BANF_ALREADY_EXISTS: "Zu dieser Beauftragung existiert bereits eine BANF.",
  INVALID_EMPLOYEE:
    "Der Mitarbeiter kann nicht gespeichert werden, Pflichtfelder fehlen.",
  INVALID_AAD_OID:
    "Die Entra-Objekt-ID muss eine GUID sein (z. B. 3f1c2a7e-5b3d-4c8e-9a1f-0d2e4b6c8a10).",
  AAD_OID_IN_USE:
    "Die Entra-Objekt-ID ist bereits einem anderen Mitarbeiter zugeordnet.",
  AAD_UPN_IN_USE:
    "Der Entra-UPN ist bereits einem anderen Mitarbeiter zugeordnet.",
  UNKNOWN_RESOURCE_MANAGER:
    "Der angegebene Ressourcenmanager ist kein bekannter Mitarbeiter.",
  INVALID_TEAM: "Das Team kann nicht gespeichert werden, Pflichtfelder fehlen.",
  INVALID_TEAM_ASSIGNMENT:
    "Die Teamzuordnung kann nicht gespeichert werden, Pflichtfelder fehlen oder der Zeitraum ist ungültig.",
  TEAM_ASSIGNMENT_OVERLAP:
    "Die Teamzuordnung überschneidet sich mit einer bestehenden Zuordnung.",
  TEAM_NOT_AVAILABLE: "Das Team ist inaktiv oder gelöscht.",
  TEAM_ASSIGNMENT_NOT_FOUND: "Die Teamzuordnung wurde nicht gefunden.",
  UNKNOWN_EMPLOYEE: "Der Mitarbeiter ist nicht bekannt.",
  INVALID_COST_OBJECT:
    "Die Kontierung kann nicht gespeichert werden, Pflichtfelder fehlen.",
  INVALID_COST_OBJECT_TYPE:
    "Die Kontierungsart ist unzulässig. Erlaubt sind KS, OR, PR, FB und KL.",
  COST_OBJECT_NOT_AVAILABLE: "Die Kontierung ist gelöscht oder unbekannt.",
  INVALID_ASSIGNMENT:
    "Die Zuordnung kann nicht gespeichert werden, Pflichtfelder fehlen oder der Zeitraum ist ungültig.",
  ASSIGNMENT_OVERLAP:
    "Die Zuordnung überschneidet sich mit einer bestehenden Zuordnung.",
  ASSIGNMENT_NOT_FOUND: "Die Zuordnung wurde nicht gefunden.",
};

export function messageFor(code, payload = {}) {
  const base = MESSAGES[code];
  if (!base) return `Die Anfrage konnte nicht verarbeitet werden (${code}).`;
  if (payload.status && code === "TIMESHEET_LOCKED") {
    return `${base} (Status ${payload.status})`;
  }
  if (Array.isArray(payload.fields) && payload.fields.length > 0) {
    return `${base} (${payload.fields.join(", ")})`;
  }
  if (payload.conflictId) {
    return `${base} (${payload.conflictId})`;
  }
  if (payload.coIdent && code === "COST_OBJECT_NOT_ENABLED") {
    return `${base} (${payload.coIdent})`;
  }
  return base;
}
