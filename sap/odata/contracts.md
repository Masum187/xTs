# SAP OData Contracts

> **Release-Abgrenzung 26.09.2026 (Entscheidung 23):** Im aktuellen Release erfasst xTS Leistungsstunden und zeigt SAP-Planung, Belege und Genehmigungsstatus nur lesend. Planung, Genehmigung/Rueckweisung, Beauftragung/BANF/Bestellung und WE erfolgen ausschliesslich in SAP. Die vorhandenen weitergehenden Frontend-Funktionen bleiben fuer spaeter erhalten, sind fuer diesen Release aber in UI und schreibenden API-Pfaden zu deaktivieren. **Noch nicht technisch umgesetzt.** Nachfolgende Beschreibungen des bisherigen Vollumfangs sind keine aktuelle Release-Freigabe. Massgeblich ist der [Release-Zuschnitt](../../docs/release-zuschnitt.md); offene Fachfragen bleiben offen.

Fuehrender Kontrakt fuer SAP und Mock-API ist `docs/odata-contracts.md` (Pfade, Felder, Fehlercodes, Rollen, Validierungsregeln). Die Service-Skizze in `docs/entwicklungskonzept-v0.1.md` §8 ist die urspruengliche Baseline und weicht in Pfaden und Verben ab (siehe dort Abschnitt 0).

Geplante Service-Schnitte (Namen aus dem Konzept, Inhalt gemaess Kontrakt):

- `Z_XTS_MASTERDATA_SRV` - Mitarbeiter, Teams, Teamzuordnung, Kontierungen, Mitarbeiter-Kontierungen, Regelwerk, Protokoll, Testdaten
- `Z_XTS_PLANNING_SRV` - Planungsuebersicht, Planstunden, Freigabe
- `Z_XTS_ORDERING_SRV` - Beauftragungskandidaten, Beauftragung, BANF, Bestelldaten-Job, Fehlerprotokoll
- `Z_XTS_TIMESHEET_SRV` - Profil, Freischaltungen, Stundenzettel
- `Z_XTS_APPROVAL_SRV` - Genehmigungsliste, Genehmigen/Zurueckweisen mit WE-Buchung
- `Z_XTS_REPORTING_SRV` - Live-Circle, Budget-Monitor, Kontingent-Monitor

Entscheidung 17 (`docs/entscheidungen-v0.1.md`): Zielsystem ist SAP ECC mit klassischem Gateway, also OData V2. Die Abbildung der Feldtypen (`Edm.Decimal` als String, `Edm.DateTime` als `/Date(ms)/`, `Edm.Time`), das Fehlerobjekt (`error.code`, `error.message.value`, `error.innererror`) und die Paginierung (`$top`/`$skip`/`$inlinecount`, `__next`) sind in `docs/odata-contracts.md`, Abschnitt "Antwortformen", festgelegt; der WebClient versteht sie ueber seine Adapterschicht, die Mock-API liefert sie mit `XTS_ODATA=v2`. Mit dem ersten echten Service zu vereinbaren: CSRF-Token-Handshake, ETag/`If-Match`, Abbildung der benannten Filterparameter auf `$filter` oder Funktionsimporte.

Authentifizierung: `Authorization: Bearer` mit Entra-ID-Token; Validierung und Mapping `oid`/`preferred_username` auf `EXTNR` im Service, siehe `docs/entra-anbindung.md`.
