# SAP Quality Gates

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](../../docs/release-zuschnitt.md); offene Fachfragen bleiben offen.

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
