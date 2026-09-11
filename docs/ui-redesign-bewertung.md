# xTS UI-Redesign (Modernist): Bewertung und Einordnung

Stand: 2026-09-11. Status: Vorschlag zur Freigabe, keine beauftragte Umsetzung. Grundlage: Handoff-Paket `UI-Redesign für localhost.zip` (README, `styles.css`, klickbarer Prototyp, Explorations-Canvas), abgeglichen mit dem Repo-Stand nach PR #30 und dem offenen PR #31. Die konsolidierte Fassung mit Jira-Verlinkung liegt in Confluence ("xTS - UI-Redesign, Konsolidierte Bewertung"); dieses Dokument ist die Repo-Referenz dazu.

## Entscheidung in einem Satz

Die Designrichtung eignet sich als Weiterentwicklung des bestehenden Angular-WebClients: kein Neustart, kein Framework-Wechsel, kein Verwerfen der Fachlogik. Empfohlen ist eine schrittweise Migration der Oberflaeche unter Erhalt der Kontrakte, Fachregeln und Sicherheitsmechanismen. Der Prototyp selbst (React-Laufzeit `support.js`) wird nicht eingebaut; Tokens und Gestaltung sind die Grundlage.

## Was das Paket vorschlaegt

- Gemeinsame Shell: dunkle Seitenleiste (240 px) als Hauptnavigation mit Persona-Block und Zaehler-Badge fuer offene Genehmigungen; Inhalte im "Werkbank-Raster" mit sichtbaren Rasterlinien.
- Design-System "Modernist": Schrift Archivo, Radius 0 ueberall, Akzentrot, Neutral-Ramp, Buttons/Tags/Inputs/Tabellen als Klassen in `styles.css`.
- Sechs Screens: Stundenschreibung im Raster, Genehmigung als Liste mit Detailansicht, Reporting mit KPI-Kopf und Stufenleiste, Planung als Kachel-Matrix mit Zellen-Editor (4 sichtbare Monate), Beauftragung als dreispaltiges Pipeline-Board, Verwaltung als "Einstellungen" mit Baumnavigation (Organisation, Regelwerk, Integrationen, System).

## Was im Repo bleibt (Erhaltungsliste)

| Bereich                                      | Behandlung                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Angular, TypeScript, Build, CI               | Beibehalten. Prototyp-Laufzeit nicht in die Produkt-App.                                                                                   |
| Fachlogik `*.logic.ts`                       | Weiterverwenden: Datumsregeln, Minutenrechnung, Kontingente, Statuspruefungen, Erkennung ungespeicherter Aenderungen.                      |
| Services, OData-V2-Adapter, Decoder, Modelle | Weiterverwenden. Neue Kontrakte nur fuer neue Fachfunktionen.                                                                              |
| Mock-API, Kontrakt, Contract-Tests           | Weiterverwenden. Das Design allein verlangt kein neues Backend.                                                                            |
| Auth, Rollen, Zustaendigkeiten, Guards       | Unveraendert verbindlich (Entscheidungen 12, 16, 19). Navigation und Datenzugriff bleiben rollengeschuetzt.                                |
| Unit-Tests                                   | Sicherheitsnetz, bleiben unveraendert.                                                                                                     |
| E2E-Tests                                    | Fachliche Zusicherungen bleiben; Test-IDs moeglichst uebernehmen, Text- und Label-Selektoren anpassen; Breiten- und Fokus-Tests ergaenzen. |
| Komponentenstruktur                          | Bleibt (timesheet, approval, reporting, planning, orders, admin); `admin` wird Route `einstellungen` mit Kindrouten und Redirect.          |

Ersetzt werden Templates, komponentenbezogene Styles und die App-Shell. Die Komponentenklassen bleiben weitgehend, erhalten aber neue Auswahlzustaende (ausgewaehlter Genehmigungstag, ausgewaehlte Planzelle, Unterroute der Einstellungen).

## Fachliche Konflikte, die vor der Umsetzung zu korrigieren sind

