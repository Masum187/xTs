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
