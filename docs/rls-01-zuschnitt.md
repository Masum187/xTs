# RLS-01: Zuschnitt Release-Steuerung und serverseitige Schreibsperren

Stand: 2026-09-28. **Zuschnitt zur Pruefung, keine Umsetzungsfreigabe.** Grundlage ist `main` nach PR #54 (`f2c6fa66c3c56a08da37dbf8b3cb33dcaa0ddb85`), gelesen wurden `mock-api/src/routes.js`, `mock-api/src/server.js`, `mock-api/test/` und `frontend/e2e/`. Dieses Dokument aendert keinen Code, legt keine Jira-Stories an und nimmt die Umsetzung der Middleware nicht vorweg. RLS-01 ist weiterhin ein lokaler Paketvorschlag aus dem [Release-Zuschnitt](release-zuschnitt.md).

**Voraussetzung fuer die Umsetzung:** Die Entscheidung zu Klasse C (Abschnitt 5) muss getroffen sein, bevor die Positivliste im Modus `erfassung` umgesetzt wird. Bis dahin bleibt RLS-01 ein Dokumentationsvorschlag.

## 1. Ziel und Geltungsbereich

Im Modus `erfassung` (aktueller Release nach Entscheidung 23) duerfen Zugriffe **aus xTS** nur die freigegebenen Schreiboperationen ausfuehren. Alle uebrigen schreibenden Aufrufe werden serverseitig abgelehnt, unabhaengig von Rolle, Client oder Aufrufweg.

- **Die Sperre gilt fuer Zugriffe aus xTS, nicht pauschal in SAP.** SAP fuehrt Planung, Planfreigabe, Genehmigung/Rueckweisung, BANF, Bestellung und WE im aktuellen Release weiterhin selbst aus; diese Funktionen in SAP werden durch RLS-01 nicht eingeschraenkt.
- **Produktiv gehoert die Release-Pruefung in die Middleware** zwischen xTS-Frontend und SAP (im Projekt vorgeschlagen; Architektur, Technik und Betrieb der Middleware sind noch nicht festgelegt, siehe Abschnitt 8). Die SAP-Berechtigungen des Integrationszugangs, mit dem die Middleware SAP aufruft, muessen zum Modus passen, damit die Sperre nicht allein an einer Stelle haengt.
- **Die Mock-Sperre ist die Referenz** fuer dieses Verhalten: Sie legt Sperrliste, Pruefreihenfolge, Fehlerantwort und Tests fest, an denen die Middleware spaeter abgenommen werden kann. Sie ist kein produktiver Schutz.
- Die Implementierung der gesperrten Funktionen bleibt erhalten (Erhaltungspflicht). RLS-01 loescht und veraendert keine Fachlogik in den Handlern.

Nicht Teil von RLS-01: Deaktivieren von UI-Ausloesern (RLS-02/RLS-03), SAP-Statusrueckmeldung (RLS-04), Gesamtabnahme (RLS-05), Middleware-Implementierung.

## 2. Bestand der schreibenden Endpunkte im Mock

Alle Routen werden in `routeRequest` (`mock-api/src/routes.js`) verteilt; die V2-Antwortform entsteht erst beim Senden (`server.js`, `toODataV2`). Eine Sperre in `routeRequest` gilt damit fuer beide Antwortformen. Der Dispatcher normalisiert den Pfad (Query wird ignoriert, abschliessender Slash entfernt); Methoden ausser GET/POST/OPTIONS sind im Mock nicht geroutet und liefern 404.

| Klasse                 | Endpunkt                                                                                                                                                    | Wirkung                                                                                                        | Rolle heute     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------- |
| A - erlaubt            | `POST /odata/TimesheetDays`                                                                                                                                 | Tag speichern (E) oder einreichen (F); keine Folgebuchung                                                      | eigene `extNr`  |
| A' - fachlich lesend   | `POST /odata/CostObjectChecks`                                                                                                                              | Pruefung einer Kontierung, schreibt nichts; POST nur als Aufrufform                                            | admin           |
| B - sperren            | `POST /odata/PlanningEntries`                                                                                                                               | Planzeile speichern                                                                                            | planner         |
| B                      | `POST /odata/PlanningReleases`                                                                                                                              | Planfreigabe V nach F                                                                                          | planner         |
| B                      | `POST /odata/Orders`                                                                                                                                        | zwei Varianten auf demselben Pfad: Beauftragung anlegen (ohne `orderId`) und BANF-Text aendern (mit `orderId`) | planner         |
| B                      | `POST /odata/OrderBanfs`                                                                                                                                    | BANF anlegen, Planung auf P                                                                                    | planner         |
| B                      | `POST /odata/PurchaseOrderSyncRuns`                                                                                                                         | Bestelldaten-Job: Beleg auf "bestellt", Planung auf B                                                          | planner         |
| B                      | `POST /odata/TimesheetApprovals`                                                                                                                            | Genehmigung (bucht im selben Aufruf den simulierten WE) oder Rueckweisung                                      | approver, admin |
| C - Entscheidung offen | `POST /odata/Rules`                                                                                                                                         | Regelpflege inkl. Infotyp 3 (Monatsabschluss, Entscheidung 18)                                                 | admin           |
| C                      | `POST` auf `/odata/Employees`, `/odata/Teams`, `/odata/TeamAssignments`, `/odata/CostObjects`, `/odata/CostObjectAssignments`, `/odata/CostObjectApprovers` | Stammdatenpflege                                                                                               | admin           |
| C                      | `POST /odata/TestDataResets`                                                                                                                                | setzt alle Stamm- und Bewegungsdaten zurueck                                                                   | admin           |

