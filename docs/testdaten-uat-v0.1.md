# xTS Testdatenpaket und UAT-Drehbuch v0.1

Story: XTS-082 (Epic 9). Das Paket ist die Fixture-Basis der Mock-API (`mock-api/src/fixtures.js`) und wird von den Contract-Tests, den Playwright-Smoke-Tests und dem UAT gemeinsam genutzt. Jeder Durchlauf kann ueber **Verwaltung -> "Testdaten zuruecksetzen"** (oder `POST /odata/TestDataResets`, Rolle `admin`) auf diesen Ausgangsstand zurueckgesetzt werden.

Stichtag der Daten: Fruehjahr 2026. Datumsangaben im Drehbuch beziehen sich darauf, nicht auf das reale Tagesdatum.

## 1. Personas (Dev-Persona-Umschalter oben rechts)

| Persona                       | UPN                                | Entra OID (Claim `oid`)                | EXTNR     | Rollen                         | Zweck                                                                 |
| ----------------------------- | ---------------------------------- | -------------------------------------- | --------- | ------------------------------ | --------------------------------------------------------------------- |
| Stephan Schilz (User)         | `stephan.schilz@qualitytimes.de`   | `3f1c2a7e-5b3d-4c8e-9a1f-0d2e4b6c8a10` | `SCHILZ`  | user                           | Externer Mitarbeiter, schreibt Stunden                                |
| Christian Roeper (PL, RM & A) | `christian.roeper@qualitytimes.de` | `7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42` | `ROEPER`  | user, approver, planner, admin | Planer, Projektleiter/Genehmiger, Verwaltung                          |
| Maria Weber (PL)              | `maria.weber@qualitytimes.de`      | `9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e` | `WEBER`   | user, approver                 | Genehmigerin nur fuer `700000000004` (Vertretung), Sichtbarkeits-Test |
| Petra Altmann (inaktiv)       | `petra.altmann@qualitytimes.de`    | `c2d4e6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f` | `ALTMANN` | user                           | Fehlerfall: inaktiver Mitarbeiter (Zugang gesperrt)                   |
| Neuer Externer (ohne Mapping) | `neu.extern@qualitytimes.de`       | `00000000-0000-4000-8000-000000000099` | –         | –                              | Fehlerfall: OAuth-User ohne EXTNR-Mapping                             |

Das Mapping laeuft ueber die Entra OID (Option B der Entscheidungsvorlage), der UPN ist Fallback. Fall C2 kann in der Verwaltung aufgeloest werden: Mitarbeiter mit der OID des "Neuen Externen" anlegen, danach ist die Persona angemeldet.

## 2. Stammdaten

Teams (`ZXTS_TEAM_T`): `TRANSFORMATION_MC` (Transformation MC), `ENTW_SUPPORT` (Entw.-Support).

Teamzuordnung (`ZXTS_MATEAM_T`): Schilz -> Transformation MC (2026), Roeper -> Entw.-Support (2026–2027), Altmann -> Entw.-Support (2025).

Kontierungen (`ZXTS_KONT_T`):

| Kontierung     | Art | Bezeichnung                          | SAP-CO-Stub |
| -------------- | --- | ------------------------------------ | ----------- |
| `700000000004` | OR  | SAP-Implementierung, Stephan Schilz  | gueltig     |
| `600000000001` | KS  | SAP-Support, Stephan Schilz          | gueltig     |
| `600000000009` | KS  | Altprojekt Migration, Stephan Schilz | gueltig     |

Weitere im SAP-CO-Stub bekannte, aber nicht angelegte Kontierungen (fuer Pflege-Tests): `600000000042` (KS), `700000000010` (PR).

Mitarbeiter-Kontierungen (Planungsbasis):

