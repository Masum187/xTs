# xTS Monorepo

xTS ist das interne System fuer Ressourcenplanung, Beauftragung, Stundenschreibung, Genehmigung und Reporting externer Ressourcen.

Dieses Repository ist als Monorepo aufgebaut, damit Konzept, SAP-Artefakte, OData-Kontrakte, Mock-API und Angular WebClient gemeinsam versioniert und durch eine CI/CD-Pipeline geprueft werden.

## Stand (2026-09-09)

- Alle Epics des MVP-Backlogs, die sich im WebClient und in der Mock-API abbilden lassen, sind umgesetzt: Stammdaten, Planung, Beauftragung (BANF/Bestellung simuliert), Freischaltung, Stundenschreibung, Genehmigung mit simulierter WE-Buchung, Reporting (Budget-Monitor, Stundenkontingent-Monitor, Ressourcen-Live-Circle), Regelwerk, Aenderungs-/Fehlerprotokoll, Testdatenpaket.
- Authentifizierung: Entscheidung 6 ist fuer **Option B** gefallen (Entra `oid` als `AAD_OID`, `AAD_UPN` als Fallback); der WebClient meldet ueber Microsoft Entra ID (MSAL) an, siehe `docs/entra-anbindung.md`.
- Audit vom 2026-09-03 (`docs/audit-2026-09-03.md`): die Stabilisierungsschritte 1 bis 10 sind umgesetzt (Statusmaschine, Payload-Validierung, Kontingentpruefung, Minutenarithmetik, Arbeitszeit/Tagesdifferenz, Lade-/Fehlerzustaende, Identitaetswechsel, rollengeschuetzte Lesepfade, OData-V2-Adapter mit Zeitfenster, Angular 22, Doku-Konsolidierung).
- OData: Zielsystem ist SAP ECC, also OData V2 (Entscheidung 17). Der WebClient hat eine Adapterschicht mit Laufzeitpruefung jeder Antwort; die Mock-API liefert mit `XTS_ODATA=v2` die V2-Form, beide Formen laufen in CI (Audit-Schritt 9a). `MyTimesheets` wird je Zeitfenster (Vormonat bis Folgemonat) geladen, Standardtag ist heute (Schritt 9b).
- Fachentscheidungen 18 (Datumsregeln) und 19 (Genehmigerzustaendigkeit je Kontierung) sind gefallen; die Restbefunde des Audits sind als Schritte 11 bis 15 neu sortiert (`docs/audit-2026-09-03.md`), die zugehoerigen Stories sind XTS-014, XTS-056 und XTS-063.
- Schritt 11 (Datumsregeln, Entscheidung 18) ist umgesetzt: laufender Monat plus Vormonat bis zum Monatsabschluss (Regelwerk Infotyp 3), Zukunft gesperrt, Wochenend-Hinweis; die Mock-API nimmt fuer Tests `XTS_TODAY`.
- Schritt 12 (Genehmigerzustaendigkeit, Entscheidung 19) ist umgesetzt: Genehmiger je Kontierung mit Vertretung in der Verwaltung, Genehmigung und Reporting fuer `approver` auf die eigenen Kontierungen geschnitten, Rolle `controller` sieht das Reporting ungeschnitten; Tagesfreigabe wirkt gesamthaft mit sichtbaren Positionen.
- Schritt 13 ist umgesetzt: ungespeicherte Aenderungen der Stundenschreibung fragen vor Navigation, Persona-Wechsel und Reload nach; Planstunden sind auf 0 bis 744 in ganzen Minuten begrenzt und brauchen eine gueltige Teamzuordnung im Planmonat.
- Schritt 14 (Bedienbarkeit) ist umgesetzt: alle Screens passen ab 375 px ohne seitenweites Scrollen (breite Tabellen scrollen im Panel), Kontraste erfuellen WCAG AA, Problemmeldungen der Stundenschreibung sind per `aria-describedby` mit den Feldern verknuepft; erwartete 403/404 beim Identitaetswechsel bleiben reine Browser-Netzwerkmeldungen, die App loggt nichts (E2E-Regressionstest).
- UI-Redesign: Der Handoff "Modernist" ist bewertet (`docs/ui-redesign-bewertung.md`): schrittweise Migration der Oberflaeche unter Erhalt von Fachlogik, Kontrakten und Tests; Epics 15 und 16 sind im Backlog und in Jira (XTS-87 bis XTS-103) angelegt; freigegeben ist nur die Design-Baseline XTS-140 (Entscheidung 20), Oberflaechenumbau und Zusatzfunktionen erst nach deren Abnahme.
- Schritt 15 Teil A ist umgesetzt: jeder E2E-Test setzt das Testdatenpaket zurueck (`frontend/e2e/fixtures.ts`), CI wiederholt einen fehlgeschlagenen Test einmal, die Fixtures enthalten Umlaute, Sonderzeichen, einen langen Text, einen Teamwechsel und leere Listen. Teil B (Komponentenzerlegung, Lazy Loading) wird mit XTS-154 abgestimmt.
- Offen: Schritt 15 Teil B, SAP-seitige Umsetzung (Epics 9 und 14), Fachentscheidungen O4 bis O7, O9 und O12 in `docs/entscheidungen-v0.1.md`; die Design-Baseline XTS-140 ist abgenommen (`docs/design-baseline-xts-140.md`, O10/O11 entschieden), XTS-141 ist umgesetzt (Tokens, Archivo lokal, Bausteine als `.xts-*`, Kontrast- und Fokuspruefung auf `/assets/design-system/index.html`; `docs/design-tokens.md`), ohne Anwendung in den Screens. XTS-142 und XTS-150 warten auf ausdrueckliche Freigabe.

