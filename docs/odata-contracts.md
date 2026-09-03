# xTS OData Contract Baseline

Diese Datei beschreibt die fachlichen Service-Kontrakte fuer SAP-OData und die Mock-API. Die Mock-API liegt in `mock-api/` und bildet die wichtigsten Antwortformen fuer die Frontend-Entwicklung ab.

## Services

| Service      | Pfad                           | Zweck                                               |
| ------------ | ------------------------------ | --------------------------------------------------- |
| Stammdaten   | `/odata/Employees`             | Mitarbeiter lesen/pflegen (XTS-010)                 |
| Stammdaten   | `/odata/Teams`                 | Teams lesen/pflegen (XTS-011)                       |
| Stammdaten   | `/odata/TeamAssignments`       | Zeitliche Teamzuordnung lesen/pflegen (XTS-012)     |
| Stammdaten   | `/odata/CostObjects`           | Kontierungen lesen/pflegen (XTS-013)                |
| Stammdaten   | `/odata/CostObjectChecks`      | Kontierung gegen SAP CO pruefen (Stub, XTS-013)     |
| Stammdaten   | `/odata/CostObjectAssignments` | Mitarbeiter-Kontierungs-Zuordnung (Planungsbasis)   |
| Betrieb      | `/odata/TestDataResets`        | Testdatenpaket UAT zuruecksetzen (XTS-082)          |
| Betrieb      | `/odata/AuditLog`              | Aenderungs- und Fehlerprotokoll lesen (XTS-081)     |
| Timesheet    | `/odata/MyProfile`             | Angemeldeten Benutzer auf `EXTNR` abbilden          |
| Timesheet    | `/odata/MyEnabledCostObjects`  | Freigeschaltete Kontierungen mit Reststunden        |
| Timesheet    | `/odata/MyTimesheets`          | Eigene Stundeneintraege                             |
| Timesheet    | `/odata/TimesheetDays`         | Tageskopf mit Leistungspositionen speichern         |
| Genehmigung  | `/odata/ApprovalTimesheets`    | Freigegebene Tage (Status `F`) fuer Projektleiter   |
| Genehmigung  | `/odata/TimesheetApprovals`    | Tag genehmigen oder zurueckweisen                   |
| Reporting    | `/odata/ResourceLifecycle`     | Ressourcen-Live-Circle Plan bis Rechnung (XTS-070)  |
| Reporting    | `/odata/BudgetMonitor`         | Budget-Monitor je Kontierung (XTS-071)              |
| Reporting    | `/odata/CostObjectQuota`       | Stundenkontingent-Monitor je Mitarbeiter (XTS-072)  |
| Planung      | `/odata/PlanningOverview`      | 12-Monatsuebersicht der Planstunden (XTS-020)       |
| Planung      | `/odata/PlanningEntries`       | Planstunden speichern (XTS-021)                     |
| Planung      | `/odata/PlanningReleases`      | Planzeile fuer BANF freigeben (XTS-023)             |
| Beauftragung | `/odata/OrderCandidates`       | Beauftragungskandidaten aus F-Planzeilen (XTS-030)  |
| Beauftragung | `/odata/Orders`                | Beauftragungen lesen/anlegen/Text pflegen (XTS-031) |
| Beauftragung | `/odata/OrderBanfs`            | BANF simuliert anlegen und rueckschreiben (XTS-032) |
| Beauftragung | `/odata/PurchaseOrderSyncRuns` | Bestelldaten-Job simuliert ausfuehren (XTS-033)     |
| Beauftragung | `/odata/OrderProtocol`         | Fehlerprotokoll zu BANF und Bestelldaten-Job        |

## Stammdaten-Verhalten (Epic 2)