| Mitarbeiter | Kontierung     | Gueltig von | Gueltig bis |
| ----------- | -------------- | ----------- | ----------- |
| SCHILZ      | `700000000004` | 2026-02-01  | 2027-02-28  |
| SCHILZ      | `600000000001` | 2026-02-01  | 2026-04-30  |
| SCHILZ      | `600000000009` | 2026-01-01  | 2026-03-31  |
| ROEPER      | `600000000001` | 2026-02-01  | 2026-04-30  |

Genehmiger je Kontierung (`ZXTS_KONTGEN_T`, Entscheidung 19): ROEPER fuer `700000000004`, `600000000001` und `600000000009` (2026-01-01 bis 2026-12-31); WEBER als Vertreterin nur fuer `700000000004`. ROEPER ist zusaetzlich `admin` und sieht damit alle Tage; WEBER sieht in Genehmigung und Reporting nur `700000000004`.

Regelwerk (`ZXTS_REGELN_T`): Infotyp 1 = `MA_KONT` aktiv (Beauftragung je Mitarbeiter und Kontierung), Infotyp 2 = `P` aktiv (Freischaltung ab BANF), Infotyp 3 = `5` aktiv (Monatsabschluss: Vormonat erfassbar bis zum 5. des Folgemonats). Die Smoke-Tests laufen mit Systemdatum `XTS_TODAY=2026-05-05`, der erfassbare Zeitraum ist damit 2026-04-01 bis 2026-05-05; ohne dieses Datum sind die Tage des Pakets nach dem 5. Juni 2026 nicht mehr erfassbar.

Werkkalender: 2026-03 = 176 Std., 2026-04 = 168 Std., 2026-05 = 160 Std., sonst 160 Std. Budget-Ampel: gelb ab 80 %, rot ab 95 %.

## 3. Bewegungsdaten

Planung (`ZXTS_MAPLAN_T`):

| Mitarbeiter | Kontierung     | Monat   | Std. | Status |
| ----------- | -------------- | ------- | ---- | ------ |
| SCHILZ      | `700000000004` | 2026-04 | 60   | V      |
| SCHILZ      | `700000000004` | 2026-05 | 80   | V      |
| SCHILZ      | `600000000001` | 2026-03 | 30   | P      |
| ROEPER      | `600000000001` | 2026-04 | 20   | F      |

Bestands-Beauftragungen (`ZXTS_MABEAUF_T`, alle bestellt, daraus abgeleitete Freischaltung):

| Beauftragung | Mitarbeiter | Kontierung     | Zeitraum          | Std. | BANF           | Bestellung       |
| ------------ | ----------- | -------------- | ----------------- | ---- | -------------- | ---------------- |
| BEAUF-9001   | SCHILZ      | `700000000004` | 2026-02 – 2027-02 | 320  | 10009001/00010 | 4500001234/00010 |
| BEAUF-9002   | SCHILZ      | `600000000001` | 2026-02 – 2026-04 | 160  | 10009002/00010 | 4500002001/00010 |
| BEAUF-9003   | SCHILZ      | `600000000009` | 2026-01 – 2026-03 | 80   | 10009003/00010 | 4500002002/00010 |
| BEAUF-9004   | ROEPER      | `600000000001` | 2026-02 – 2026-04 | 100  | 10009004/00010 | 4500002003/00010 |

MM-Bestellungen im Bestelldaten-Job-Stub: nur `700000000004` -> `4500001234`. Eine neue BANF auf `600000000001` liefert im Job bewusst einen Fehlerprotokoll-Eintrag.

Stundenzettel (`E` Entwurf, `F` freigegeben, `G` genehmigt, `A` zurueckgewiesen):

