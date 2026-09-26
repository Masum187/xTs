# SAP Transport Strategy

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](../../docs/release-zuschnitt.md); offene Fachfragen bleiben offen.

SAP-Transporte bleiben fuehrend fuer Deployment.

## Prozess

1. ABAP-Objekte im SAP-DEV entwickeln.
2. ATC/ABAP Unit ausfuehren.
3. Objekte per abapGit ins Repository synchronisieren.
4. Pull Request mit Transportnummer oeffnen.
5. Nach Review und CI-Freigabe Transport in SAP freigeben.

## Dokumentation

Transportnummern werden in `transport-log.md` dokumentiert.
