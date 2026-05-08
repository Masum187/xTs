# xTS Monorepo

xTS ist das interne System fuer Ressourcenplanung, Beauftragung, Stundenschreibung, Genehmigung und Reporting.

Dieses Repository ist als Monorepo aufgebaut, damit Konzept, SAP-Artefakte, OData-Kontrakte, Mock-API und Angular WebClient gemeinsam versioniert und durch eine CI/CD-Pipeline geprueft werden.

## Struktur

| Pfad | Zweck |
| --- | --- |
| `docs/` | Entwicklungskonzept, Backlog, Entscheidungen und Entwicklungsleitfaden |
| `frontend/` | Angular + TypeScript WebClient fuer Stundenschreibung |
| `mock-api/` | Lokale OData-nahe Mock-API fuer Frontend-Entwicklung ohne SAP-Blocker |
| `sap/` | abapGit-/Transport-/DDIC-/OData-/Qualitaetsdokumentation |
| `.github/` | Pull Request Templates, Issue Templates und GitHub Actions |
| `.githooks/` | Lokale Git Hooks fuer Pre-Commit-Checks |

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

Frontend starten:

```bash
npm run start --workspace frontend
```

## Quality Gates

- Vor lokalem Commit: `npm run precommit`
- Vor Merge in GitHub: GitHub Actions Workflow `xTS CI`
- SAP-Deployment: SAP-Transporte bleiben fuehrend; ABAP-Objekte werden parallel via abapGit versioniert.

## Arbeitsannahmen

- Angular bleibt Frontend-Technologie.
- SAP bleibt fuehrend fuer Kontierung, BANF, Bestellung und Wertefluss.
- WebClient-Authentifizierung erfolgt ueber AD/OAuth; Mapping auf `ZXTS_WIW_T-EXTNR` ist noch technisch zu klaeren.
- xTS legt MM-BANF aktiv an, liest MM-Bestellungen per Job nach und bucht nach Genehmigung synchron den Wareneingang.