- Lesen ist fuer alle angemeldeten Personas moeglich; alle Schreibzugriffe (`POST`) erfordern die Rolle `admin` (sonst HTTP 403 `NOT_AUTHORIZED`). Jeder `POST` ist ein Upsert; `deleted: true` loescht logisch. `changedBy` (EXTNR des Aenderers) und `changedAt` (ISO-Zeitstempel) werden bei jedem Schreiben gesetzt.
- `POST /odata/Employees` (analog `ZXTS_WIW_T`, XTS-010): Pflichtfelder `extNr`, `lastName`, `firstName`, `active` (Status); fehlende Felder: HTTP 400 `INVALID_EMPLOYEE` mit `fields` (`EXTNR`, `NACHNAME`, `VORNAME`, `STATUS`). Optional `company`, `sapAccount`, `resourceManager` (muss bekannter Mitarbeiter sein, sonst HTTP 400 `UNKNOWN_RESOURCE_MANAGER`). `GET /odata/Employees` liefert nur nicht geloeschte Mitarbeiter; `?includeDeleted=true` alle. Geloeschte oder inaktive Mitarbeiter erhalten in `MyProfile` HTTP 403 `EMPLOYEE_INACTIVE` und erscheinen nicht in der Planung.
- `POST /odata/Teams` (analog `ZXTS_TEAM_T`, XTS-011): Pflichtfelder `id`, `name`, `active` (HTTP 400 `INVALID_TEAM`). `GET /odata/Teams` liefert nur aktive, nicht geloeschte Teams (Selektionen in Planung und Reporting); `?includeInactive=true` alle.
- `POST /odata/TeamAssignments` (analog `ZXTS_MATEAM_T`, XTS-012): `extNr`, `teamId`, `validFrom`, `validTo` sind Pflicht (HTTP 400 `INVALID_TEAM_ASSIGNMENT` mit `fields`); Team muss aktiv sein (HTTP 409 `TEAM_NOT_AVAILABLE`); ueberlappende Zuordnungen desselben Mitarbeiters werden abgelehnt (HTTP 409 `TEAM_ASSIGNMENT_OVERLAP` mit `conflictId`). Planung (`?team=`) und Kontingent-Monitor (`?team=`) ermitteln das Team zeitraumbezogen: eine Zeile passt, wenn eine Zuordnung den betrachteten Zeitraum (12-Monatsfenster bzw. Freischaltungsgueltigkeit) ueberschneidet; `teamId` ist die erste passende Zuordnung, `teamIds` alle.
- `POST /odata/CostObjects` (analog `ZXTS_KONT_T`, XTS-013): Pflichtfelder `coIdent`, `description`, `active` (HTTP 400 `INVALID_COST_OBJECT`); `type` muss `KS`, `OR`, `PR`, `FB` oder `KL` sein (HTTP 400 `INVALID_COST_OBJECT_TYPE` mit `allowed`). `GET /odata/CostObjects` liefert nur nicht geloeschte Kontierungen; `?includeDeleted=true` alle. Geloeschte Kontierungen fallen aus Planungszeilen und Freischaltungen heraus; Buchungen darauf werden mit HTTP 409 `COST_OBJECT_NOT_ENABLED` abgelehnt.
- `POST /odata/CostObjectChecks` mit `{ coIdent, type }` prueft gegen den SAP-CO-Stub (`sapCostObjectStub`, Phase 1): Antwort `{ valid, source: "SAP-CO-Stub", message }`; unbekannte Kontierung oder abweichende Objektart ergeben `valid: false`.
- `POST /odata/CostObjectAssignments` (Mitarbeiter-Kontierung als Planungsbasis): `extNr`, `coIdent`, `validFrom`, `validTo` sind Pflicht (HTTP 400 `INVALID_ASSIGNMENT`); Mitarbeiter muss existieren (HTTP 404 `UNKNOWN_EMPLOYEE`), Kontierung darf nicht geloescht sein (HTTP 409 `COST_OBJECT_NOT_AVAILABLE`); Ueberschneidungen je Mitarbeiter und Kontierung: HTTP 409 `ASSIGNMENT_OVERLAP`. Die Beschreibung wird aus Kontierung und Mitarbeiter abgeleitet. Neue Zuordnungen erscheinen sofort als Planungszeilen.

## Aenderungs- und Fehlerprotokoll (XTS-081)

- `GET /odata/AuditLog` (Rolle `admin`, analog `ZXTS_LOG_T`) liefert Protokolleintraege, neueste zuerst: `id`, `at`, `actor` (EXTNR), `category` (`status` Statuswechsel, `job` Job-Fehler, `masterdata`, `rule`, `system`), `severity` (`info`/`error`), `object`, `objectKey`, `from`/`to`, `message`, `details`. Filter: `?category=`, `?severity=`, `?object=`, `?actor=`, `?q=` (Teilstring in Objekt oder Meldung), `?from=`/`?to=` (Datum), `?limit=` (Default 200).
- Protokollierte Statuswechsel: Stundenzettel (Speichern/Freigeben mit Vorher-Status, Genehmigung inkl. `weDocument`, Rueckweisung inkl. Grund), Planung (`V -> F`), Beauftragung (angelegt, `created -> banf`, `banf -> bestellt`), Regelwerk (alt/neu), Stammdaten (gespeichert/geloescht), Testdaten-Reset (`system`).
- Jobs schreiben technische Fehler als `category: "job"`, `severity: "error"` mit `details.source` (`banf`, `po-sync`) und den fachlichen Schluesseln (BANF-Nummer, Kontierung, Fehlercode); das bestehende `OrderProtocol` bleibt als Sicht der Beauftragung erhalten.
- Alle Fehlerantworten (HTTP >= 400 mit `error`-Code) tragen zusaetzlich `message`: eine fachlich verstaendliche deutsche Meldung (zentral in `mock-api/src/messages.js`), ggf. mit Pflichtfeldern, Konflikt-ID oder Kontierung in Klammern. Das Frontend zeigt diese Meldung ueber den gemeinsamen `ApiError` direkt an; der Code bleibt der stabile Kontrakt.