Das Paket ist gegen einen Stand von Anfang September entworfen und kennt die Schritte 9b bis 14 der Stabilisierung nicht. Massgeblich bleiben Entscheidungslog, `odata-contracts.md` und die abgestimmten Fachregeln.

1. **K1 Planstatus**: Der Prototyp erlaubt das Editieren von F/P und ein Zuruecksetzen auf V. Heute sind F/P/B gesperrt (XTS-021, XTS-023). Eine Ruecknahme ist eine neue Fachentscheidung (O12) und wird im ersten Redesign nicht angeboten.
2. **K2 BANF**: "Beauftragung anlegen" verschiebt im Prototyp direkt nach "BANF erstellt" und zeigt einen Automatik-Job alle 15 Minuten. Real gilt `created` -> expliziter BANF-Aufruf -> `banf` (XTS-031, XTS-032). Der manuelle Ablauf bleibt, der Zwischenzustand "Beauftragung angelegt, BANF offen" und der Fehler-/Wiederholungspfad sind abzubilden; Automatik ist O9.
3. **K3 Genehmigung**: Der Prototyp entfernt Eintraege nur lokal. Pflichtgrund bei Rueckweisung, Servererfolg, WE-Fehler, Vier-Augen-Prinzip und Zustaendigkeit je Kontierung (Entscheidung 19, `responsibleCoIdents`, Markierung fremder Positionen, Hinweis ohne Zuordnung) bleiben verbindlich. Die Filter nach Leistungsmonat und Mitarbeiter (XTS-060) fehlen im Entwurf und bleiben erhalten.
4. **K4 Planungsarithmetik**: Der Prototyp rechnet mit `parseInt` und teilt die Auslastung durch die Einzelkapazitaet. Verbindlich sind Minutenarithmetik (`shared/hours.ts`), Planstunden 0 bis 744 in ganzen Minuten, Ueberplanung gegen den Werkkalender und die Teamzuordnungspflicht je Planmonat (Zustand "keine Teamzuordnung"). Vier sichtbare Monate sind ein Ausschnitt der zwoelf Monate aus XTS-020, kein verkuerzter Horizont.
5. **K5 Reporting**: "Beauftragt" ist nicht "bestellt"; Stunden und Prozent brauchen getrennte Definitionen. Belegfilter (`ebeln`/`ebelp`), Zeitraeume, Detailstufen und der Rollenschnitt fuer Genehmiger gelten auch fuer KPI-Kacheln. Der Kontingent-Monitor (XTS-072) fehlt im Entwurf und bleibt eigenstaendig erhalten. Keine Demozahlen uebernehmen.
6. **K6 SAP/Entra**: "SAP S/4HANA (OData)" widerspricht Entscheidung 17 (SAP ECC, OData V2). Anzeigen wie "verbunden", "letzter Lauf" und Zeitplaene sind Beispieldaten; reale Betriebsfunktionen brauchen Backend-Daten (XTS-083, XTS-084).
7. **K7 Funktionsvollstaendigkeit**: Im Einstellungsbaum fehlen Teams, Teamzuordnungen, Kontierungen, Mitarbeiter-Kontierungen, Genehmigerzuordnungen (XTS-014) und die Monatsabschlussregel (Infotyp 3). Diese Pflegeseiten bleiben auffindbar. Rollen und Berechtigungen haengen an O6.
8. **K8 Zustaende und Bedienbarkeit**: Nicht entworfen sind Datumsfeld und Sperrhinweis ausserhalb des Zeitraums (Entscheidung 18), Wochenend-Hinweis, ungespeicherte Aenderungen mit Rueckfrage, Lade-/Fehlerzustand mit erneutem Versuch, Problemliste mit `aria-describedby`, Auth-Zustaende (abgemeldet, nicht konfiguriert, nicht gemappt, inaktiv), Rollenhinweis, Nicht-gefunden-Seite und die Controller-Navigation. Die feste Seitenleiste braucht eigene Umbruchregeln (Regressionstest 375/768/1024 px); gedaempfte Texte in Neutral-500 liegen unter 3:1 Kontrast und sind gegen WCAG AA zu pruefen. Archivo wird lokal gehostet (O11).

