# xTS Konzeptbasis

Dieser Ordner enthaelt die konsolidierte Arbeitsbasis fuer den Entwicklungsstart von xTS.

## Dateien

| Datei | Zweck |
| --- | --- |
| `entwicklungskonzept-v0.1.md` | Fachlich-technisches Zielbild, MVP-Scope, Prozesse, Datenmodell, Services, Screens und Architektur. |
| `backlog-v0.1.md` | Erstes MVP-Backlog mit Epics, User Stories und Akzeptanzkriterien. |
| `entscheidungen-v0.1.md` | Entscheidungslog mit den inzwischen fachlich beantworteten Grundsatzfragen. |
| `development-workflow.md` | GitHub-, Branching-, PR- und lokale Hook-Regeln. |
| `odata-contracts.md` | OData-nahe Kontraktbasis fuer SAP und Mock-API. |

## Empfohlene Reihenfolge

1. `entwicklungskonzept-v0.1.md` fachlich gegenlesen.
2. Entscheidungen in `entscheidungen-v0.1.md` gegenlesen und technische Folgefragen priorisieren.
3. `backlog-v0.1.md` in ein Projekttool uebertragen.
4. `development-workflow.md` fuer GitHub/CI/CD einrichten.
5. Sprint 1 mit Monorepo, Mock-API, Angular Foundation und SAP Foundation starten.

## Wichtige Arbeitsannahmen

- SAP bleibt fuehrend fuer Kontierung, BANF, Bestellung und Wertefluss.
- Der MVP fokussiert Planung, Beauftragung, Stundenschreibung, Genehmigung und Reporting.
- xTS legt MM-BANF aktiv an, liest MM-Bestellungen per Job nach und bucht nach Genehmigung synchron den Wareneingang.
- Die BANF-Anlage nutzt das im Konzept definierte EBAN/EBKN/COBL-Feldmapping.
- WebClient-Authentifizierung erfolgt ueber AD/OAuth.
- Vollautomatische Rechnung, Zahllauf, Gutschriftsverfahren und Obligobereinigung sind nicht Teil des MVP.
- `ZXTS_MAPLAN_T` wird als konsolidierter Name fuer die Planungstabelle verwendet.
