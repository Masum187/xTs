# xTS OData Contract Baseline

Diese Datei beschreibt die fachlichen Service-Kontrakte fuer SAP-OData und die Mock-API. Die Mock-API liegt in `mock-api/` und bildet die wichtigsten Antwortformen fuer die Frontend-Entwicklung ab.

## Services

| Service     | Pfad                          | Zweck                                              |
| ----------- | ----------------------------- | -------------------------------------------------- |
| Stammdaten  | `/odata/Employees`            | Mitarbeiter lesen                                  |
| Stammdaten  | `/odata/Teams`                | Teams lesen                                        |
| Stammdaten  | `/odata/CostObjects`          | Kontierungen lesen                                 |
| Timesheet   | `/odata/MyProfile`            | Angemeldeten Benutzer auf `EXTNR` abbilden         |
| Timesheet   | `/odata/MyEnabledCostObjects` | Freigeschaltete Kontierungen mit Reststunden       |
| Timesheet   | `/odata/MyTimesheets`         | Eigene Stundeneintraege                            |
| Timesheet   | `/odata/TimesheetDays`        | Tageskopf mit Leistungspositionen speichern        |
| Genehmigung | `/odata/ApprovalTimesheets`   | Freigegebene Tage (Status `F`) fuer Projektleiter  |
| Genehmigung | `/odata/TimesheetApprovals`   | Tag genehmigen oder zurueckweisen                  |
| Reporting   | `/odata/BudgetMonitor`        | Budget-Monitor je Kontierung (XTS-071)             |
| Reporting   | `/odata/CostObjectQuota`      | Stundenkontingent-Monitor je Mitarbeiter (XTS-072) |

## Genehmigungs-Verhalten

- `GET /odata/ApprovalTimesheets` liefert alle Tage mit Status `F` ueber alle Mitarbeiter, inkl. `displayName`; optionale Filter `?month=YYYY-MM` und `?extNr=`.
- `POST /odata/TimesheetApprovals` mit `{ extNr, date, action }` verarbeitet genau einen Tag; nur Status `F` ist zulaessig (sonst HTTP 409).
  - `action: "approve"` setzt Status `G`, protokolliert `approvedBy`/`approvedAt` und simuliert die synchrone Wareneingangsbuchung (XTS-061A) ueber ein `weDocument` (`WE-000001`, fortlaufend). Genehmigte Tage koennen im MVP nicht zurueckgesetzt werden.
  - `action: "reject"` erfordert `reason` (sonst HTTP 400), setzt Status `A` und schreibt den Grund nach `rejectionReason`.

## Reporting-Verhalten

- Beide Reporting-Endpunkte erfordern die Rolle `approver`.
- Verbrauchte/gebuchte Stunden zaehlen nur genehmigte Tage (Status `G`). Die verbindliche Budgetbetrachtung ab Status `P`/BANF (XTS-071) folgt mit Planung und Beauftragung (Epics 3/4); bis dahin ist die Kontierungsfreischaltung (`budgetHours`) die Budgetquelle.
- `GET /odata/BudgetMonitor` liefert je Kontierung: Budget-, Verbrauchs-, Rest-Stunden, Verbrauch in % und Ampel (`green`/`yellow`/`red`, Grenzen aus simuliertem Customizing `budgetTrafficLight`, spaeter `ZXTS_REGELN_T`). Detailstufen via `?detail=employee` (Summe je Mitarbeiter) bzw. `?detail=day` (alle Tagesdetails).
- `GET /odata/CostObjectQuota` liefert je Mitarbeiter und Kontierung: Gueltigkeitszeitraum, Budget-, gebuchte und Rest-Stunden. Filter: `?lastName=` (Teilstring), `?team=`, `?from=`/`?to=` (Buchungsdatum); `?detail=day` blendet Tagesdetails ein.

## Auth-Simulation (bis XTS-050 entschieden ist)

- Der OAuth-Benutzer wird als Pseudo-Claim im Header `x-mock-oauth-upn` uebergeben (Default: `stephan.schilz@qualitytimes.de`); Personas und Mapping stehen in den Fixtures (`oauthMappings`).
- `GET /odata/MyProfile` liefert Profil inkl. `roles` (`user`, `approver`). Ohne EXTNR-Mapping: HTTP 404 `NO_EXTNR_MAPPING` (inkl. `upn`); inaktiver Mitarbeiter: HTTP 403 `EMPLOYEE_INACTIVE`.
- Alle `My*`-Endpunkte und `POST /odata/TimesheetDays` sind auf den gemappten Mitarbeiter beschraenkt (fremde `extNr`: HTTP 403 `NOT_AUTHORIZED`).
- Genehmigungs-Endpunkte erfordern die Rolle `approver` (sonst HTTP 403 `NOT_AUTHORIZED`); `approvedBy` ist der genehmigende Benutzer.
- Zieldefinition des Mappings: [entscheidungsvorlage-extnr-mapping.md](entscheidungsvorlage-extnr-mapping.md).

## Timesheet-Verhalten

- `GET /odata/MyEnabledCostObjects` berechnet `remainingHours` einheitlich als `budgetHours` minus genehmigte Stunden (Status `G`) — dieselbe Quelle wie Budget- und Kontingent-Monitor; statische Reststunden gibt es nicht mehr.
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