| Mitarbeiter | Datum      | Kontierung     | Std. | Status | Bemerkung                                                                                                                           |
| ----------- | ---------- | -------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| SCHILZ      | 2026-04-13 | `700000000004` | 2    | E      | Standard-Einstiegstag (neuester Tag); Arbeitszeit 8,5 Std. mit Abweichungsbegruendung "Restzeit interne Abstimmung ohne Kontierung" |
| SCHILZ      | 2026-04-10 | `600000000001` | 7.5  | A      | Grund: "Bitte Projektreferenz in der Beschreibung ergaenzen."                                                                       |
| SCHILZ      | 2026-04-09 | `700000000004` | 8    | G      | genehmigt ohne WE-Beleg (Live-Circle: "WE ausstehend")                                                                              |
| SCHILZ      | 2026-04-08 | `700000000004` | 8    | F      | wartet auf Genehmigung                                                                                                              |
| ROEPER      | 2026-04-08 | `600000000001` | 8    | F      | wartet auf Genehmigung                                                                                                              |
| ROEPER      | 2026-03-31 | `600000000001` | 7.5  | F      | wartet auf Genehmigung                                                                                                              |

## 4. UAT-Drehbuch

### Fall A – Durchgehend von Planung bis Genehmigung und Wareneingang

Automatisiert in `frontend/e2e/uat.spec.ts` ("UAT-Fall A").

| Schritt | Persona | Aktion                                                                                                                         | Erwartetes Ergebnis                                                                                                                                           |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0       | Roeper  | Verwaltung -> "Testdaten zuruecksetzen"                                                                                        | Meldung "Testdatenpaket uat-v0.1 zurueckgesetzt"                                                                                                              |
| 1       | Roeper  | Planung: Zelle Schilz / `700000000004` / 05.2026 auf 40 setzen, Tab                                                            | "gespeichert", keine Ueberplanungswarnung (40 < 160)                                                                                                          |
| 2       | Roeper  | Zelle 05.2026 fuer BANF freigeben                                                                                              | Zelle zeigt `40 · F`, Eingabe gesperrt                                                                                                                        |
| 3       | Roeper  | Beauftragung: Kandidat Schilz / `700000000004` (40 Std., 05.2026) -> Beauftragung anlegen                                      | Zeile `BEAUF-000001`, Status "Angelegt", BANF-Positionstext editierbar                                                                                        |
| 4       | Roeper  | BANF anlegen                                                                                                                   | Status "BANF vorhanden", BANF `10000001/00010`; Planung 05.2026 zeigt `40 · P`                                                                                |
| 5       | Roeper  | Bestelldaten-Job ausfuehren                                                                                                    | Status "Bestellung vorhanden", Bestellung `4500001234/00010`; Planung zeigt `40 · B`                                                                          |
| 6       | Schilz  | Stundenschreibung: Tagesdatum 2026-05-05, Kontierung `700000000004`, Position hinzufuegen, 8 Std., "Zur Genehmigung freigeben" | Status "Zur Genehmigung freigegeben"; Kontingent `700000000004` zeigt 360 beauftragt                                                                          |
| 7       | Roeper  | Genehmigung: Tag Schilz 2026-05-05 genehmigen                                                                                  | Meldung "Wareneingang WE-000001", Tag verschwindet aus der Liste                                                                                              |
| 8       | Roeper  | Reporting                                                                                                                      | Live-Circle Schilz / `700000000004`: BEAUF-000001 sichtbar, WE-000001 mit 8 Std.; Budget-Monitor `700000000004`: Budget 360, Verbrauch 16 (8 Bestand + 8 neu) |
| 9       | Schilz  | Stundenschreibung: Tagesdatum 2026-05-05                                                                                       | Status "Genehmigt", Felder gesperrt                                                                                                                           |

### Fall B – Rueckweisung, Korrektur, erneute Rueckweisung

Automatisiert in `frontend/e2e/uat.spec.ts` ("UAT-Fall B").