## Testdatenpaket (XTS-082)

- `POST /odata/TestDataResets` (Rolle `admin`) setzt Stamm- und Bewegungsdaten der Mock-API auf den in [testdaten-uat-v0.1.md](testdaten-uat-v0.1.md) dokumentierten Ausgangsstand zurueck und liefert `package`, `resetBy`, `resetAt` und `counts` (Mitarbeiter, Teams, Kontierungen, Zuordnungen, Planzeilen, Beauftragungen, Stundenzettel-Tage).

## Genehmigungs-Verhalten

- `GET /odata/ApprovalTimesheets` liefert alle Tage mit Status `F` ueber alle Mitarbeiter, inkl. `displayName`; optionale Filter `?month=YYYY-MM` und `?extNr=`.
- `POST /odata/TimesheetApprovals` mit `{ extNr, date, action }` verarbeitet genau einen Tag; nur Status `F` ist zulaessig (sonst HTTP 409).
  - `action: "approve"` setzt Status `G`, protokolliert `approvedBy`/`approvedAt` und simuliert die synchrone Wareneingangsbuchung (XTS-061A) ueber ein `weDocument` (`WE-000001`, fortlaufend). Genehmigte Tage koennen im MVP nicht zurueckgesetzt werden.
  - `action: "reject"` erfordert `reason` (sonst HTTP 400), setzt Status `A` und schreibt den Grund nach `rejectionReason`.

## Planungs-Verhalten (Epic 3)

- Alle Planungs-Endpunkte erfordern die Rolle `planner`.
- `GET /odata/PlanningOverview?start=YYYY-MM` liefert 12 fortlaufende Monate ab Startmonat mit verfuegbaren Stunden aus dem simulierten SAP-Werkkalender (`workCalendar`); Zeilen sind aktive Mitarbeiter mit Kontierungsfreischaltung. Filter: `?extNr=`, `?team=`, `?coIdent=`. Ungueltiger Startmonat: HTTP 400.
- `POST /odata/PlanningEntries` speichert Planstunden je Mitarbeiter, Kontierung und Monat. Neue Werte erhalten Status `V`; nur `V` ist aenderbar, `F`/`P`/`B` liefern HTTP 409 `PLANNING_ENTRY_LOCKED`. Unbekannte Kombination: HTTP 404.
- Ueberplanung (XTS-022): Planstunden ueber den verfuegbaren Monatsstunden werden markiert (`overbooked`), Speichern bleibt erlaubt (Warnung). Die Fachentscheidung "Warnung vs. blockieren" ist offen; der Mock setzt Warnung als Default um.
- `POST /odata/PlanningReleases` setzt eine `V`-Zeile mit Stunden > 0 auf `F` (fuer BANF freigegeben, gesperrt); andere Status: HTTP 409. Freigegebene Zeilen sind die Kandidaten fuer die Beauftragung (Epic 4).
- Statusmodell analog `ZXTS_MAPLAN_T`: `V` Vorschlag, `F` freigegeben fuer BANF, `P` BANF erstellt, `B` Bestellung vorhanden.

## Beauftragungs-Verhalten (Epic 4)

