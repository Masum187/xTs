# SAP OData Contracts

Fuehrender Kontrakt fuer SAP und Mock-API ist `docs/odata-contracts.md` (Pfade, Felder, Fehlercodes, Rollen, Validierungsregeln). Die Service-Skizze in `docs/entwicklungskonzept-v0.1.md` §8 ist die urspruengliche Baseline und weicht in Pfaden und Verben ab (siehe dort Abschnitt 0).

Geplante Service-Schnitte (Namen aus dem Konzept, Inhalt gemaess Kontrakt):

- `Z_XTS_MASTERDATA_SRV` - Mitarbeiter, Teams, Teamzuordnung, Kontierungen, Mitarbeiter-Kontierungen, Regelwerk, Protokoll, Testdaten
- `Z_XTS_PLANNING_SRV` - Planungsuebersicht, Planstunden, Freigabe
- `Z_XTS_ORDERING_SRV` - Beauftragungskandidaten, Beauftragung, BANF, Bestelldaten-Job, Fehlerprotokoll
- `Z_XTS_TIMESHEET_SRV` - Profil, Freischaltungen, Stundenzettel
- `Z_XTS_APPROVAL_SRV` - Genehmigungsliste, Genehmigen/Zurueckweisen mit WE-Buchung
- `Z_XTS_REPORTING_SRV` - Live-Circle, Budget-Monitor, Kontingent-Monitor

Offene Entscheidung O1 (`docs/entscheidungen-v0.1.md`): OData V2 oder V4. Davon haengen Decimal- und Datumsformat (V2: Strings), ETag/optimistisches Sperren, Paginierung (`$top`/`$skip`), `$batch` und das Fehlerformat ab. Der WebClient bekommt erst nach dieser Entscheidung eine Adapterschicht (Audit-Schritt 9).

Authentifizierung: `Authorization: Bearer` mit Entra-ID-Token; Validierung und Mapping `oid`/`preferred_username` auf `EXTNR` im Service, siehe `docs/entra-anbindung.md`.