| Schritt | Persona | Aktion                                                                          | Erwartetes Ergebnis                                                                                                                              |
| ------- | ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0       | Roeper  | Verwaltung -> "Testdaten zuruecksetzen"                                         | Ausgangsstand                                                                                                                                    |
| 1       | Schilz  | Stundenschreibung: Tagesdatum 2026-04-10                                        | Status "Zurueckgewiesen", Banner mit Grund "Bitte Projektreferenz …"                                                                             |
| 2       | Schilz  | Leistungsbeschreibung um Projektreferenz ergaenzen, "Zur Genehmigung freigeben" | Banner verschwindet, Status "Zur Genehmigung freigegeben"                                                                                        |
| 3       | Roeper  | Genehmigung: Tag Schilz 2026-04-10 zurueckweisen ohne Grund                     | Bestaetigen ist gesperrt                                                                                                                         |
| 4       | Roeper  | Grund "UAT: Stundenanzahl bitte pruefen." eingeben und bestaetigen              | Meldung "zurueckgewiesen", Tag verschwindet aus der Liste                                                                                        |
| 5       | Schilz  | Stundenschreibung: Tagesdatum 2026-04-10                                        | Status "Zurueckgewiesen", Banner zeigt den neuen Grund, Tag editierbar                                                                           |
| 6       | Roeper  | Reporting                                                                       | Kontingent-Monitor Schilz / `600000000001`: 7.5 Std. gebucht **nicht** enthalten (A gibt Kontingent frei); Budget-Monitor Verbrauch unveraendert |

### Fall C – Fehlerfaelle (manuell)

| Fall | Persona        | Aktion                                                                                     | Erwartetes Ergebnis                                                                          |
| ---- | -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| C1   | Petra Altmann  | Persona waehlen                                                                            | "Zugang gesperrt" (inaktiver Mitarbeiter)                                                    |
| C2   | Neuer Externer | Persona waehlen                                                                            | "Kein xTS-Zugang", Hinweis auf fehlendes EXTNR-Mapping                                       |
| C3   | Schilz         | Stundenschreibung: Tagesdatum 2026-04-14, Kontierung `600000000009`                        | Kontierung wird als "nicht buchbar" gefuehrt (Gueltigkeit bis 2026-03-31)                    |
| C4   | Roeper         | Planung: Zelle Schilz / `700000000004` / 05.2026 auf 200 setzen                            | Ueberplanungswarnung "200 Std. geplant bei 160 Std. verfuegbar", Speichern erlaubt           |
| C5   | Roeper         | Beauftragung: Kandidat Roeper / `600000000001` beauftragen, BANF anlegen, Bestelldaten-Job | Job meldet 1 Fehler, Fehlerprotokoll "Keine Bestellung zur BANF …"                           |
| C6   | Roeper         | Verwaltung: Infotyp 2 deaktivieren, dann als Schilz freigeben                              | "Kontierung ist fuer diesen Tag nicht freigeschaltet"                                        |
| C7   | Roeper         | Verwaltung: Kontierung `600000000042` als OR anlegen, "SAP CO pruefen"                     | Pruefung nicht bestanden (Stub kennt sie als KS)                                             |
| C8   | Roeper         | Genehmigung: eigene Tage 2026-04-08 und 2026-03-31                                         | Keine Aktionen, Hinweis "Eigener Tag" (Vier-Augen-Prinzip); per API HTTP 403 `SELF_APPROVAL` |

## 5. Abgleich mit den Akzeptanzkriterien XTS-082

- Mindestens zwei Mitarbeiter: Schilz und Roeper (plus Altmann als Fehlerfall).
- Mindestens zwei Kontierungen: SAP-Support (`600000000001`) und SAP-Implementierung (`700000000004`).
- Durchgehender Fall Planung bis Genehmigung: Fall A, automatisiert.
- Rueckweisungsfall: Fall B, automatisiert.

## 6. Grenzen des Pakets

- Bestellpreis, Rechnung und Wertefluss sind nicht enthalten (kein MVP-Umfang).
- Der SAP-CO-Stub kennt nur die oben genannten Kontierungen.
- Das Paket lebt im Speicher der Mock-API; ein Neustart der Mock-API entspricht einem Reset.