Befunde:

- Es gibt keine GET-Route mit Seiteneffekt. Der einzige belegveraendernde "Refresh" ist der Bestelldaten-Job (POST, Klasse B).
- Der WE wird ausschliesslich ueber `TimesheetApprovals` ausgeloest. Das Einreichen (F) ueber `TimesheetDays` hat keine Folgebuchung.
- `TimesheetDays` liest Beauftragungen und Regeln fuer Kontingent und Datumsfenster. Diese Anwendung bleibt unveraendert; gesperrt wird nur die Pflege.

## 3. Release-Modus

| Punkt            | Zuschnitt                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modi             | `erfassung` (aktueller Release) und `voll` (isolierte Entwicklung und Regression des erhaltenen Vollumfangs).                                                                                                       |
| Standard         | `erfassung`. `voll` nur durch ausdrueckliche Serverkonfiguration beim Start, zum Beispiel eine Umgebungsvariable; Name im Code-PR festzulegen.                                                                      |
| Ungueltige Werte | Fehlende, leere oder unbekannte Konfiguration ergibt niemals Vollzugriff: entweder `erfassung` oder Startabbruch mit klarer Meldung (Variante im Code-PR festlegen, Test fuer beide Faelle).                        |
| Kein Umschalten  | Nicht per Request (Header, Query, Body), nicht per Persona oder Rolle, nicht per Browser- oder Frontend-Konfiguration. Der Modus ist fuer die Laufzeit des Servers fest.                                            |
| Sichtbarkeit     | `/health` meldet den Modus neben `odata` und `today`, damit Tests einen wiederverwendeten Server gegen den erwarteten Modus pruefen koennen. Eine Frontend-Anbindung wird gemeinsam mit RLS-02/RLS-03 spezifiziert. |
| Grundsatz        | Eine Anzeige im Profil oder in der UI ersetzt niemals die serverseitige Sperre.                                                                                                                                     |

## 4. Sperrlogik

1. **Positivliste statt Negativliste:** Im Modus `erfassung` sind nur ausdruecklich freigegebene schreibende Operationen erlaubt. Jeder andere schreibende Aufruf wird abgelehnt, auch neu hinzukommende Endpunkte. So entsteht durch einen vergessenen Eintrag kein Vollzugriff. Fest stehen bisher Klasse A und A'. Ob Endpunkte der Klasse C in die Positivliste aufgenommen werden, haengt von der offenen Entscheidung in Abschnitt 5 ab; erst danach ist die Positivliste vollstaendig bestimmt und umsetzbar.
2. **Zentrale Pruefung:** eine Stelle vor der Verteilung auf die Handler, auf dem bereits normalisierten Pfad (ohne Query, ohne abschliessenden Slash) und der Methode. Die Handler bleiben unveraendert.
3. **Reihenfolge:** Identitaet aufloesen (bestehende Fehler 401 `INVALID_TOKEN`, 404 `NO_EXTNR_MAPPING`, 403 `EMPLOYEE_INACTIVE` bleiben unveraendert), dann Release-Sperre, dann Rollenpruefung, erst danach Body lesen und Fachlogik ausfuehren. Damit erhalten Admin, Planer und Genehmiger dieselbe Ablehnung; eine Rolle kann die Sperre nicht umgehen.
4. **Fehlerantwort:** HTTP 403 mit Code `OPERATION_NOT_IN_RELEASE` und verstaendlicher Meldung (Text in `messages.js`), klar unterschieden von `NOT_AUTHORIZED`. In der V2-Antwortform ueber die bestehende Fehlerabbildung.
5. **Keine fachlichen Seiteneffekte:** keine Aenderung an Stunden-, Plan-, Beauftragungs-, BANF-, Bestell-, WE- oder Stammdaten, keine Zaehler (BANF-, Bestell-, WE-Nummern), keine fachlichen Audit-Eintraege. Ein gezielter Sicherheitseintrag ist zulaessig, wenn er nur Zeitpunkt, Akteur (`extNr`), Methode, Pfad und Code enthaelt, ohne Request-Body oder sensible Inhalte. Ob er geschrieben wird, im Code-PR festlegen.

