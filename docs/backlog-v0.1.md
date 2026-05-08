# xTS MVP Backlog v0.1

Stand: 2026-05-08

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
