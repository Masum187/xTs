# SAP Quality Gates

## Vor Transportfreigabe

- ATC ohne kritische Findings.
- ABAP Unit Tests fuer gekapselte Logik gruen.
- Berechtigungsfall geprueft.
- Aenderungs-/Auditfelder gesetzt.
- Transportnummer im Pull Request dokumentiert.

## Manuelle Integrationsfaelle

- Stammdaten anlegen, aendern, logisch loeschen.
- Planung `V -> F`.
- BANF-Anlage `F -> P`.
- Bestellung per Job `P -> B`.
- Genehmigung `F -> G`.
- Synchrone WE-Buchung mit Fehlerprotokoll.

