# DDIC Baseline

Die fachliche Tabellenbasis ist in `docs/entwicklungskonzept-v0.1.md` (§7) beschrieben. Die Mock-API (`mock-api/src/fixtures.js`, `masterdata.js`, `routes.js`) bildet diese Tabellen mit den unten genannten Ergaenzungen ab; `docs/odata-contracts.md` ist der fuehrende Kontrakt fuer Felder und Verhalten.

## Tabellen und Abgleich mit dem Mock-Stand (2026-09-06)

| Tabelle           | Zweck                           | Ergaenzung/Abweichung gegenueber Konzept §7                                                                                                                                                                                                                         |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZXTS_WIW_T`      | Mitarbeiterstamm                | Neu: `AAD_OID` (CHAR36, Entra objectId, fuehrendes Login-Mapping), `AAD_UPN` (CHAR241, Fallback); `RESSOURCENMGMT` als EXTNR-Referenz; Loeschkennzeichen und Aenderungsstempel gesetzt.                                                                             |
| `ZXTS_TEAM_T`     | Teams                           | Wie Konzept; inaktive/geloeschte Teams werden in Selektionen nicht angeboten.                                                                                                                                                                                       |
| `ZXTS_MATEAM_T`   | Mitarbeiter-Team-Zuordnung      | Wie Konzept; Ueberlappungen je Mitarbeiter werden abgelehnt; Planung/Reporting ermitteln das Team zeitraumbezogen.                                                                                                                                                  |
| `ZXTS_KONT_T`     | Kontierungen                    | Wie Konzept (Arten `KS`, `OR`, `PR`, `FB`, `KL`); CO-Pruefung als Stub; zusaetzlich Mitarbeiter-Kontierungs-Zuordnung mit Gueltigkeit als Planungsbasis (im Konzept nicht als Tabelle benannt).                                                                     |
| `ZXTS_KONTGEN_T`  | Genehmiger je Kontierung        | Neu (Entscheidung 19, XTS-014): `COIDENT`, `EXTNR` des Genehmigers, `VERTRETER` (Kennzeichen), `GUELTIG_VON`/`GUELTIG_BIS`, Loeschkennzeichen, Aenderungsstempel; Ueberlappungen je Kontierung und Genehmiger werden abgelehnt; Rolle `approver` ist Voraussetzung. |
| `ZXTS_MAPLAN_T`   | Planung                         | Status `V`, `F`, `P`, `B`; `L` nicht umgesetzt; Planstunden als Dezimalzahl, Summen minutenpraezise.                                                                                                                                                                |
| `ZXTS_REGELN_T`   | Regelwerk                       | Infotyp 1 nur `MA_KONT` (statt `K`/`Z`), Infotyp 2 `P`/`B`.                                                                                                                                                                                                         |
| `ZXTS_MABEAUF_T`  | Beauftragung                    | Status `created`/`banf`/`bestellt` (Mock-Namen), Planungsreferenzen als Monatsliste; BANF/EBELN/EBELP rueckgeschrieben (simuliert).                                                                                                                                 |
| `ZXTS_MAZUKONT_T` | Kontierungsfreischaltung        | Wird aus Beauftragungen abgeleitet und bei jedem Zugriff berechnet (keine Nightly Reconciliation im Mock); `OFFENE_STUNDEN` werden nicht negativ (Tagessummenpruefung).                                                                                             |
| `ZXTS_TIME_T`     | Tageskopf                       | `ARBEITSZEIT` servergefuehrt aus Kommt/Geht/Pause; neu: `ABWEICHUNGSGRUND` (255, Pflicht bei Abweichung zur Positionssumme bei Freigabe); Status `E`, `F`, `G`, `A` (`L` nicht umgesetzt); `WE_BELEG`, `GENEHMIGER`, `GENEHMIGT_AM`.                                |
| `ZXTS_PTIME_T`    | Leistungsposition               | Stunden im Viertelstundenraster 0,25 bis 24, Beschreibung bis 255 Zeichen (Konzept: CHAR/Text, Laenge zu finalisieren).                                                                                                                                             |
| `ZXTS_LOG_T`      | Aenderungs- und Fehlerprotokoll | Neu (XTS-081): `ID`, Zeitstempel, Akteur, Kategorie (`status`/`job`/`masterdata`/`rule`/`system`), Schweregrad, Objekt, Schluessel, von/nach, Meldung, Details.                                                                                                     |

## Offene technische Pruefungen

- BANF-Feldnamen aus Konzept §11.2 gegen SAP-DDIC validieren (XTS-133).
- Feldlaengen und Domains fuer Statuswerte finalisieren; Stundenfelder als `QUAN` mit zwei Nachkommastellen und Rundung auf ganze Minuten vereinbaren.
- Sperre je Mitarbeiter und Kontierung (Enqueue) beim Speichern von Stundenzetteln fuer die Kontingentpruefung.
- Token-Validierung (Entra ID) und Mapping `AAD_OID`/`AAD_UPN` im OData-Service, Rollen serverseitig pruefen (XTS-080); Rollenschnitt siehe `docs/odata-contracts.md`.
