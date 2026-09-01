# xTS OData Contract Baseline

Diese Datei beschreibt die fachlichen Service-Kontrakte fuer SAP-OData und die Mock-API. Die Mock-API liegt in `mock-api/` und bildet die wichtigsten Antwortformen fuer die Frontend-Entwicklung ab.

## Services

| Service     | Pfad                          | Zweck                                             |
| ----------- | ----------------------------- | ------------------------------------------------- |
| Stammdaten  | `/odata/Employees`            | Mitarbeiter lesen                                 |
| Stammdaten  | `/odata/Teams`                | Teams lesen                                       |
| Stammdaten  | `/odata/CostObjects`          | Kontierungen lesen                                |
| Timesheet   | `/odata/MyProfile`            | Angemeldeten Benutzer auf `EXTNR` abbilden        |
| Timesheet   | `/odata/MyEnabledCostObjects` | Freigeschaltete Kontierungen mit Reststunden      |
| Timesheet   | `/odata/MyTimesheets`         | Eigene Stundeneintraege                           |
| Timesheet   | `/odata/TimesheetDays`        | Tageskopf mit Leistungspositionen speichern       |
| Genehmigung | `/odata/ApprovalTimesheets`   | Freigegebene Tage (Status `F`) fuer Projektleiter |
| Genehmigung | `/odata/TimesheetApprovals`   | Tag genehmigen oder zurueckweisen                 |

## Genehmigungs-Verhalten

- `GET /odata/ApprovalTimesheets` liefert alle Tage mit Status `F` ueber alle Mitarbeiter, inkl. `displayName`; optionale Filter `?month=YYYY-MM` und `?extNr=`.
- `POST /odata/TimesheetApprovals` mit `{ extNr, date, action }` verarbeitet genau einen Tag; nur Status `F` ist zulaessig (sonst HTTP 409).
  - `action: "approve"` setzt Status `G`, protokolliert `approvedBy`/`approvedAt` und simuliert die synchrone Wareneingangsbuchung (XTS-061A) ueber ein `weDocument` (`WE-000001`, fortlaufend). Genehmigte Tage koennen im MVP nicht zurueckgesetzt werden.
  - `action: "reject"` erfordert `reason` (sonst HTTP 400), setzt Status `A` und schreibt den Grund nach `rejectionReason`.
- Bis XTS-050 entschieden ist, simuliert die Mock-API feste Personas: `employees[0]` schreibt Stunden, `employees[1]` genehmigt.

## Timesheet-Verhalten

- `GET /odata/MyTimesheets` liefert alle eigenen Tage absteigend nach Datum, optional gefiltert mit `?date=YYYY-MM-DD`.
- `POST /odata/TimesheetDays` ist ein Upsert je `EXTNR` + Datum; `extNr` und `date` sind Pflicht (sonst HTTP 400). Die Mock-API haelt die Tage im Speicher, damit Navigation und Korrektur-Flows entwickelbar sind.
- Zurueckgewiesene Tage (Status `A`) tragen den Grund im Feld `rejectionReason`. Beim erneuten Speichern/Freigeben durch den Mitarbeiter wird das Feld entfernt (Flow `A -> E -> F`).

## Response Shape

Listen verwenden OData-nahe Form:

```json
{
  "value": []
}
```

Einzelobjekte werden direkt als JSON-Objekt geliefert.

## Offener technischer Punkt

Das AD/OAuth-Attribut fuer das Mapping auf `ZXTS_WIW_T-EXTNR` ist noch festzulegen und muss in `GET /odata/MyProfile` umgesetzt werden.
