# xTS MVP Backlog v0.1

Stand: 2026-05-08 (Baseline; Umsetzungsstand siehe unten)

## Umsetzungsstand (2026-09-09)

- Im WebClient und in der Mock-API umgesetzt: Epics 2 bis 8, XTS-081, XTS-082 sowie Epics 10 bis 13. XTS-050 ist mit Option B umgesetzt (MSAL im WebClient, Token-Mapping in der Mock-API).
- SAP-seitig offen: Epic 1 (XTS-001/002 Foundation), XTS-080 (Berechtigungen im OData-Service, Vorgabe in `odata-contracts.md`), Epic 14, echte BANF-/WE-Integration (XTS-032/033/061A sind simuliert).
- UI-Redesign (Handoff "Modernist" vom 2026-09-11): Bewertung in `ui-redesign-bewertung.md`; Epics 15 und 16 sowie XTS-024/073/074/083/084 sind angelegt (Jira XTS-87 bis XTS-103); freigegeben ist nur XTS-140 (Entscheidung 20), alles Weitere nach Abnahme der Baseline.
- Stabilisierung (Audit-Schritte 1 bis 10) ist umgesetzt; Restbefunde und Reihenfolge: `audit-2026-09-03.md`, Abschnitt "Restbefunde nach der Stabilisierung". Neue Stories aus den Entscheidungen 18 und 19: XTS-056 (umgesetzt im Mock und WebClient, PR #28), XTS-014 und XTS-063 (umgesetzt, PR #29); XTS-064 bleibt Ausbaustufe. Offene Entscheidungen O4 bis O7: `entscheidungen-v0.1.md`.

## Priorisierung

| Prioritaet | Bedeutung                          |
| ---------- | ---------------------------------- |
| P0         | Muss fuer MVP-Start enthalten sein |
| P1         | Wichtig fuer produktionsnahen MVP  |
| P2         | Nach MVP oder optional             |

## Epic 1 - Projekt- und Systemgrundlagen

### XTS-001 - Namenskonventionen und Datenmodell finalisieren

Prioritaet: P0  
Rolle: Entwicklerteam / Fachverantwortliche

Beschreibung:  
Als Entwicklerteam brauchen wir ein konsolidiertes Datenmodell mit eindeutigen Tabellennamen, Feldnamen und Statuswerten, damit Entwicklung, Tests und Dokumentation auf derselben Basis arbeiten.

Akzeptanzkriterien:

- `ZXTS_MAPLAN_T` ist als finaler Name fuer die Planungstabelle bestaetigt.
- Alle Statuswerte fuer Planung und Stundenschreibung sind dokumentiert.
- Pflichtfelder und technische Schluessel sind markiert.
- Namenskonflikte aus Excel/PPT sind aufgeloest.

### XTS-002 - Technische Entwicklungsumgebung einrichten

Prioritaet: P0  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- SAP-Paket/Transportstruktur fuer xTS ist angelegt.
- Entwicklungsmandant und Testmandant sind definiert.
- Namensraum und Objektkonventionen sind festgelegt.
- Basis-Testdaten koennen transportiert oder reproduzierbar erzeugt werden.

## Epic 2 - Stammdaten

### XTS-010 - Mitarbeiterstamm pflegen

Prioritaet: P0  
Rolle: xTS Administrator

Beschreibung:  
Als Administrator moechte ich externe Mitarbeiter mit Status, Firma, Ressourcenmanager und optionalem SAP-Account pflegen.

Akzeptanzkriterien:

- Tabelle `ZXTS_WIW_T` existiert.
- Datensaetze koennen angelegt, geaendert und logisch geloescht werden.
- Pflichtfelder `EXTNR`, `NACHNAME`, `VORNAME`, `STATUS` werden validiert.
- Aenderer, Aenderungsdatum und Aenderungszeit werden gesetzt.

### XTS-011 - Teams pflegen

Prioritaet: P0  
Rolle: xTS Administrator

Akzeptanzkriterien:

- Tabelle `ZXTS_TEAM_T` existiert.
- Teams koennen mit Status und Beschreibung gepflegt werden.
- Inaktive oder geloeschte Teams werden in Planungsselektionen nicht angeboten.

### XTS-012 - Mitarbeiter zeitlich Teams zuordnen

Prioritaet: P0  
Rolle: Ressourcenmanager

Akzeptanzkriterien:

- Tabelle `ZXTS_MATEAM_T` existiert.
- Gueltig-von und Gueltig-bis sind Pflicht.
- Ueberlappende Teamzuordnungen werden verhindert oder fachlich markiert.
- Planungslogik kann Teamzuordnung fuer einen Zeitraum ermitteln.

### XTS-013 - Kontierungen pflegen und pruefen

Prioritaet: P0  
Rolle: xTS Administrator / Projektleiter

Akzeptanzkriterien:

- Tabelle `ZXTS_KONT_T` existiert.
- Kontierungsarten `KS`, `OR`, `PR`, `FB`, `KL` sind zugelassen.
- Gueltigkeit gegen SAP CO kann geprueft werden oder ist als Stub fuer Phase 1 verfuegbar.
- Geloeschte Kontierungen werden nicht zur Planung oder Stundenschreibung angeboten.

### XTS-014 - Genehmigerzuordnung je Kontierung pflegen

Prioritaet: P0

Rolle: xTS Administrator

Grundlage: Entscheidung 19 (Zustaendigkeit je Kontierung, Audit Nr. 33).

Akzeptanzkriterien:

- Neue Tabelle analog `ZXTS_KONTGEN_T`: `COIDENT`, `EXTNR` des Genehmigers, `VERTRETER`-Kennzeichen, `GUELTIG_VON`, `GUELTIG_BIS`, Aenderungsstempel.
- `GET`/`POST /odata/CostObjectApprovers` (Rolle `admin` fuer Schreiben; Lesen `admin`, `approver` nur eigene Zuordnungen): Upsert, logisches Loeschen, Pflichtfelder `coIdent`, `extNr`, `validFrom`, `validTo` (HTTP 400 `INVALID_COST_OBJECT_APPROVER`), Genehmiger muss aktiver Mitarbeiter mit Rolle `approver` sein (HTTP 409 `APPROVER_NOT_AVAILABLE`), Kontierung darf nicht geloescht sein.
- Pflege in der Verwaltung mit Liste je Kontierung, Vertreter sichtbar markiert.
- Aenderungen stehen im Audit-Log (`masterdata`).
- Testdatenpaket: Roeper ist Genehmiger fuer alle Kontierungen des Pakets, damit UAT-Fall A und B unveraendert laufen; zusaetzlich ein zweiter Genehmiger mit nur einer Kontierung fuer den Sichtbarkeits-Test.

## Epic 3 - Ressourcenplanung

### XTS-020 - Planungsuebersicht mit 12 Monaten anzeigen

Prioritaet: P0  
Rolle: Ressourcenmanager

Beschreibung:  
Als Ressourcenmanager moechte ich ab einem Startmonat eine 12-Monatsuebersicht sehen, um Planstunden pro Mitarbeiter und Kontierung einzutragen.

Akzeptanzkriterien:

- Startmonat wird im Format `MM.YYYY` eingegeben.
- System zeigt 12 fortlaufende Monate.
- Filter fuer Mitarbeiter, Team und Kontierung sind vorhanden.
- Angezeigte Mitarbeiter und Kontierungen sind gueltig und nicht geloescht.

### XTS-021 - Planstunden speichern

Prioritaet: P0  
Rolle: Ressourcenmanager

Akzeptanzkriterien:

- Planstunden koennen je Mitarbeiter, Kontierung und Monat gespeichert werden.
- Neue Planwerte erhalten Status `V`.
- Bestehende Planwerte mit Status `V` koennen geaendert werden.
- Planwerte mit Status `P` oder `B` sind fuer den beauftragten Zeitraum gesperrt.

### XTS-022 - Ueberplanung markieren

Prioritaet: P1  
Rolle: Ressourcenmanager

Akzeptanzkriterien:

- System ermittelt verfuegbare Arbeitsstunden aus SAP-Werkkalender.
- Planstunden oberhalb der verfuegbaren Stunden werden markiert.
- Speichern ist entweder erlaubt mit Warnung oder blockiert, je nach Fachentscheidung.

### XTS-023 - Planstunden fuer BANF freigeben

Prioritaet: P0  
Rolle: Ressourcenmanager

Akzeptanzkriterien:

- Markierte Planzeilen mit Status `V` koennen auf `F` gesetzt werden.
- Status `F` sperrt die Planstunden fuer normale Bearbeitung.
- Freigegebene Zeilen erscheinen als Kandidaten fuer Beauftragung.

### XTS-024 - Werkkalender transparent anzeigen (optional)

Prioritaet: P2

Rolle: Ressourcenmanager

Jira: XTS-103 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Lesender Endpunkt fuer den Werkkalender (Monat, Arbeitstage, verfuegbare Stunden), Quelle wie `availableHoursFor`.
- Lesende Ansicht direkt in der Planung fuer `planner` (Monatskopf mit Arbeitstagen und verfuegbaren Stunden, aufklappbar), damit kein Zugriff auf die Einstellungen noetig ist; zusaetzlich als Unterseite der Einstellungen fuer `admin`. Keine Pflege im MVP, Werte kommen aus SAP bzw. Fixture.
- Rollenpruefung des Endpunkts: `planner`, `admin` und `controller` (lesend).

## Epic 4 - Beauftragung

### XTS-030 - Beauftragungskandidaten anzeigen

Prioritaet: P0  
Rolle: Order Manager / Ressourcenmanager

Akzeptanzkriterien:

- Alle Planzeilen mit Status `F` werden angezeigt.
- Kandidaten koennen nach Mitarbeiter, Kontierung und Zeitraum gefiltert werden.
- System zeigt vorgeschlagene Zusammenfassung gemaess `ZXTS_REGELN_T`.
- Zusammenfassung erfolgt niemals ueber mehrere Mitarbeiter hinweg.

### XTS-031 - Beauftragungsdatensatz anlegen

Prioritaet: P0  
Rolle: Order Manager

Akzeptanzkriterien:

- Tabelle `ZXTS_MABEAUF_T` wird befuellt.
- Bezeichnung/BANF-Positionstext ist pflegbar.
- Kontierung, Zeitraum und Stundenmenge werden aus Planung uebernommen.
- Beauftragung ist pro Mitarbeiter und Kontierung eindeutig nachvollziehbar.
- Urspruengliche Planungsreferenzen bleiben nachvollziehbar.

### XTS-032 - MM-BANF aktiv anlegen und rueckschreiben

Prioritaet: P0  
Rolle: Order Manager

Akzeptanzkriterien:

- xTS legt aus dem Beauftragungsdatensatz eine MM-BANF an.
- BANF-Nummer und BANF-Position werden rueckgeschrieben.
- Beauftragungsstatus wechselt auf BANF vorhanden.
- Zugehoerige Planung erhaelt Status `P`.
- Fehler bei BANF-Anlage werden protokolliert und fachlich verstaendlich angezeigt.
- BANF-Feldmapping ist gemaess Konzept Abschnitt 11.2 implementiert.
- Kontierungsableitung fuer `OR`, `KS` und `PR` wird korrekt in `COBL`/`EBKN` gesetzt.
- Feldnamen und Pflichtfelder werden gegen SAP-DDIC validiert.

### XTS-033 - Bestelldaten per Job aktualisieren

Prioritaet: P1  
Rolle: System

Akzeptanzkriterien:

- Job liest Bestellung und Position zur BANF.
- `EBELN` und `EBELP` werden in `ZXTS_MABEAUF_T` aktualisiert.
- Zugehoerige Planung erhaelt Status `B`.
- Job schreibt Fehlerprotokoll fuer nicht gefundene oder uneindeutige Faelle.
- xTS erzeugt oder aendert im MVP keine MM-Bestellungen aktiv.

## Epic 5 - Freischaltung Stundenschreibung

### XTS-040 - Regelwerk pflegen

Prioritaet: P0  
Rolle: xTS Administrator

Akzeptanzkriterien:

- Tabelle `ZXTS_REGELN_T` existiert.
- Infotyp `1` und `2` koennen aktiv/inaktiv gesetzt werden.
- Es gibt Validierung gegen erlaubte Regelwerte.
- Infotyp `1` steuert Aggregation innerhalb Mitarbeiter/Kontierung.
- Infotyp `2` steuert Freischaltung ab BANF mit Regelwert `P` oder Bestellung mit Regelwert `B`.

### XTS-041 - Mitarbeiter-Kontierungsfreischaltung erzeugen

Prioritaet: P0  
Rolle: System

Akzeptanzkriterien:

- Bei erfuellter Regel werden Datensaetze in `ZXTS_MAZUKONT_T` erzeugt.
- Beauftragte Stunden werden uebernommen.
- Offene Stunden = beauftragte Stunden minus gebuchte Stunden.
- Freischaltung gilt nur im beauftragten Zeitraum.
- MVP-Default erlaubt Freischaltung ab vorhandener BANF mit Regelwert `P`.

### XTS-042 - Reststunden fortschreiben

Prioritaet: P0  
Rolle: System

Akzeptanzkriterien:

- Nach Speichern/Freigeben von Stunden werden `TS_STUNDEN` und `OFFENE_STUNDEN` aktualisiert.
- Negative Reststunden werden verhindert oder fachlich markiert.
- Nightly Reconciliation kann Abweichungen neu berechnen.

## Epic 6 - WebClient Stundenschreibung

### XTS-050 - Login und Mitarbeiterprofil ermitteln

Prioritaet: P0  
Rolle: xTS User

Akzeptanzkriterien:

- Angemeldeter User wird auf `EXTNR` gemappt.
- Nicht gemappte User erhalten eine klare Fehlermeldung.
- Nur aktive Mitarbeiter koennen Stunden erfassen.
- Authentifizierung erfolgt ueber AD/OAuth; SAP-Zugriff ist fuer WebClient-Nutzer nicht Voraussetzung.
- Das konkrete AD/OAuth-Attribut fuer das Mapping auf `ZXTS_WIW_T-EXTNR` ist dokumentiert und getestet.

### XTS-051 - Freigeschaltete Kontierungen anzeigen

Prioritaet: P0  
Rolle: xTS User

Akzeptanzkriterien:

- WebClient zeigt nur gueltige Kontierungen aus `ZXTS_MAZUKONT_T`.
- Reststunden werden je Kontierung angezeigt.
- Abgelaufene oder gesperrte Kontierungen sind nicht buchbar.

### XTS-052 - Tageskopf erfassen

Prioritaet: P0  
Rolle: xTS User

Akzeptanzkriterien:

- Datum, Kommt, Geht, Pause und Leistungsort sind erfassbar.
- Arbeitszeit wird berechnet.
- Plausible Zeitformate werden validiert.
- Datensatz wird in `ZXTS_TIME_T` gespeichert.

### XTS-053 - Leistungspositionen erfassen

Prioritaet: P0  
Rolle: xTS User

Akzeptanzkriterien:

- Mehrere Positionen pro Tag sind moeglich.
- Jede Position enthaelt Kontierung, Beschreibung und Stunden.
- Positionen werden in `ZXTS_PTIME_T` gespeichert.
- Summe der Positionen wird gegen Tagesarbeitszeit angezeigt.

### XTS-054 - Entwurf freigeben

Prioritaet: P0  
Rolle: xTS User

Akzeptanzkriterien:

- Status `E` kann auf `F` gesetzt werden.
- Danach ist der Tag fuer Mitarbeiter nicht mehr aenderbar.
- Tag erscheint in der Genehmigungsselektion.

### XTS-055 - Zurueckgewiesene Stunden korrigieren

Prioritaet: P1  
Rolle: xTS User

Akzeptanzkriterien:

- Status `A` wird im WebClient mit Rueckweisungsgrund angezeigt.
- Mitarbeiter kann Tag und Positionen korrigieren.
- Nach erneuter Freigabe wechselt Status wieder auf `F`.

### XTS-056 - Datumsregeln fuer die Stundenerfassung

Prioritaet: P0

Rolle: xTS User / xTS Administrator

Grundlage: Entscheidung 18 (Audit Nr. 17).

Akzeptanzkriterien:

- Regelwerk Infotyp `3` "Monatsabschluss" mit Regelwert Kalendertag (Standard `5`), nur `admin`, ungueltige Werte HTTP 400; Aenderung im Audit-Log.
- Erlaubter Zeitraum fuer Speichern und Freigeben: vom 1. des Vormonats bis heute, wobei der Vormonat nur bis einschliesslich Tag `Monatsabschluss` des laufenden Monats erfassbar ist; ab dem Folgetag nur noch der laufende Monat. Zukunftstage sind gesperrt, auch als Entwurf.
- Verstoss: HTTP 400 `DATE_OUT_OF_RANGE` mit Meldung, die den erlaubten Zeitraum nennt; Payload-Validierung liefert `problems[{ field: "date", code: "DATE_OUT_OF_RANGE" }]`.
- Genehmigen und Zurueckweisen sind von der Regel nicht betroffen.
- WebClient: dieselbe Regel in `validateTimesheetDay` vor dem Senden; Vortag/Folgetag und Datumsfeld bleiben navigierbar, Tage ausserhalb sind schreibgeschuetzt mit Hinweis; Wochenende zeigt einen Hinweis, blockiert nicht.
- Contract-Tests fuer Grenzen (Tag 5 des Folgemonats, Tag 6, heute, morgen) und E2E fuer die Sperre im Screen. "Heute" ist der lokale Kalendertag des Servers bzw. Clients; Abweichungen an Monatsgrenzen sind zu vereinbaren.

## Epic 7 - Genehmigung

### XTS-060 - Freigegebene Stunden anzeigen

Prioritaet: P0  
Rolle: Projektleiter

Akzeptanzkriterien:

- Projektleiter sieht Stunden mit Status `F`.
- Selektion nach Leistungsmonat und Mitarbeiterbereich ist moeglich.
- Anzeige enthaelt Mitarbeiter, Datum, Kontierung, Beschreibung, Stunden und Leistungsort.

### XTS-061 - Ganzen Arbeitstag genehmigen

Prioritaet: P0  
Rolle: Projektleiter

Akzeptanzkriterien:

- Ein vollstaendiger Tag kann markiert werden.
- Alle Positionen des Tages wechseln auf `G`.
- Genehmiger und Genehmigungszeitpunkt werden protokolliert.
- Genehmigte Stunden sind fuer Mitarbeiter nicht mehr aenderbar.
- Genehmigte Stunden koennen im MVP nicht zurueckgesetzt werden.
- Synchrone Wareneingangsbuchung zur zugehoerigen Bestellposition wird ueber einen ausloesenden Button angestossen.

### XTS-061A - Wareneingang nach Genehmigung buchen

Prioritaet: P0  
Rolle: System

Akzeptanzkriterien:

- Nach Genehmigung eines Tages mit Status `G` wird synchron ein Wareneingang zur zugehoerigen Bestellposition gebucht.
- Das System kann die relevante Bestellposition eindeutig aus Beauftragung/Kontierungsfreischaltung ermitteln.
- Erfolgreiche WE-Buchung wird am genehmigten Tag oder in einer technischen Referenztabelle protokolliert.
- Fehlende oder uneindeutige Bestellposition blockiert oder markiert die WE-Buchung mit nachvollziehbarer Fehlermeldung.
- Fehlgeschlagene WE-Buchungen koennen erneut verarbeitet werden.
- Es ist geklaert, ob der ausloesende Button der Genehmigen-Button selbst oder ein separater WE-Button nach Genehmigung ist.

### XTS-062 - Ganzen Arbeitstag zurueckweisen

Prioritaet: P0  
Rolle: Projektleiter

Akzeptanzkriterien:

- Rueckweisung erfordert einen Grund.
- Alle Positionen des Tages wechseln auf `A`.
- Mitarbeiter sieht den Rueckweisungsgrund im WebClient.
- Tag wird wieder korrigierbar.

### XTS-063 - Genehmigung und Reporting nach Zustaendigkeit schneiden

Prioritaet: P0

Rolle: Projektleiter / Controlling

Grundlage: Entscheidung 19 (Audit Nr. 33), Stammdaten aus XTS-014.

Akzeptanzkriterien:

- `GET /odata/ApprovalTimesheets` liefert einem `approver` nur Tage mit Status `F`, die mindestens eine Position auf einer Kontierung enthalten, fuer die er zum Tagesdatum Genehmiger oder Vertreter ist; `admin` sieht alle Tage. Ohne Zuordnung: leere Liste, der WebClient zeigt einen Hinweis.
- `POST /odata/TimesheetApprovals` prueft dieselbe Zustaendigkeit (sonst HTTP 403 `NOT_RESPONSIBLE`); das Vier-Augen-Prinzip (`SELF_APPROVAL`) bleibt vorrangig.
- Die Genehmigungskarte zeigt alle Positionen des Tages, auch die auf fremden Kontierungen, mit Kennzeichnung "nicht in Ihrer Zustaendigkeit"; die Tagesfreigabe wirkt gesamthaft und ist so beschriftet.
- Reporting-Endpunkte (Budget-Monitor, Kontingent-Monitor, Ressourcen-Live-Circle) erlauben `approver`, `controller` oder `admin`: `approver` sieht nur zustaendige Kontierungen, `controller` und `admin` sehen ungeschnitten alles. `controller` ist eine neue Rolle im Mitarbeiterstamm.
- Contract-Tests fuer Sichtbarkeit, Vertretung, fremde Kontierung und Reporting-Schnitt; E2E fuer den zweiten Genehmiger aus dem Testdatenpaket.

### XTS-064 - Positionsweise Genehmigung (Ausbaustufe)

Prioritaet: P2

Rolle: Projektleiter

Grundlage: Entscheidung 19, bewusst nicht im MVP.

Akzeptanzkriterien (Skizze):

- Status je Leistungsposition statt je Tag; ein Tag gilt als genehmigt, wenn alle Positionen genehmigt sind.
- Wareneingang je Position und Bestellposition (abhaengig von O4).
- Migration des Tagesstatus und Anpassung von Kontingent, Reporting und Audit-Log.

## Epic 8 - Reporting

### XTS-070 - Ressourcen-Live-Circle Report

Prioritaet: P1  
Rolle: Controlling / Projektleiter

Akzeptanzkriterien:

- Report zeigt Planung, Ist-Stunden, Beauftragung, Bestellung, Wareneingang und Rechnung soweit vorhanden.
- Selektion nach Zeitraum, Einkaufsbelegnummer und Position ist moeglich.
- Fehlende Einkaufs-/Rechnungsdaten werden leer, nicht falsch berechnet, dargestellt.
- WE-Buchungen aus genehmigten Stunden werden sichtbar.

### XTS-071 - Budget-Monitor

Prioritaet: P0  
Rolle: Projektleiter / Controlling

Akzeptanzkriterien:

- Report zeigt Kontierung, Budgetstunden, verbrauchte Stunden, Verbrauch in %, Reststunden.
- Ampelwerte kommen aus Customizing.
- Detailstufen: keine MA-Details, Summe je Mitarbeiter, alle Tagesdetails.
- Fuehrend ist Stundenbudget; verbindliche Budgetbetrachtung beginnt ab Status `P` bzw. BANF erstellt.

### XTS-072 - Stundenkontingent-Monitor

Prioritaet: P0  
Rolle: Projektleiter / Ressourcenmanager

Akzeptanzkriterien:

- Report zeigt Mitarbeiter, Kontierung, Gueltigkeitszeitraum, Stunden und Rest.
- Tagesdetail kann optional eingeblendet werden.
- Selektion nach Nachname, Team und Buchungsdatum ist moeglich.

### XTS-073 - KPI-Uebersicht (Reporting-Kacheln)

Prioritaet: P1 nach Kennzahldefinition

Rolle: Projektleiter / Controlling

Jira: XTS-99 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Kennzahlen Plan, Beauftragt, Ist erfasst, Genehmigt, Wareneingang mit abgestimmter Definition (Zaehler, Nenner, Deduplizierung, Zeitraum); "Beauftragt" und "bestellt" getrennt.
- Aggregation serverseitig aus den Lifecycle-Daten oder als eigener Endpunkt; Rollenschnitt fuer `approver` wie im uebrigen Reporting (Entscheidung 19).
- Stufenleiste Planung bis Rechnung nur aus realen Daten; Rechnung bleibt leer, solange nicht Teil des MVP.
- Contract-Tests fuer die Kennzahlen gegen das Testdatenpaket; keine Demozahlen.

### XTS-074 - Pivot- und Diagrammansicht (optional)

Prioritaet: P2

Rolle: Projektleiter / Controlling

Jira: XTS-100 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Darstellung "Pivot je Kontierung" und "Balkendiagramm" als zusaetzliche Ansichten des Budget-Monitors, umschaltbar; Standard bleibt Tabelle.
- Werte in Stunden oder Prozent mit denselben Definitionen wie XTS-073.
- Barrierefreie Alternative (Tabelle) bleibt immer erreichbar.

## Epic 9 - Berechtigung, Audit und Betrieb

### XTS-080 - Berechtigungsrollen technisch umsetzen

Prioritaet: P0  
Rolle: SAP Security

Akzeptanzkriterien:

- Rollen `xTS User`, `Planer`, `Projektleiter`, `Admin`, `Controlling` sind technisch abbildbar.
- Unberechtigte Funktionen sind nicht aufrufbar.
- OData-Services pruefen Berechtigungen serverseitig.

### XTS-081 - Aenderungs- und Fehlerprotokoll einfuehren

Prioritaet: P1  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- Kritische Statuswechsel werden protokolliert.
- Jobs schreiben technische Fehler in ein auswertbares Log.
- Fachliche Fehlermeldungen sind fuer Anwender verstaendlich.

### XTS-082 - Testdatenpaket fuer UAT erstellen

Prioritaet: P0  
Rolle: Entwicklerteam / Fachbereich

Akzeptanzkriterien:

- Mindestens zwei Mitarbeiter sind angelegt: z. B. Schilz und Roeper.
- Mindestens zwei Kontierungen sind angelegt: SAP-Support und SAP-Implementierung.
- Ein durchgehender Fall von Planung bis Genehmigung ist testbar.
- Ein Rueckweisungsfall ist testbar.

### XTS-083 - Integrationsstatus und Verbindungstest (SAP ECC/V2, Entra)

Prioritaet: P2, SAP/IT-abhaengig

Rolle: xTS Administrator

Jira: XTS-101 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Endpunkt `SystemStatus` liefert je Integration (SAP ECC OData V2, Microsoft Entra ID, Mock-API/Testdaten) Status, Endpunkt und letzte Synchronisation aus realen Betriebsdaten; keine Beispielwerte im WebClient.
- "Verbindung testen" loest einen serverseitigen Test aus und schreibt das Ergebnis ins Audit-Log (`system`).
- Anzeige in den Einstellungen unter "Integrationen"; ohne Backend-Daten wird "nicht verfuegbar" gezeigt.

### XTS-084 - Jobstatus und Zeitplaene (ohne BANF-Automatisierung)

Prioritaet: P2, SAP-Betrieb-abhaengig

Rolle: xTS Administrator

Jira: XTS-102 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Endpunkt `Jobs` (lesend fuer `admin` und `planner`) liefert den Bestelldaten-Job (XTS-033) mit Zeitplan, letztem Lauf, Ergebnis und Fehlerzahl aus dem Audit-Log.
- "Jetzt ausfuehren" bleibt eine Planer-Aktion: der Button nutzt `PurchaseOrderSyncRuns`, dessen Rollenpruefung (`planner`, XTS-033) unveraendert bleibt; er ist nur sichtbar und aktiv, wenn die angemeldete Person die Rolle `planner` hat. Eine reine Admin-Persona sieht den Status ohne Startknopf. Soll `admin` das Recht zusaetzlich bekommen, ist das eine Kontraktaenderung an XTS-033, nicht Teil dieser Story.
- Keine automatische BANF-Anlage: die BANF bleibt eine bewusste Aktion des Planers (XTS-032), solange O9 offen ist.
- Anzeige in den Einstellungen unter "Integrationen".

## Epic 10 - Repository & Developer Experience

### XTS-090 - Monorepo-Struktur anlegen

Prioritaet: P0  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- Repository enthaelt `docs/`, `frontend/`, `mock-api/`, `sap/`, `.github/` und `.githooks/`.
- Root-README erklaert Setup, Struktur und Quality Gates.
- Bestehende Konzeptdokumente liegen im Ordner `docs/`.

### XTS-091 - Branching, PR- und Issue-Konventionen definieren

Prioritaet: P0  
Rolle: Entwicklerteam / Projektleitung

Akzeptanzkriterien:

- Branching-Konvention fuer Feature- und Fix-Branches ist dokumentiert.
- Pull-Request-Template ist vorhanden.
- Issue-Templates fuer User Stories und Bugs sind vorhanden.
- Direktes Arbeiten auf `main` ist organisatorisch untersagt und technisch in GitHub vorzubereiten.

### XTS-092 - Lokale Setup-Doku fuer Cursor, Claude Code und SAP erstellen

Prioritaet: P1  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- Setup-Doku erklaert Node/npm, Git Hooks, Mock-API und Frontend-Start.
- SAP-Hinweise fuer ADT/SAP GUI, abapGit und Transporte sind dokumentiert.
- Neue Entwickler koennen lokale Checks mit einem dokumentierten Befehl ausfuehren.

## Epic 11 - CI/CD & Quality Gates

### XTS-100 - Lokalen Pre-Commit-Hook einfuehren

Prioritaet: P0  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- `.githooks/pre-commit` fuehrt `npm run precommit` aus.
- Pre-Commit prueft Format, Lint, Typecheck und schnelle Tests.
- Aktivierung via `git config core.hooksPath .githooks` ist dokumentiert.

### XTS-101 - GitHub Actions PR-Gate einfuehren

Prioritaet: P0  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- GitHub Actions Workflow laeuft bei Pull Requests und Push auf `main`.
- Workflow installiert Node-Abhaengigkeiten.
- Workflow prueft Format, Docs-Links, Lint, Typecheck, Unit Tests und Frontend-Build.
- Playwright-Smoke-Test wird im PR-Gate ausgefuehrt.

### XTS-102 - Branch Protection fuer `main` konfigurieren

Prioritaet: P0  
Rolle: Repository Admin

Akzeptanzkriterien:

- Pull Request ist vor Merge nach `main` erforderlich.
- Required Check `Quality Gate` ist aktiviert.
- Force Pushes und direkte Pushes auf `main` sind blockiert.

## Epic 12 - OData Contracts & Mock API

### XTS-110 - OData-Kontrakte dokumentieren

Prioritaet: P0  
Rolle: SAP- und Frontend-Entwicklung

Akzeptanzkriterien:

- OData-Kontrakte fuer Stammdaten, Timesheet, Planung, Beauftragung, Genehmigung und Reporting sind dokumentiert.
- Response-Shape fuer Listen und Einzelobjekte ist festgelegt.
- Offene Mapping-Frage AD/OAuth zu `EXTNR` ist als technischer Klaerpunkt sichtbar.

### XTS-111 - Mock-API fuer Timesheet-Entwicklung bereitstellen

Prioritaet: P0  
Rolle: Frontend-Entwicklung

Akzeptanzkriterien:

- Mock-API stellt `MyProfile`, `MyEnabledCostObjects`, `MyTimesheets` und `TimesheetDays` bereit.
- Mockdaten enthalten Schilz/Roeper und die Kontierungen SAP-Support/SAP-Implementierung.
- Mock-API kann lokal ohne SAP gestartet werden.

### XTS-112 - Contract Tests fuer Mock-API einfuehren

Prioritaet: P0  
Rolle: Entwicklerteam

Akzeptanzkriterien:

- Automatisierte Tests pruefen Profil, freigeschaltete Kontierungen und Speichern eines Timesheet-Drafts.
- Tests laufen ohne externe Services.
- Tests sind Teil von `npm run ci`.

## Epic 13 - Frontend Foundation

### XTS-120 - Angular-Projektgrundlage anlegen

Prioritaet: P0  
Rolle: Frontend-Entwicklung

Akzeptanzkriterien:

- Angular + TypeScript Projekt liegt in `frontend/`.
- Build, Typecheck, Lint und Unit-Test-Skripte sind definiert.
- App-Shell zeigt xTS TimeSheet als Einstieg.

### XTS-121 - Timesheet-Grundscreen gegen Mock-API bauen

Prioritaet: P0  
Rolle: Frontend-Entwicklung

Akzeptanzkriterien:

- WebClient liest Profil und freigeschaltete Kontierungen aus Mock-API.
- Tageskopf und Leistungspositionen sind erfassbar.
- Entwurf speichern und Freigabe `E -> F` sind im UI abbildbar.

### XTS-122 - Frontend Unit Tests einfuehren

Prioritaet: P0  
Rolle: Frontend-Entwicklung

Akzeptanzkriterien:

- Unit Tests pruefen Timesheet-Stundenlogik.
- Tests laufen in `npm run test --workspace frontend`.
- Tests sind Teil von Pre-Commit und PR-Gate.

### XTS-123 - Playwright Smoke Test einfuehren

Prioritaet: P1  
Rolle: Frontend-Entwicklung

Akzeptanzkriterien:

- Smoke Test startet Mock-API und Frontend.
- Test prueft Laden des Timesheet-Screens.
- Test prueft Freigabe eines Entwurfs.

## Epic 14 - SAP Quality & Deployment

### XTS-130 - abapGit-Prozess definieren

Prioritaet: P0  
Rolle: SAP-Entwicklung

Akzeptanzkriterien:

- abapGit-Grundsatz ist dokumentiert.
- SAP-Transporte bleiben fuehrend fuer Deployment.
- PRs dokumentieren relevante Transportnummern.

### XTS-131 - Transportstrategie dokumentieren

Prioritaet: P0  
Rolle: SAP-Entwicklung / SAP-Basis

Akzeptanzkriterien:

- Transportweg DEV -> TEST ist dokumentiert.
- Transportlog ist im Repository vorhanden.
- Transportfreigabe verlangt erfolgreiche SAP-Quality-Gates.

### XTS-132 - ATC und ABAP Unit als Mindeststandard definieren

Prioritaet: P0  
Rolle: SAP-Entwicklung

Akzeptanzkriterien:

- ATC ohne kritische Findings ist Voraussetzung fuer Transportfreigabe.
- ABAP Unit wird fuer gekapselte Logik genutzt.
- Manuelle SAP-MM-Integrationsfaelle sind dokumentiert.

### XTS-133 - BANF-/WE-Testfaelle mit SAP-MM abstimmen

Prioritaet: P0  
Rolle: SAP-Entwicklung / Einkauf / SAP-MM

Akzeptanzkriterien:

- BANF-Anlage mit Feldmapping ist gegen SAP-DDIC validiert.
- Bestellung-Nachlesen per Job ist mit Testbelegen pruefbar.
- Synchrone WE-Buchung hat Positiv- und Fehlerfall.

## Epic 15 - Design-System und responsive App-Shell

Jira: XTS-87. Grundlage: `ui-redesign-bewertung.md` (Handoff "Modernist", 2026-09-11). Status: Vorschlag, nicht beauftragt (O8).

### XTS-140 - Design-Baseline und Funktionsabgleich festlegen

Prioritaet: P0

Rolle: Entwicklerteam / PO

Jira: XTS-89 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`. Status: freigegeben (Entscheidung 20, 2026-09-12); XTS-141, XTS-142 und XTS-150 sind die vorgeschlagene erste Etappe nach Abnahme der Baseline, nicht freigegeben.

Akzeptanzkriterien:

- Erhaltungsliste und Konflikte K1 bis K8 aus `ui-redesign-bewertung.md` sind je Screen in eine Checkliste ueberfuehrt; jede Story in Epic 16 nennt, welche Zustaende und Filter sie erhalten muss.
- Test-IDs der bestehenden E2E-Tests sind als stabile Schnittstelle festgelegt; Text- und Label-Selektoren werden je Screen migriert.
- Regeln fuer schmale Breiten (O10), Schriftbereitstellung (O11) und Kontrast (WCAG AA) sind festgelegt; die Regressionstests aus Audit-Schritt 14 (375/768/1024 px, Konsolenfehler, `aria-describedby`) bleiben Pflicht.
- Abstimmung mit Audit-Schritt 15: Komponentenzerlegung und Testisolation werden mit der Verwaltungsaufteilung (XTS-154) zusammen geplant, nicht vorab doppelt gemacht.

### XTS-141 - Design-Tokens und gemeinsame UI-Bausteine

Prioritaet: P1

Rolle: Entwicklerteam

Jira: XTS-90 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`. Abhaengig von XTS-140.

Akzeptanzkriterien:

- Tokens (Farben, Neutral- und Akzent-Ramp, Typografie, Abstaende, Radius 0, Fokusring) als CSS-Variablen in `frontend/src/styles.css`; Schriftbereitstellung Archivo gemaess O11 (Empfehlung: lokal gehostet, vorbehaltlich der Entscheidung).
- Gemeinsame Klassen fuer Buttons (primary, secondary, ghost), Tags, Felder/Inputs, Tabellen, Rasterzellen; keine komponenteneigenen Farbwerte mehr.
- Kontrastpruefung aller Tokenkombinationen gegen WCAG AA, insbesondere gedaempfte Texte und Tags; Fokus sichtbar per Tastatur.
- Bestehende Screens laufen mit den Tokens unveraendert (E2E gruen), bevor ein Screen umgebaut wird.

### XTS-142 - Responsive, rollenbasierte Navigation

Prioritaet: P1

Rolle: Alle Rollen

Jira: XTS-91 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`. Abhaengig von XTS-141.

Akzeptanzkriterien:

- Seitenleiste mit Marke, Navigation nach Rollen (Genehmigung fuer `approver`, Reporting fuer `approver`/`controller`/`admin`, Planung/Beauftragung fuer `planner`, Einstellungen fuer `admin`), Persona-Block und Zaehler offener Genehmigungen.
- Unter einer festgelegten Breite einklappbar (O10): Tastaturbedienung, Fokus-Rueckgabe, kein seitenweites Scrollen bei 375/768/1024 px.
- Auth-Zustaende (laden, abgemeldet, nicht konfiguriert, nicht gemappt, inaktiv, Fehler), Rollenhinweis des Guards und Nicht-gefunden-Seite sind im neuen Layout gestaltet.
- Route `admin` wird `einstellungen` mit Kindrouten und Redirect; bestehende Guards und der Datenverlust-Schutz bleiben.

## Epic 16 - WebClient-Ansichten modernisieren

Jira: XTS-88. Blockiert durch XTS-140 (Baseline). Jede Story: eigener kleiner PR, bestehende Unit-, Contract- und E2E-Tests bleiben gruen, XTS-156 wird je Screen angewendet.

### XTS-150 - Stundenschreibung im neuen Raster

Prioritaet: P1

Rolle: xTS User

Jira: XTS-92 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Tageskopf im Rasterlayout mit Vortag/Folgetag, Datumsfeld, Statustag und Summenzeile (Arbeitszeit, Positionen, Differenz mit Abweichungsbegruendung).
- Erhalten: Sperrhinweis ausserhalb des Zeitraums und Wochenend-Hinweis (Entscheidung 18), Hinweis auf ungespeicherte Aenderungen mit Rueckfrage, Lade-/Fehlerzustand mit erneutem Versuch, Problemliste mit `aria-describedby`/`aria-invalid`, Kontingentpruefung vor dem Senden, Kontingentliste mit Gueltigkeit und "nicht buchbar".
- E2E `timesheet.spec.ts`, `errors.spec.ts`, `responsive.spec.ts` gruen.

### XTS-151 - Genehmigung als Liste und Detailansicht

Prioritaet: P1

Rolle: Projektleiter

Jira: XTS-93 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Liste der freigegebenen Tage links, Detail rechts; Auswahl springt nach Genehmigen/Zurueckweisen weiter; Zaehler "N offen" live.
- Erhalten: Filter Leistungsmonat und Mitarbeiter (XTS-060), Vier-Augen-Prinzip, Pflichtgrund bei Rueckweisung, Markierung fremder Positionen und Hinweis zur gesamthaften Tagesfreigabe (Entscheidung 19), Hinweis ohne Zuordnung, Arbeitszeit/Abweichung/Begruendung je Tag, Fehlermeldungen des Servers (WE-Buchung).
- E2E `approval.spec.ts` und `uat.spec.ts` gruen.

### XTS-152 - Planungsmatrix mit Zelleneditor

Prioritaet: P1

Rolle: Ressourcenmanager

Jira: XTS-94 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Kachel-Matrix als Ausschnitt (z. B. 4 Monate) ueber den 12 Monaten aus XTS-020 mit Pager; Zellen-Editor rechts fuer Stunden und Freigabe.
- Erhalten: Filter Mitarbeiter/Team/Kontierung, Zustaende "nicht gueltig" und "keine Teamzuordnung", Sperre von F/P/B, Ueberplanungswarnung gegen den Werkkalender, Planstunden 0 bis 744 in ganzen Minuten mit Meldung vor dem Senden.
- Kein Zuruecksetzen auf V, solange O12 offen ist (K1).
- E2E `planning.spec.ts` gruen.

### XTS-153 - Beauftragungsboard mit vollstaendigem Statusmodell

Prioritaet: P1

Rolle: Ressourcenmanager / Order Manager

Jira: XTS-95 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Drei Spalten Vorschlag, Beauftragung angelegt/BANF, Bestellung vorhanden; Karten mit Belegkette.
- Erhalten: Zwischenzustand `created` mit editierbarem BANF-Positionstext, expliziter BANF-Aufruf (XTS-032), Fehlerprotokoll und Bestelldaten-Job (XTS-033), keine Automatik (O9).
- E2E `orders.spec.ts` und `uat.spec.ts` gruen.

### XTS-154 - Einstellungen in Unterseiten zerlegen

Prioritaet: P1

Rolle: xTS Administrator

Jira: XTS-96 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Baumnavigation mit Gruppen Organisation, Regelwerk, Integrationen, System; Kindrouten unter `einstellungen`.
- Alle bestehenden Pflegeseiten bleiben auffindbar: Mitarbeiter inkl. Entra-Mapping, Teams, Teamzuordnungen, Kontierungen, Mitarbeiter-Kontierungen, Genehmigerzuordnungen (XTS-014), Regelwerk inkl. Infotyp 3, Aenderungs- und Fehlerprotokoll, Testdaten mit Rueckfrage.
- Seiten ohne Backend (Rollen und Berechtigungen, Werkkalender, Connectoren, Jobs) erscheinen erst mit XTS-024, XTS-083, XTS-084 bzw. nach O6.
- Strukturarbeit aus Audit-Schritt 15 (grosse Dateien, Logik aus Komponenten) wird hier mit erledigt; E2E `admin.spec.ts` gruen.

### XTS-155 - Reporting gestalterisch angleichen

Prioritaet: P1

Rolle: Projektleiter / Controlling

Jira: XTS-97 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Drei Reports (Live-Circle, Budget-Monitor, Kontingent-Monitor) im neuen Tabellen- und Filterlayout; Darstellung "KPI + Tabelle" erst mit XTS-073.
- Erhalten: alle Filter (Zeitraum, Einkaufsbeleg, Bestellposition, Nachname, Team, Detailstufe), Ampelschwellen, Rollenschnitt fuer `approver` und volle Sicht fuer `controller`/`admin`.
- E2E `reporting.spec.ts` gruen.

### XTS-156 - Visuelle und funktionale Abnahme (fortlaufend je Screen)

Prioritaet: P1

Rolle: PO / UX

Jira: XTS-98 (Label `redesign`); Grundlage: `ui-redesign-bewertung.md`.

Akzeptanzkriterien:

- Je Screen: Abgleich mit dem Handoff, Kontrast- und Tastaturpruefung, Breitenpruefung 375/768/1024 px, Konsolenfehler-Regression.
- Abweichungen vom Handoff werden begruendet dokumentiert (Fachregel schlaegt Design).
- Abnahme ist Teil der Definition of Done jeder Story in Epic 16, nicht ein Schritt am Ende.

## Empfohlener erster Sprint

Ziel: Technische Grundlage und fachlich sichtbarer End-to-End-Dummy.

Stories:

1. XTS-090 - Monorepo-Struktur anlegen.
2. XTS-100 - Lokalen Pre-Commit-Hook einfuehren.
3. XTS-101 - GitHub Actions PR-Gate einfuehren.
4. XTS-110 - OData-Kontrakte dokumentieren.
5. XTS-111 - Mock-API fuer Timesheet-Entwicklung bereitstellen.
6. XTS-120 - Angular-Projektgrundlage anlegen.
7. XTS-001 - Namenskonventionen und Datenmodell finalisieren.
8. XTS-002 - Technische Entwicklungsumgebung einrichten.
9. XTS-082 - Testdatenpaket fuer UAT erstellen.

Ergebnis nach Sprint 1:

- Monorepo und CI/CD-Basis stehen.
- Frontend kann gegen Mock-API starten.
- SAP-Foundation kann parallel mit klaren Kontrakten beginnen.
- Testdaten koennen fachlich validiert werden.