- Alle Beauftragungs-Endpunkte erfordern die Rolle `planner` (Order Manager/RM in Personalunion; eigene Rolle kann spaeter getrennt werden).
- `GET /odata/OrderCandidates` liefert bei aktivem Infotyp `1` F-Planzeilen ohne Beauftragungsreferenz, zusammengefasst je Mitarbeiter und Kontierung (Simulation ZXTS_REGELN_T Infotyp 1, niemals ueber mehrere Mitarbeiter). Ist Infotyp `1` inaktiv, werden keine automatischen Beauftragungsvorschlaege geliefert. Filter: `?extNr=`, `?coIdent=`, `?from=`/`?to=` (Monate).
- `POST /odata/Orders` legt eine Beauftragung analog `ZXTS_MABEAUF_T` an: Kontierung, Zeitraum und Stunden kommen aus den referenzierten Planmonaten (`planningRefs` bleiben nachvollziehbar); mit `orderId` im Body wird stattdessen der BANF-Positionstext gepflegt (nur solange Status `created`, sonst HTTP 409).
- `POST /odata/OrderBanfs` simuliert die MM-BANF-Anlage: BANF-Nummer/-Position werden rueckgeschrieben, Status wechselt auf `banf`, referenzierte Planzeilen auf `P`. Doppelte Anlage: HTTP 409 + Eintrag im Fehlerprotokoll. Echtes EBAN/EBKN/COBL-Feldmapping und DDIC-Validierung bleiben SAP-seitig offen.
- `POST /odata/PurchaseOrderSyncRuns` simuliert den Bestelldaten-Job (XTS-033): zu jeder BANF wird die Bestellung aus der Fixture `purchaseOrders` gelesen, `EBELN`/`EBELP` rueckgeschrieben, Status `bestellt`, Planung `B`. Nicht gefundene Faelle landen im Fehlerprotokoll; Bestellungen werden nie aktiv angelegt.
- `GET /odata/OrderProtocol` liefert das Fehlerprotokoll (BANF-Ablehnungen und Job-Fehler) fachlich lesbar.

## Freischaltung Stundenschreibung (Epic 5)

- `GET /odata/Rules` / `POST /odata/Rules` (Rolle `admin`): Regelwerk analog `ZXTS_REGELN_T`. Infotyp `1` steuert die Aggregation der Beauftragungskandidaten (`MA_KONT`), Infotyp `2` die Freischaltung (`P` = ab BANF vorhanden, MVP-Default; `B` = erst ab Bestellung). Ungueltige Regelwerte: HTTP 400.
- Die Kontierungsfreischaltung (`ZXTS_MAZUKONT_T`, XTS-041) wird aus den Beauftragungen abgeleitet, nicht mehr statisch gepflegt: qualifizierende Beauftragungen (Status gemaess Regel Infotyp 2) werden je Mitarbeiter und Kontierung aggregiert; Gueltigkeit = beauftragter Zeitraum, `orderedHours` = beauftragte Stunden.
- `GET /odata/MyEnabledCostObjects` liefert diese abgeleiteten Freischaltungen fuer den angemeldeten Benutzer: `orderedHours`, `bookedHours`, `remainingHours` (= offen).
- `POST /odata/TimesheetDays` prueft serverseitig gegen die aktuelle Freischaltung: Mitarbeiter/Kontierung muss fuer das Tagesdatum qualifizieren und noch offene Stunden haben, sonst HTTP 409 `COST_OBJECT_NOT_ENABLED`.
- Fortschreibung (XTS-042): `bookedHours` zaehlen ab Speichern/Freigeben (Status `E`/`F`/`G`); zurueckgewiesene Tage (`A`) geben ihr Kontingent wieder frei. Die Werte werden bei jedem Zugriff aus dem Buchungsbestand berechnet — eine Nightly Reconciliation ist im Mock dadurch gegenstandslos und bleibt der SAP-Implementierung vorbehalten. Negative Reststunden sperren die Kontierung fuer weitere Buchungen.
- Bewusste Semantik-Trennung: Die Freischaltung reserviert Kontingent ab Erfassung (`E`/`F`/`G`), das Reporting zaehlt als Verbrauch nur Genehmigtes (`G`).

## Reporting-Verhalten

