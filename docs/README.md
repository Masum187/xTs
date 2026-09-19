# xTS Dokumentation

Dieser Ordner enthaelt die Konzept-Baseline (v0.1, Stand 2026-05-08) und die seitdem gepflegte Umsetzungsdokumentation. Bei Widerspruechen gilt: `odata-contracts.md` und `entscheidungen-v0.1.md` beschreiben den umgesetzten Stand, `entwicklungskonzept-v0.1.md` und `backlog-v0.1.md` sind die fachliche Baseline mit Hinweisen auf Abweichungen.

## Dateien

| Datei                                    | Zweck                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entwicklungskonzept-v0.1.md`            | Baseline: fachlich-technisches Zielbild, Prozesse, Datenmodell, Services, Screens; mit Abschnitt "Umsetzungsstand" zu Abweichungen.                                                                                                                                                        |
| `backlog-v0.1.md`                        | MVP-Backlog mit Epics, User Stories und Akzeptanzkriterien; Umsetzungsstand im Kopf des Dokuments.                                                                                                                                                                                         |
| `entscheidungen-v0.1.md`                 | Entscheidungslog: Grundsatzfragen, Entscheidungen aus der Stabilisierung, offene Entscheidungen.                                                                                                                                                                                           |
| `development-workflow.md`                | GitHub-, Branching-, PR- und lokale Hook-Regeln.                                                                                                                                                                                                                                           |
| `odata-contracts.md`                     | OData-nahe Kontraktbasis fuer SAP und Mock-API.                                                                                                                                                                                                                                            |
| `entscheidungsvorlage-extnr-mapping.md`  | Entscheidungsvorlage fuer das AD/OAuth-Attribut des EXTNR-Mappings (XTS-050).                                                                                                                                                                                                              |
| `adr/0012-sap-zieltabellen-zpot-time.md` | ADR-0012 (Status Proposed): SAP-Zieltabellen `ZPOT_TIME_T`/`ZPOT_PTIME_T` uebernehmen; Feldstruktur, sieben offene Fragen an die SAP-Seite, Konsequenzen fuer Kontrakt, Mock und Konventionen. Repo-Kopie der Confluence-ADR; `adr/` sammelt Architecture Decision Records aus Confluence. |
| `testdaten-uat-v0.1.md`                  | Testdatenpaket und UAT-Drehbuch: Ausgangsstand, durchgehender Fall, Rueckweisung, Fehlerfaelle.                                                                                                                                                                                            |
| `entra-anbindung.md`                     | Anmeldung ueber Microsoft Entra ID (MSAL): App-Registrierung, Konfiguration, Ablauf, SAP-Punkte.                                                                                                                                                                                           |
| `audit-2026-09-03.md`                    | Audit des Stunden-Tools: Befunde mit Fundstellen, Luecken, priorisierte Stabilisierungsschritte.                                                                                                                                                                                           |
| `ui-redesign-bewertung.md`               | Bewertung des UI-Redesign-Handoffs (Modernist): Erhaltungsliste, Konflikte K1 bis K8, Backlog- und Jira-Zuordnung, Reihenfolge.                                                                                                                                                            |
| `design-baseline-xts-140.md`             | Design-Baseline und Funktionsabgleich (XTS-140): Grundregeln, Checkliste je Screen mit Test-IDs, Vorschlaege zu Breiten, Kontrast und Schrift, Abnahmereihenfolge.                                                                                                                         |
| `design-tokens.md`                       | Design-Tokens, UI-Bausteine, gemessene Kontraste und Schriftbereitstellung (XTS-141); Bereitstellung ohne Anwendung in den Screens.                                                                                                                                                        |

## Empfohlene Reihenfolge fuer neue Beteiligte

1. `README.md` im Repository-Root fuer Stand und Stack.
2. `odata-contracts.md` fuer das umgesetzte Verhalten der Services (fuehrend fuer die SAP-Implementierung).
3. `entscheidungen-v0.1.md` fuer getroffene und offene Entscheidungen.
4. `testdaten-uat-v0.1.md` und die laufende Anwendung fuer die Prozesskette.
5. `audit-2026-09-03.md` fuer bekannte Luecken und die Reihenfolge der Stabilisierung.
6. `entwicklungskonzept-v0.1.md` und `backlog-v0.1.md` als fachliche Baseline.

## Wichtige Arbeitsannahmen

- SAP bleibt fuehrend fuer Kontierung, BANF, Bestellung und Wertefluss.
- Der MVP fokussiert Planung, Beauftragung, Stundenschreibung, Genehmigung und Reporting.
- xTS legt MM-BANF aktiv an, liest MM-Bestellungen per Job nach und bucht nach Genehmigung synchron den Wareneingang.
- Die BANF-Anlage nutzt das im Konzept definierte EBAN/EBKN/COBL-Feldmapping.
- WebClient-Authentifizierung erfolgt ueber Microsoft Entra ID (Entscheidung 6, Option B: `AAD_OID`, Fallback `AAD_UPN`).
- Vollautomatische Rechnung, Zahllauf, Gutschriftsverfahren und Obligobereinigung sind nicht Teil des MVP.
- `ZXTS_MAPLAN_T` wird als konsolidierter Name fuer die Planungstabelle verwendet.
