# xTS Monorepo

xTS ist das interne System fuer Ressourcenplanung, Beauftragung, Stundenschreibung, Genehmigung und Reporting externer Ressourcen.

Dieses Repository ist als Monorepo aufgebaut, damit Konzept, SAP-Artefakte, OData-Kontrakte, Mock-API und Angular WebClient gemeinsam versioniert und durch eine CI/CD-Pipeline geprueft werden.

## Stand (2026-09-06)

- Alle Epics des MVP-Backlogs, die sich im WebClient und in der Mock-API abbilden lassen, sind umgesetzt: Stammdaten, Planung, Beauftragung (BANF/Bestellung simuliert), Freischaltung, Stundenschreibung, Genehmigung mit simulierter WE-Buchung, Reporting (Budget-Monitor, Stundenkontingent-Monitor, Ressourcen-Live-Circle), Regelwerk, Aenderungs-/Fehlerprotokoll, Testdatenpaket.
- Authentifizierung: Entscheidung 6 ist fuer **Option B** gefallen (Entra `oid` als `AAD_OID`, `AAD_UPN` als Fallback); der WebClient meldet ueber Microsoft Entra ID (MSAL) an, siehe `docs/entra-anbindung.md`.
- Audit vom 2026-09-03 (`docs/audit-2026-09-03.md`): die Stabilisierungsschritte 1 bis 8, 10a und 10b sind umgesetzt (Statusmaschine, Payload-Validierung, Kontingentpruefung, Minutenarithmetik, Arbeitszeit/Tagesdifferenz, Lade-/Fehlerzustaende, Identitaetswechsel, rollengeschuetzte Lesepfade, Angular 22, Doku-Konsolidierung).
- OData: Zielsystem ist SAP ECC, also OData V2 (Entscheidung 17). Der WebClient hat eine Adapterschicht mit Laufzeitpruefung jeder Antwort; die Mock-API liefert mit `XTS_ODATA=v2` die V2-Form, beide Formen laufen in CI (Audit-Schritt 9a).
- Offen: Zeitraum fuer `MyTimesheets` (Schritt 9b); SAP-seitige Umsetzung (Epics 9 und 14); offene Fachentscheidungen O2 bis O7 in `docs/entscheidungen-v0.1.md`.

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
npm run test:smoke:v2   # gleiche Specs gegen die SAP-OData-V2-Antwortform
```

## Quality Gates

- Vor lokalem Commit: `npm run precommit` (Format, Lint, Typecheck, Unit- und Contract-Tests)
- Vor Merge in GitHub: Workflow `xTS CI` (zusaetzlich Doku-Links, Build, Playwright)
- Merge nach Review-Freigabe per Squash-Merge; Branch Protection auf `main`
- SAP-Deployment: SAP-Transporte bleiben fuehrend; ABAP-Objekte werden parallel via abapGit versioniert

## Arbeitsannahmen

- Angular bleibt Frontend-Technologie fuer alle Screens; das Konzept v0.1 sah SAP-Dynpros fuer Admin, Planung, Beauftragung, Genehmigung und Reporting vor (siehe Umsetzungsstand im Konzept).
- SAP bleibt fuehrend fuer Kontierung, BANF, Bestellung und Wertefluss.
- WebClient-Authentifizierung erfolgt ueber Entra ID; Mapping auf `ZXTS_WIW_T-EXTNR` ueber `AAD_OID` mit `AAD_UPN` als Fallback.
- xTS legt MM-BANF aktiv an, liest MM-Bestellungen per Job nach und bucht nach Genehmigung synchron den Wareneingang.
- Fuehrender Service-Kontrakt fuer SAP und Mock-API ist `docs/odata-contracts.md`; die Pfade in Konzept §8 sind die urspruengliche Skizze.