- Alle Reporting-Endpunkte erfordern die Rolle `approver`.
- `GET /odata/ResourceLifecycle` (XTS-070, analog `ZXRLM`) liefert je Mitarbeiter und Kontierung die Kette Planung -> Beauftragung -> BANF -> Bestellung -> Ist-Stunden -> Wareneingang -> Rechnung: `plannedHours` (alle Planstatus), `orderedHours` und `orders` (alle Beauftragungen inkl. Status, BANF-Nummer/-Position, `EBELN`/`EBELP`), `purchaseOrderHours` (Bestellmenge = Stunden bestellter Beauftragungen), `recordedHours` (Status `E`/`F`/`G`), `approvedHours` (`G`), `goodsReceiptHours` und `goodsReceipts` (genehmigte Tage mit `weDocument`), `pendingGoodsReceiptHours` (genehmigt ohne WE-Beleg = WE ausstehend). Filter: `?from=`/`?to=` (Monate `YYYY-MM`; Planung und Buchungen im Zeitraum, Beauftragungen mit Ueberschneidung; ungueltige oder umgekehrte Zeitraeume: HTTP 400), `?ebeln=`/`?ebelp=` (Zeilen mit passender Bestellung/Position).
- Nicht vorhandene Daten werden leer geliefert, nie berechnet: `purchaseOrderPrice`, `invoicedHours` und `invoiceNumber` sind im Mock immer `null` (Bestellpreis und Rechnung sind nicht Teil des MVP).
- Budgetquelle ist seit Epic 5 die Beauftragung: Budget je Kontierung = beauftragte Stunden qualifizierender Beauftragungen (Regel Infotyp 2, MVP: ab Status BANF/`P`). Verbrauch zaehlt nur genehmigte Tage (Status `G`).
- `GET /odata/BudgetMonitor` liefert je Kontierung: Budget-, Verbrauchs-, Rest-Stunden, Verbrauch in % und Ampel (`green`/`yellow`/`red`, Grenzen aus simuliertem Customizing `budgetTrafficLight`, spaeter `ZXTS_REGELN_T`). Detailstufen via `?detail=employee` (Summe je Mitarbeiter) bzw. `?detail=day` (alle Tagesdetails).
- `GET /odata/CostObjectQuota` liefert die abgeleiteten Freischaltungen je Mitarbeiter und Kontierung: Gueltigkeitszeitraum, beauftragte (`orderedHours`), gebuchte (`bookedHours`, Status `E`/`F`/`G`) und offene Stunden. Filter: `?lastName=` (Teilstring), `?team=`, `?from=`/`?to=` (Buchungsdatum); `?detail=day` blendet Tagesdetails inkl. Status ein.

## Authentifizierung (XTS-050, Option B entschieden)

- Echte Anmeldung: `Authorization: Bearer <JWT>` (ID- oder Access-Token aus Entra ID). Die Mock-API liest `oid` (fuehrend) und `preferred_username`/`upn`/`email` (Fallback) aus dem Token-Payload, **ohne Signaturpruefung** (Mock); nicht lesbare Tokens oder Tokens ohne verwertbare Text-Claims: HTTP 401 `INVALID_TOKEN`. Bearer hat Vorrang vor den Pseudo-Headern. Details: [entra-anbindung.md](entra-anbindung.md).
- Simulation ohne Token: die Claims werden als Pseudo-Header uebergeben: `x-mock-oauth-oid` (Entra objectId) und `x-mock-oauth-upn`; ohne Header gilt die Default-Persona `stephan.schilz@qualitytimes.de` per UPN. Das Mapping liegt im Mitarbeiterstamm (`aadOid`, `aadUpn` in `ZXTS_WIW_T`-Simulation): `oid` fuehrend, `upn` als Fallback; beide Vergleiche sind case-insensitiv.
- `GET /odata/MyProfile` liefert Profil inkl. `roles` (`user`, `approver`, `planner`, `admin`), `aadUpn` und `mappedBy` (`"oid"` oder `"upn"`). Ohne EXTNR-Mapping: HTTP 404 `NO_EXTNR_MAPPING` (inkl. `oid` und `upn`); inaktiver oder geloeschter Mitarbeiter: HTTP 403 `EMPLOYEE_INACTIVE`.
- Pflege des Mappings ueber `POST /odata/Employees` (`aadOid` GUID-Format, sonst HTTP 400 `INVALID_AAD_OID`; Eindeutigkeit: HTTP 409 `AAD_OID_IN_USE` bzw. `AAD_UPN_IN_USE` mit `conflictId`). Fehlen die Felder im Body, bleiben bestehende Werte erhalten.
- Alle `My*`-Endpunkte und `POST /odata/TimesheetDays` sind auf den gemappten Mitarbeiter beschraenkt (fremde `extNr`: HTTP 403 `NOT_AUTHORIZED`).
- Genehmigungs-Endpunkte erfordern die Rolle `approver` (sonst HTTP 403 `NOT_AUTHORIZED`); `approvedBy` ist der genehmigende Benutzer.
- Zieldefinition des Mappings: [entscheidungsvorlage-extnr-mapping.md](entscheidungsvorlage-extnr-mapping.md).

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

Das AD/OAuth-Attribut ist entschieden (Option B, `oid` mit UPN-Fallback) und in `GET /odata/MyProfile` umgesetzt. SAP-seitig offen: DDIC-Felder `AAD_OID`/`AAD_UPN` und die Token-Validierung im OData-Service, siehe [entra-anbindung.md](entra-anbindung.md).