## Backlog und Jira-Zuordnung

Die Konzept-IDs stehen im Repo-Backlog (`backlog-v0.1.md`), die Jira-Schluessel wurden fortlaufend vergeben. Filter in Jira: `project = XTS AND labels in ("redesign") ORDER BY key ASC`.

| Konzept-ID | Jira    | Titel                                                    | Epic                           | Prio |
| ---------- | ------- | -------------------------------------------------------- | ------------------------------ | ---- |
| Epic 15    | XTS-87  | Design-System und responsive App-Shell                   |                                |      |
| XTS-140    | XTS-89  | Design-Baseline und Funktionsabgleich festlegen          | 15                             | P0   |
| XTS-141    | XTS-90  | Design-Tokens und gemeinsame UI-Bausteine                | 15                             | P1   |
| XTS-142    | XTS-91  | Responsive, rollenbasierte Navigation                    | 15                             | P1   |
| Epic 16    | XTS-88  | WebClient-Ansichten modernisieren                        |                                |      |
| XTS-150    | XTS-92  | Stundenschreibung im neuen Raster                        | 16                             | P1   |
| XTS-151    | XTS-93  | Genehmigung als Liste und Detailansicht                  | 16                             | P1   |
| XTS-152    | XTS-94  | Planungsmatrix mit Zelleneditor                          | 16                             | P1   |
| XTS-153    | XTS-95  | Beauftragungsboard mit vollstaendigem Statusmodell       | 16                             | P1   |
| XTS-154    | XTS-96  | Einstellungen in Unterseiten zerlegen                    | 16                             | P1   |
| XTS-155    | XTS-97  | Reporting gestalterisch angleichen                       | 16                             | P1   |
| XTS-156    | XTS-98  | Visuelle und funktionale Abnahme (fortlaufend je Screen) | 16                             | P1   |
| XTS-073    | XTS-99  | KPI-Uebersicht (Reporting-Kacheln)                       | 8 Reporting                    | P1   |
| XTS-074    | XTS-100 | Pivot- und Diagrammansicht (optional)                    | 8 Reporting                    | P2   |
| XTS-083    | XTS-101 | Integrationsstatus und Verbindungstest                   | 9 Berechtigung, Audit, Betrieb | P2   |
| XTS-084    | XTS-102 | Jobstatus und Zeitplaene (ohne BANF-Automatik)           | 9 Berechtigung, Audit, Betrieb | P2   |
| XTS-024    | XTS-103 | Werkkalender transparent anzeigen (optional)             | 3 Ressourcenplanung            | P2   |

Abhaengigkeiten: XTS-91 wartet auf XTS-90 (Shell braucht Tokens); Epic 16 wartet auf XTS-89 (Baseline). Nicht enthalten: Rollenpflege aus AD-Gruppen (O6), Planungsruecknahme (O12), automatische BANF-Anlage (O9).

## Empfohlene Reihenfolge

1. XTS-140 Funktionsabgleich abschliessen; die Findings zu PR #31 nicht fallen lassen.
2. XTS-141, XTS-142, XTS-150: Tokens, responsive Shell und Stundenschreibung als erster vertikaler Umbau.
3. XTS-151 und XTS-154: Genehmigung und Einstellungen; die Strukturarbeit aus Audit-Schritt 15 (Komponentenzerlegung, Testisolation) mit der Verwaltungsaufteilung abstimmen statt sie vorab doppelt zu machen.
4. XTS-152 und XTS-153: Planung und Beauftragung mit den bestehenden Statusregeln.
5. XTS-155 Reporting angleichen; XTS-073/074/083/084 separat priorisieren.

Pro Screen ein kleiner PR mit sichtbarem Ergebnis, bestehende Fach- und E2E-Tests bleiben gruen. Offene Entscheidungen O8 bis O12 stehen in `entscheidungen-v0.1.md`.
