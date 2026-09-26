# ABAP / abapGit

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](../../docs/release-zuschnitt.md); offene Fachfragen bleiben offen.

## Ziel

ABAP-Objekte fuer xTS werden reviewbar in GitHub versioniert und ueber SAP-Transporte deployed.

## Startkonventionen

- SAP-Paket: final mit SAP-Basis festlegen.
- Namensraum: `ZXTS_*`.
- Tabellen, Klassen, Reports und Services werden per abapGit exportiert.
- Transporte werden in `sap/transports/transport-log.md` dokumentiert.

## Mindestpruefungen

- ATC ohne kritische Findings.
- ABAP Unit fuer fachliche Logik, soweit gekapselt.
- Manuelle SAP-MM-Testfaelle fuer BANF, Bestellnachlesen und WE-Buchung.
