# xTS SAP Workspace

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
