// Aenderungs- und Fehlerprotokoll (XTS-081) analog ZXTS_LOG_T: kritische
// Statuswechsel, Stammdaten- und Regelaenderungen sowie technische Fehler
// der Jobs landen in einem auswertbaren Log. Der Mock haelt es im Speicher;
// ein Testdaten-Reset leert es.

export const CATEGORIES = ["status", "job", "masterdata", "rule", "system"];
export const SEVERITIES = ["info", "error"];

const entries = [];
let counter = 0;

export function resetAuditLog() {
  entries.length = 0;
  counter = 0;
}

export function logEvent({
  actor,
  category,
  severity = "info",
  object,
  objectKey,
  from = null,
  to = null,
  message,
  details = {},
}) {
  counter += 1;
  const entry = {
    id: `LOG-${String(counter).padStart(6, "0")}`,
    at: new Date().toISOString(),
    actor,
    category,
    severity,
    object,
    objectKey,
    from,
    to,
    message,
    details,
  };
  entries.push(entry);
  return entry;
}

export function listAuditLog(filters = {}) {
  const { category, severity, object, actor, q, from, to } = filters;
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 200;
  const needle = (q ?? "").toLowerCase();
  return [...entries]
    .reverse()
    .filter((entry) => !category || entry.category === category)
    .filter((entry) => !severity || entry.severity === severity)
    .filter((entry) => !object || entry.object === object)
    .filter((entry) => !actor || entry.actor === actor)
    .filter((entry) => !from || entry.at.slice(0, 10) >= from)
    .filter((entry) => !to || entry.at.slice(0, 10) <= to)
    .filter(
      (entry) =>
        !needle ||
        entry.objectKey.toLowerCase().includes(needle) ||
        entry.message.toLowerCase().includes(needle),
    )
    .slice(0, limit)
    .map((entry) => ({ ...entry, details: { ...entry.details } }));
}
