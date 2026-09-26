# xTS SAP Workspace

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](../docs/release-zuschnitt.md); offene Fachfragen bleiben offen.

Dieser Bereich dokumentiert SAP-Artefakte, Qualitaetsregeln und Deployment-Vorgehen.

## Struktur

| Pfad          | Zweck                                            |
| ------------- | ------------------------------------------------ |
| `abap/`       | abapGit-Hinweise und spaetere ABAP-Objektexporte |
| `ddic/`       | DDIC-/Tabellenuebersicht                         |
| `odata/`      | SAP-OData-Service-Kontrakte                      |
| `quality/`    | ATC-/ABAP-Unit-/Review-Regeln                    |
| `transports/` | Transportstrategie und Transportprotokoll        |

## Grundsatz

- GitHub/abapGit dient der Versionierung und Review-Faehigkeit.
- SAP-Transporte bleiben fuehrend fuer Deployment in SAP-Systeme.
- Vor Transportfreigabe muessen ATC und relevante ABAP Unit Tests gruen sein.
