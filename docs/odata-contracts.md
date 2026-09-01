# xTS OData Contract Baseline

Diese Datei beschreibt die fachlichen Service-Kontrakte fuer SAP-OData und die Mock-API. Die Mock-API liegt in `mock-api/` und bildet die wichtigsten Antwortformen fuer die Frontend-Entwicklung ab.

## Services

| Service    | Pfad                          | Zweck                                        |
| ---------- | ----------------------------- | -------------------------------------------- |
| Stammdaten | `/odata/Employees`            | Mitarbeiter lesen                            |
| Stammdaten | `/odata/Teams`                | Teams lesen                                  |
| Stammdaten | `/odata/CostObjects`          | Kontierungen lesen                           |
| Timesheet  | `/odata/MyProfile`            | Angemeldeten Benutzer auf `EXTNR` abbilden   |
| Timesheet  | `/odata/MyEnabledCostObjects` | Freigeschaltete Kontierungen mit Reststunden |
| Timesheet  | `/odata/MyTimesheets`         | Eigene Stundeneintraege                      |
| Timesheet  | `/odata/TimesheetDays`        | Tageskopf mit Leistungspositionen speichern  |

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