## 5. Klasse C: Entscheidung offen, Voraussetzung fuer die Umsetzung

**Offen, nicht durch RLS-01 entschieden.** RLS-01 gibt Klasse C weder stillschweigend frei noch sperrt es sie stillschweigend. Die Entscheidung ist Voraussetzung fuer die Umsetzung der Positivliste im Modus `erfassung` (Abschnitt 4). Eine dokumentierte offene Frage ersetzt keine festgelegte und getestete Behandlung dieser Endpunkte; ein Code-PR beginnt erst, wenn fuer jeden Endpunkt der Klasse C feststeht, ob er im Modus `erfassung` erlaubt oder gesperrt ist.

Vorschlag zur Entscheidung:

- Im Modus `erfassung` Regelpflege, Stammdatenpflege und Testdaten-Reset zunaechst sperren; im isolierten Modus `voll` vollstaendig erhalten.
- Gesperrt wird nur die **Pflege** der Regeln. Die vorhandene Monatsabschlussregel (Entscheidung 18) wird bei `TimesheetDays` weiter angewendet.
- `CostObjectChecks` wird getrennt als fachlich lesende Pruefung behandelt (Klasse A'), obwohl der Aufruf POST verwendet.

Folgen, die mit der Entscheidung zu klaeren sind:

- Wer pflegt im ausgelieferten Release Stammdaten, Genehmigerzuordnungen und Regeln, und auf welchem Weg (SAP, separater Admin-Zugang, spaeterer Release)?
- Die E2E-Tests setzen die Daten heute vor jedem Test ueber `TestDataResets` zurueck (`frontend/e2e/fixtures.ts`, `global-setup.ts`). Ist der Reset im Modus `erfassung` gesperrt, braucht die Erfassungs-Teststrecke einen anderen Weg zum definierten Ausgangsstand (zum Beispiel eigener Serverstart je Lauf). Welcher Weg, ist im Code-PR festzulegen; ein Reset-Pfad nur fuer Tests darf nicht in einer ausgelieferten Konfiguration erreichbar sein.

## 6. Teststrecken

Zwei getrennte Teststrecken, jede in beiden Antwortformen (Mock und V2). Die bestehenden Vollumfang-Tests allein reichen nicht.

| Teststrecke             | Inhalt                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erfassung: Negativtests | Jede Operation der Klasse B sowie jede nach der Entscheidung gesperrte Operation der Klasse C wird mit 403 `OPERATION_NOT_IN_RELEASE` abgelehnt, jeweils als Admin und als passende Fachrolle.                                    |
| Erfassung: Positivtests | `TimesheetDays` mit E und F, `CostObjectChecks` sowie jede nach der Entscheidung erlaubte Operation der Klasse C funktionieren unveraendert; lesende Endpunkte unveraendert; `/health` meldet `erfassung`.                        |
| Voll: Regression        | Der erhaltene Vollumfang laeuft ausdruecklich im Modus `voll` (heutige Contract- und Smoke-Tests); `/health` meldet `voll`. Eigene Regressionstests, die belegen, dass die gesperrten Funktionen im Modus `voll` weiter arbeiten. |
| Konfiguration           | Fehlende, leere und unbekannte Moduswerte fuehren nicht zu Vollzugriff; kein Umschalten per Header, Query, Body oder Persona.                                                                                                     |

Pflichtfaelle der Negativtests:

- `/odata/Orders` in beiden Varianten: Anlage ohne `orderId` und Textaenderung mit `orderId`.
- `TimesheetApprovals` mit `approve` und mit `reject`; kein WE-Beleg, keine Statusaenderung.
- Ungueltige Identitaeten (ungueltiges Token, fehlendes Mapping, inaktiver Mitarbeiter): bestehende Fehlercodes vor der Release-Sperre.
- Pfade mit Queryparametern und mit abschliessendem Slash.
- Nach jeder Ablehnung unveraenderte Fach- und Belegdaten: Tagesstatus, `weDocument`, Planungsstatus, Beauftragungen, BANF-/Bestelldaten, Nummernzaehler, fachliches Audit-Log.

Hinweise aus dem Bestand:

- Die Contract-Tests rufen `routeRequest` direkt auf und setzen `XTS_TODAY` je Test (`mock-api/test/routes.test.js`). Der Modus muss dort je Test oder je Datei eindeutig gesetzt werden.
- Mehrere E2E-Specs nutzen gesperrte Endpunkte zur Testvorbereitung (zum Beispiel `TimesheetApprovals`, `PlanningReleases`, `OrderBanfs` in `reporting.spec.ts`, `orders.spec.ts`, `timesheet-layout.spec.ts`, `admin.spec.ts`). Sie gehoeren in die Teststrecke `voll` oder brauchen im Modus `erfassung` einen anderen Weg zum Ausgangsstand.
- Laufende lokale Server (4200/4010) und deren Testdaten bleiben unangetastet. Die Teststrecken starten eigene Server beziehungsweise pruefen wiederverwendete Server ueber `/health` auf Modus, Antwortform und Datum.

## 7. Abnahmekriterien RLS-01 (Vorschlag)

- Alle Operationen der Klasse B werden im Modus `erfassung` bei direktem Aufruf, alten Clients und fuer Admin mit 403 `OPERATION_NOT_IN_RELEASE` abgelehnt, in beiden Antwortformen.
- Nach jeder Ablehnung sind Fach- und Belegdaten nachweislich unveraendert.
- `TimesheetDays` (E/F) und `CostObjectChecks` funktionieren im Modus `erfassung` unveraendert.
- Standard ist `erfassung`; ungueltige Konfiguration erzeugt keinen Vollzugriff; kein Umschalten per Request, Persona oder Browser.
- Modus `voll` besteht die eigene Regression; die Handler-Implementierung ist unveraendert erhalten.
- Klasse C ist vor Beginn der Umsetzung entschieden. Jeder Endpunkt der Klasse C hat eine festgelegte und in beiden Modi getestete Behandlung. Ein Code-PR mit offener Klasse C erfuellt die Abnahme nicht.
- Kontrakt: `OPERATION_NOT_IN_RELEASE`, Modus in `/health` und die Sperrliste sind in `odata-contracts.md` beschrieben.

## 8. Bezug zu Middleware und SAP

- Produktiv setzt die Middleware dieselbe Sperrliste durch; der Mock ist die Referenz, gegen die sie abgenommen wird. Architektur, Technik und Betrieb der Middleware sind nicht Teil dieses Zuschnitts. Das Entwicklungskonzept sah eine Middleware erst nach der MVP-Validierung vor; Entscheidung 17 (ECC, OData V2) bleibt davon unberuehrt.
- Fuer die Middleware zusaetzlich zu beachten, weil OData V2 mehr Aufrufformen kennt als der Mock: Methoden `PUT`, `MERGE`, `PATCH`, `DELETE`, Methoden-Tunneling (`X-HTTP-Method`) und `$batch`. Laut Kontrakt wird `$batch` nicht benoetigt; die Sperre muss die fachliche Operation erfassen, nicht nur `POST` auf einen Pfad. Die Positivliste gilt entsprechend.
- Die SAP-Berechtigungen des technischen Integrationszugangs sollen im Modus `erfassung` keine Schreiboperationen der Klasse B und keine nach der Entscheidung gesperrten Operationen der Klasse C zulassen. Wie das in SAP abgebildet wird, klaeren SAP-Basis und -Entwicklung; `sap/odata/contracts.md` beschreibt dazu noch nichts.
- Die Ausfuehrung dieser Funktionen in SAP selbst durch berechtigte SAP-Anwender bleibt unberuehrt.

## 9. Offene Punkte

| Punkt                                 | Stand                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Klasse C                              | offen, Vorschlag in Abschnitt 5; Voraussetzung fuer die Umsetzung der Positivliste |
| Ungueltige Konfiguration              | Rueckfall auf `erfassung` oder Startabbruch; im Code-PR festlegen                  |
| Sicherheitseintrag bei Ablehnung      | zulaessig ohne Body/sensible Inhalte; ob geschrieben wird, im Code-PR festlegen    |
| Frontend-Anbindung des Modus          | mit RLS-02/RLS-03                                                                  |
| Middleware und SAP-Integrationszugang | Architektur und Berechtigungskonzept noch nicht festgelegt                         |
| Umsetzung, Jira-Stories               | nicht beauftragt                                                                   |

O4, O13 und K30 bleiben offen; ADR-0012 bleibt Proposed. Entscheidungen 14, 17, 18 und 19 werden durch diesen Zuschnitt nicht geaendert.