## Struktur

| Pfad         | Zweck                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `docs/`      | Konzept-Baseline, Backlog, Entscheidungen, OData-Kontrakt, Audit, UAT                                             |
| `frontend/`  | Angular 22 WebClient (alle Screens: Stundenschreibung, Genehmigung, Reporting, Planung, Beauftragung, Verwaltung) |
| `mock-api/`  | Lokale OData-nahe Mock-API (Node, ohne Framework) mit Contract-Tests                                              |
| `sap/`       | abapGit-/Transport-/DDIC-/OData-/Qualitaetsdokumentation (noch ohne ABAP-Code)                                    |
| `.github/`   | Pull Request Templates, Issue Templates und GitHub Actions                                                        |
| `.githooks/` | Lokale Git Hooks fuer Pre-Commit-Checks                                                                           |

## Stack

- Node 24 LTS (`.nvmrc`; `engines`: `^22.22.3 || ^24.15.0 || >=26`), npm-Workspaces
- Angular 22, TypeScript 6.0, Standalone Components, Signals, Builder `@angular/build`
- Tests: vitest (Frontend-Logik), Playwright (E2E gegen Dev-Server und Mock-API), `node --test` (Mock-API-Contract-Tests)
- Qualitaet: Prettier, ESLint, Pre-Commit-Hook, GitHub Actions `xTS CI` als Required Check `Quality Gate`

## Schnellstart

```bash
npm install
npm run ci
```

Lokale Git Hooks aktivieren:

```bash
git config core.hooksPath .githooks
```

Mock-API starten:

```bash
npm run start --workspace mock-api
```

Frontend starten (Modus `mock` mit Dev-Persona-Umschalter):

```bash
npm run start --workspace frontend
```

Frontend mit echter Entra-ID-Anmeldung starten (Tenant/Client-ID in `frontend/src/environments/environment.entra.ts`, siehe `docs/entra-anbindung.md`):

```bash
npm run start:entra --workspace frontend
```

E2E-Smoke-Tests (setzen das Testdatenpaket der laufenden Mock-API vor dem Lauf zurueck):

```bash
npm run test:smoke
npm run test:smoke:v2   # gleiche Specs gegen die SAP-OData-V2-Antwortform (laufende Mock-API muss mit XTS_ODATA=v2 gestartet sein, sonst bricht der Lauf ab)
# Eine bereits laufende Mock-API muss mit XTS_TODAY=2026-05-05 gestartet sein (Systemdatum des Testdatenpakets), sonst bricht der Lauf ab.
```

## Quality Gates

- Vor lokalem Commit: `npm run precommit` (Format, Lint, Typecheck, Unit- und Contract-Tests)
- Vor Merge in GitHub: Workflow `xTS CI` (zusaetzlich Doku-Links, Build, Playwright)
- Build-Budget: `npm run build` ist seit PR #37 ein Produktions-Build (`ng build --configuration production`, Hashing, Budgets). Das Initial-Bundle liegt bei 503 kB; die Warnschwelle wurde von 500 auf 600 kB gesetzt, weil der Build zuvor ohne Budgets lief und die Grenze nie geprueft wurde. Die Erhoehung schafft nur Spielraum, keine Verkleinerung. Folgepunkt: Neubewertung der Schwelle (Ziel wieder 500 kB oder weniger) nach Lazy Loading der Routen in Audit-Schritt 15 Teil B / XTS-154.
- Merge nach Review-Freigabe per Squash-Merge; Branch Protection auf `main`
- SAP-Deployment: SAP-Transporte bleiben fuehrend; ABAP-Objekte werden parallel via abapGit versioniert

## Arbeitsannahmen

- Angular bleibt Frontend-Technologie fuer alle Screens; das Konzept v0.1 sah SAP-Dynpros fuer Admin, Planung, Beauftragung, Genehmigung und Reporting vor (siehe Umsetzungsstand im Konzept).
- SAP bleibt fuehrend fuer Kontierung, BANF, Bestellung und Wertefluss.
- WebClient-Authentifizierung erfolgt ueber Entra ID; Mapping auf `ZXTS_WIW_T-EXTNR` ueber `AAD_OID` mit `AAD_UPN` als Fallback.
- xTS legt MM-BANF aktiv an, liest MM-Bestellungen per Job nach und bucht nach Genehmigung synchron den Wareneingang.
- Fuehrender Service-Kontrakt fuer SAP und Mock-API ist `docs/odata-contracts.md`; die Pfade in Konzept §8 sind die urspruengliche Skizze.
