# ABAP / abapGit

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

