# xTS Entscheidungen v0.1

Stand: 2026-09-12 (Grundsatzentscheidungen 1 bis 10 vom 2026-05-08, Ergaenzungen aus der Stabilisierung im September 2026, Fachentscheidungen 18 und 19 vom 2026-09-09, Entscheidungen 20 und 21 zum UI-Redesign vom 2026-09-12)

Quelle der Antworten: `xTS Offene Entscheidungen v0.docx`, `xTS Entwicklungskonzept v0.docx`, Reviews der Pull Requests #15 bis #26, Entscheidungsrunde O2/O3 vom 2026-09-09

Dieses Dokument enthaelt die fachlich beantworteten Entscheidungen fuer die MVP-Umsetzung. Punkte mit Umsetzungsfolgen sind in `entwicklungskonzept-v0.1.md` und `backlog-v0.1.md` uebernommen.

## Entscheidung 1 - Freischaltung Stundenschreibung

Status: entschieden  
Entscheidung: Steuerung je Kontierung/Projekt ueber `ZXTS_REGELN_T`.

Antwort:

- Die Freischaltung soll individuell steuerbar sein.
- Im ersten Schritt soll die Stundenschreibung moeglich sein, wenn eine BANF vorhanden ist.
- Spaeter soll auf Bestellung vorhanden umgestellt bzw. erweitert werden koennen.

Umsetzungsregel:

- Infotyp `2` in `ZXTS_REGELN_T` steuert die Freischaltung.
- Regelwert `P` bzw. BANF vorhanden ist der MVP-Start.
- Regelwert `B` bzw. Bestellung vorhanden bleibt als spaetere/alternative Steuerung vorgesehen.

## Entscheidung 2 - Genehmigungsebene

Status: entschieden  
Entscheidung: Ein ganzer Arbeitstag wird genehmigt oder zurueckgewiesen.

Umsetzungsregel:

- Der Projektleiter markiert einen Tag.
- Genehmigung setzt alle Positionen dieses Tages auf `G`.
- Zurueckweisung setzt alle Positionen dieses Tages auf `A` und verlangt einen Rueckweisungsgrund.

## Entscheidung 3 - Beauftragungsaggregation

Status: entschieden  
Entscheidung: Keine Aggregation ueber mehrere Mitarbeiter.

Antwort:

- Aggregation erfolgt nur pro Mitarbeiter und Kontierung.
- Mitarbeiter + Kontierung ist der kleinste gemeinsame Nenner einer Bestellposition.
- Die Aggregationslogik soll ueber `ZXTS_REGELN_T` mit Infotyp `1` gesteuert werden.

Umsetzungsregel:

- Eine Beauftragungsposition darf nicht mehrere Mitarbeiter zusammenfassen.
- Zusammenfassung ist innerhalb eines Mitarbeiters nach Kontierung und ggf. Zeitraum erlaubt.

## Entscheidung 4 - Fuehrendes Budget

Status: entschieden  
Entscheidung: Stundenbudget ist fuehrend.

Antwort:

- Fuehrend sind Stundenbudgets.
- Fuer Ampel und Restbudget werden nur Plan-/Beauftragungsstunden beruecksichtigt, die mindestens Status `P` erreicht haben, also BANF erstellt.

Umsetzungsregel:

- Budget-Monitor basiert auf Stunden.
- Datensaetze vor BANF-Erstellung duerfen das Budget nicht als verbindlich verbrauchen.
- Wenn Status `B` den Status `P` technisch ersetzt, gilt `B` als Folgestatus von `P` und muss fuer Budgetbetrachtung mitgezaehlt werden.

## Entscheidung 5 - Prozess nach Genehmigung

Status: entschieden  
Entscheidung: Nach Genehmigung wird Wareneingang zur zugehoerigen Bestellposition gebucht.

Antwort:

- Nach Status `G` der Stundenschreibung soll ein Wareneingang zur zugehoerigen Bestellposition gebucht werden.

Umsetzungsregel:

- Genehmigung `F -> G` triggert fachlich die synchrone WE-Buchung.
- Die angepasste Konzeptfassung sieht dafuer einen ausloesenden Button vor.
- Die technische Umsetzung braucht eine eigene Story fuer Bestellpositionszuordnung, Fehlerfall und Protokollierung.
- Rechnungspruefung, Gutschriftsverfahren und Zahllauf bleiben ausserhalb des MVP.

## Entscheidung 6 - Authentifizierung WebClient

Status: entschieden  
Entscheidung: AD/OAuth-Authentifizierung.

Antwort:

- AD/OAuth wird verwendet, weil auch Kollegen Stunden buchen werden, die keinen SAP-Zugriff haben.

Umsetzungsregel:

- WebClient-Login erfolgt ueber AD/OAuth.
- xTS muss den authentifizierten Benutzer auf `EXTNR` in `ZXTS_WIW_T` mappen.
- SAP-User ist optional, aber nicht Voraussetzung fuer WebClient-Nutzung.

Folgepunkt, entschieden am 2026-09-02: **Option B** (Entra `oid` als `AAD_OID`,
`AAD_UPN` als Fallback), Vorlage in
[entscheidungsvorlage-extnr-mapping.md](entscheidungsvorlage-extnr-mapping.md).
WebClient meldet ueber Entra ID (MSAL) an, die Mock-API mappt
Bearer-Token-Claims; Anleitung und offene SAP-Punkte in
[entra-anbindung.md](entra-anbindung.md).

## Entscheidung 7 - Abwesenheitsmanagement

Status: entschieden  
Entscheidung: Keine Abwesenheiten im xTS-MVP.

Antwort:

- Kein eigenes Abwesenheitsmanagement in xTS aufbauen.
- Ggf. spaeter nachziehen.

Umsetzungsregel:

- Abwesenheit ist nicht Teil des MVP-Datenmodells.
- Planung prueft im MVP nur gegen Werkkalender/Arbeitsstunden, nicht gegen individuelle Abwesenheiten.

## Entscheidung 8 - Korrekturen nach Genehmigung

Status: entschieden  
Entscheidung: Genehmigte Stunden koennen nicht zurueckgesetzt werden.

Antwort:

- Genehmigte Stunden koennen nicht mehr zurueckgesetzt werden.

Umsetzungsregel:

- Status `G` ist final und fuer normale Benutzer/Projektleiter nicht ruecksetzbar.
- Ein spaeterer Korrekturprozess muss separat definiert werden, falls fachlich benoetigt.

## Entscheidung 9 - Beleg- und Wertefluss

Status: entschieden  
Entscheidung: xTS erzeugt MM-BANF aktiv; MM-Bestellung wird nur nachgelesen.

Antwort:

- MM-BANF soll aktiv angelegt werden.
- MM-Bestellung soll nur nachgelesen werden.
- Update der Bestellung erfolgt ueber einen Job.

Umsetzungsregel:

- xTS braucht eine aktive BANF-Anlage.
- xTS darf Bestellung im MVP nicht aktiv erzeugen oder aendern.
- Bestellinformationen werden per Hintergrundjob aktualisiert.
- Wareneingang nach genehmigten Stunden ist ein separater aktiver MM-Schritt nach Status `G`.

## Entscheidung 10 - BANF-Feldmapping

Status: entschieden  
Entscheidung: Die MM-BANF-Anlage nutzt das im Entwicklungskonzept definierte EBAN/EBKN/COBL-Feldmapping.

Kernwerte:

- `EBAN-BSART = ZDB`
- `EBAN-BSTYP = B`
- `EBAN-EKGR = A02`
- `EBAN-MATKL = 93`
- `EBAN-WERKS = 0057`
- `EBAN-BAMEI = H`
- `EBKN-SAKTO = 431100`
- Menge, Beschreibung, Lieferant/Firma und Kontierung kommen aus `ZXTS_MABEAUF_T`, `ZXTS_KONT_T` und `ZXTS_WIW_T`.

Kontierungsarten:

- `OR`: `EBAN-PSTYP = F`, `COBL-AUFNR = ZXTS_MABEAUF_T-KONTIERUNG`
- `KS`: `EBAN-PSTYP = K`, `COBL-KOSTL = ZXTS_MABEAUF_T-KONTIERUNG`
- `PR`: `EBAN-PSTYP = F`, `COBL-PS_POSID = ZXTS_MABEAUF_T-KONTIERUNG`

## Entscheidungen aus der Stabilisierung (September 2026)

Getroffen in den Reviews der Pull Requests #15 bis #22 auf Basis des Audits vom 2026-09-03 (`audit-2026-09-03.md`).

### Entscheidung 11 - Statusmodell serverseitig

Status: entschieden  
Entscheidung: Mitarbeiter setzen nur `E` und `F`; `F` und `G` sind fuer Mitarbeiter gesperrt; `A` ist korrigierbar; Genehmigungsfelder fuehrt der Server.

### Entscheidung 12 - Vier-Augen-Prinzip

Status: entschieden  
Entscheidung: Niemand genehmigt oder weist eigene Tage zurueck (`SELF_APPROVAL`). Folge: Ein Genehmiger braucht selbst einen anderen Genehmiger.

### Entscheidung 13 - Erfassungsraster und Grenzen

Status: entschieden  
Entscheidung: Stunden im Viertelstundenraster, je Position 0,25 bis 24 Stunden, Tagessumme hoechstens 24; Zeiten `HH:MM`, Geht nach Kommt, Pause in ganzen Minuten; Kontingent wird mit der Tagessumme geprueft, Reststunden werden nicht negativ.

### Entscheidung 14 - Arbeitszeit und Abweichung

Status: entschieden  
Entscheidung: Arbeitszeit = Geht - Kommt - Pause, serverseitig berechnet. Weicht die Positionssumme bei der Freigabe ab, ist eine Begruendung Pflicht (Warnung mit Pflichtbegruendung, keine Blockade), Projektleiter sehen Abweichung und Begruendung.

### Entscheidung 15 - Stundenarithmetik

Status: entschieden  
Entscheidung: Rechnen in ganzen Minuten, Anzeige deutsch formatiert (`7,5 Std.`, `13.04.2026`); SAP-seitig `QUAN` mit Rundung auf ganze Minuten zu vereinbaren.

### Entscheidung 16 - Rollenschnitt Stammdaten lesen

Status: entschieden  
Entscheidung: Stammdaten nur angemeldet; Zugangs- und Personaldetails sowie inaktive/geloeschte Saetze nur fuer `admin`; Zuordnungen fuer `admin`/`planner`.

### Entscheidung 17 - SAP OData V2 (Ziel SAP ECC)

Status: entschieden (2026-09-06)

Entscheidung: Zielsystem ist SAP ECC mit klassischem SAP Gateway (SEGW), daher OData V2. Der WebClient bekommt eine Adapterschicht (`frontend/src/app/shared/odata-http.ts`, `decode.ts`, `api-error.ts`), die die Mock-Form und die V2-Form (`d.results`, `Edm.Decimal` als String, `/Date(ms)/`, `Edm.Time`, V2-Fehlerobjekt, `__next`) gleichermassen versteht und jede Antwort zur Laufzeit gegen den Kontrakt prueft. Die Mock-API liefert mit `XTS_ODATA=v2` die V2-Form; beide Formen laufen in CI durch die Smoke-Tests. Abbildungsregeln: `docs/odata-contracts.md`, Abschnitt "Antwortformen".

Folgepunkte (mit dem ersten echten Gateway-Service): CSRF-Token-Handshake (`x-csrf-token: fetch` vor `POST`), ETag/`If-Match` fuer optimistisches Sperren, Abbildung der benannten Filterparameter (`?month=`, `?extNr=`, `?from=`/`?to=`) auf `$filter` oder Funktionsimporte; `$batch` wird nicht benoetigt. Der Zeitraum fuer `MyTimesheets` (Audit Nr. 16) ist als Schritt 9b umgesetzt: Standardtag heute, Ladefenster Vormonat bis Folgemonat, `from`/`to` im Kontrakt.

### Entscheidung 18 - Datumsregeln Stundenerfassung (O2)

Status: entschieden (2026-09-09, Fachbereich)

Entscheidung:

- Rueckwirkend erfassbar sind der laufende Monat und der Vormonat. Der Vormonat ist bis einschliesslich zum 5. Kalendertag des Folgemonats erfassbar (Monatsabschluss), danach gesperrt. Die Frist ist ein Regelwert im Regelwerk (`ZXTS_REGELN_T`, neuer Infotyp `3` "Monatsabschluss", Standard `5`), den nur der Admin aendert; Aenderungen stehen im Audit-Log.
- Zukunft ist gesperrt, auch fuer Entwuerfe. Stunden sind Ist-Werte, die Zukunft deckt die Planung ab.
- Wochenende und Feiertag sind erlaubt; der WebClient zeigt an Wochenenden einen Hinweis. Keine Feiertagstabelle im MVP.
- Zeitraum und Zukunft werden serverseitig hart gesperrt: HTTP 400 `DATE_OUT_OF_RANGE` mit Meldung, fuer Speichern und Freigeben. Der WebClient prueft dieselbe Regel vor dem Senden (`validateTimesheetDay`). Wochenende ist nur eine Warnung.
- Kein Einzel-Override je Tag oder Mitarbeiter; Sonderfaelle loest der Admin ueber eine temporaere Verlaengerung der Frist im Regelwerk. Ressourcenmanager erhalten keine Sonderrechte.

Folgen: Audit Nr. 17 wird damit umsetzbar (Backlog XTS-056). Genehmigung und Rueckweisung sind von der Regel nicht betroffen; ein zurueckgewiesener Tag ausserhalb des Zeitraums kann erst nach Fristverlaengerung korrigiert werden.

### Entscheidung 19 - Zustaendigkeit der Genehmiger (O3)

Status: entschieden (2026-09-09, Fachbereich / Projektleitung)

Entscheidung:

- Grundlage ist die Kontierung, nicht das Team: eine eigene Zuordnungstabelle Kontierung zu Genehmiger (`ZXTS_KONTGEN_T`: `COIDENT`, `EXTNR` des Genehmigers, `VERTRETER`-Kennzeichen, `GUELTIG_VON`/`GUELTIG_BIS`), gepflegt vom Admin in der Verwaltung (Backlog XTS-014). Der Genehmiger braucht weiterhin die Rolle `approver`.
- Sichtbarkeit: Ein Genehmiger sieht in der Genehmigung nur freigegebene Tage, die mindestens eine Position auf einer seiner Kontierungen enthalten. Ohne Zuordnung ist die Liste leer, mit Hinweis. `admin` sieht alles.
- Genehmigung bleibt im MVP auf Tagesebene. Ein Genehmiger darf den ganzen Tag genehmigen oder zurueckweisen, wenn der Tag mindestens eine Position auf einer seiner Kontierungen enthaelt. Der Screen zeigt dabei alle Positionen des Tages sichtbar, damit bewusst ist, dass die Tagesfreigabe gesamthaft wirkt. Dieser MVP-Kompromiss ist als spaetere Ausbaustufe "positionsweise Genehmigung" dokumentiert und wird jetzt nicht umgesetzt. Die Alternative "Genehmiger muss fuer alle Kontierungen des Tages zustaendig sein" wurde verworfen, weil sie gemischte Arbeitstage blockiert und praktisch ein Teilfreigabe-Modell erzwingt.
- Vertretung: Stellvertreter stehen in derselben Tabelle mit gleichen Rechten. Das Vier-Augen-Prinzip (Entscheidung 12) bleibt absolut: eigene Tage nie, auch nicht als Vertreter.
- Reporting: Budget-Monitor, Kontingent-Monitor und Ressourcen-Live-Circle werden fuer Genehmiger auf dieselben Kontierungen geschnitten. Eine Rolle Controlling sieht alles; im Mock als neue Rolle `controller`, bis dahin `admin`. Planer bleiben unveraendert.

Folgen: Audit Nr. 33 wird damit umsetzbar (Backlog XTS-014, XTS-063). Ausbaustufe "positionsweise Genehmigung" ist im Backlog als P2 vermerkt.

### Entscheidung 20 - UI-Redesign schrittweise beauftragen (O8)

Status: entschieden (2026-09-12, PO)

Entscheidung:

- Das Redesign "Modernist" (`ui-redesign-bewertung.md`) ist grundsaetzlich vorgesehen. Zur Umsetzung freigegeben ist zunaechst nur XTS-140, die verbindliche Design-Baseline mit Funktionsabgleich. Keine Zusatzfunktionen und kein Oberflaechenumbau vor der Abnahme der Baseline.
- Was die Baseline liefert: ein Repo-Dokument mit Checkliste je Screen, das fuer jede Story in Epic 16 die zu erhaltenden Zustaende, Filter, Fehlerpfade und Test-IDs benennt, dazu die Festlegungen zu Breiten, Kontrast und Schrift. Die Abnahme jeder spaeteren Story ist ein Abgleich gegen diese Liste, nicht gegen einen Eindruck.
- Was nach der Abnahme folgt: XTS-141, XTS-142 und XTS-150 als erste Etappe, jede Story als eigener PR mit gruenen Fach- und E2E-Tests. Weitere Stories nur nach Abnahme der jeweils vorherigen Etappe; es gibt keine Pauschalfreigabe fuer Epic 16.
- Kopplung an Audit-Schritt 15 Teil B: Die Verwaltungszerlegung (Befunde 31, 32) wird ausschliesslich mit XTS-154 geplant. Wird das Redesign nach der Baseline nicht fortgesetzt, wird Teil B als eigener Stabilisierungs-PR wieder aufgenommen; die uebrigen Teil-B-Befunde bleiben im Audit nachvollziehbar.
- O10 (schmale Navigation) und O11 (Schriftbereitstellung) arbeitet die Baseline als Vorschlag aus; beide bleiben bis zur Abnahme der Baseline offen und werden mit ihr entschieden.

Folgen: XTS-140 ist freigegeben (Backlog, Jira XTS-89). XTS-141, XTS-142 und XTS-150 sind die vorgeschlagene erste Etappe, nicht freigegeben. O4 (WE-Bestellposition) wird getrennt mit SAP-MM und Einkauf geklaert und ist keine Voraussetzung fuer die Baseline.

### Entscheidung 21 - Navigation auf schmalen Breiten und Schriftbereitstellung (O10, O11)

Status: entschieden (2026-09-12, mit Abnahme der Design-Baseline XTS-140, PR #35)

Entscheidung:

- O10: Ab 1024 px feste Seitenleiste. Unter 1024 px ist die Navigation ein ueberlagerndes, modales Menue, das Inhalte nicht verschiebt: Hintergrund waehrenddessen nicht bedienbar (`inert` oder eine gleichwertige vollstaendige Interaktionssperre; `aria-hidden` allein reicht nicht), Fokus bleibt im Menue, geschlossen keine erreichbaren Menueelemente, Escape schliesst, das Menue schliesst nach erfolgreicher Navigation, der Fokus kehrt zur Schaltflaeche zurueck. Abnahme per E2E gemaess Baseline Abschnitt 4.
- O11: Archivo wird lokal gehostet (`frontend/src/assets/fonts`, `@font-face`, `font-display: swap`) mit Fallback `system-ui, sans-serif`; kein Abruf von Google Fonts zur Laufzeit; die OFL-Lizenz wird im Repo mitgeliefert.

Folgen: Umsetzung in XTS-142 (O10) und XTS-141 (O11), sobald die erste Etappe nach Entscheidung 20 ausdruecklich freigegeben ist. Bis dahin bleiben XTS-141, XTS-142 und XTS-150 ungestartet.

## Offene Entscheidungen

| Nr. | Thema                                                                                                                                  | Bezug                                    | Wer                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| O1  | Entschieden am 2026-09-06: SAP OData V2, Zielsystem SAP ECC (siehe Entscheidung 17)                                                    | Audit Nr. 13, 16; Schritt 9              | erledigt                              |
| O2  | Entschieden am 2026-09-09: laufender Monat plus Vormonat bis Tag 5, Zukunft gesperrt (Entscheidung 18)                                 | Audit Nr. 17                             | erledigt                              |
| O3  | Entschieden am 2026-09-09: Zustaendigkeit je Kontierung, Tagesfreigabe gesamthaft (Entscheidung 19)                                    | Audit Nr. 33, Konzept §4                 | erledigt                              |
| O4  | Bestellpositionsbezug und Fehlerfall der WE-Buchung, Wiederholung                                                                      | XTS-061A, Audit Nr. 34                   | SAP-MM / Einkauf                      |
| O5  | Ueberplanung: Warnung (heute) oder Blockade                                                                                            | XTS-022                                  | Ressourcenmanagement                  |
| O6  | Rollen aus AD-Gruppen statt Stammdaten; Pflegeprozess `AAD_OID`/`AAD_UPN` beim Onboarding                                              | XTS-050/080, `entra-anbindung.md`        | IT / xTS-Administration               |
| O7  | Status `L` (geloescht) fuer Stundenzettel und Planung                                                                                  | Konzept §6                               | Fachbereich                           |
| O8  | Entschieden am 2026-09-12: Redesign schrittweise, zunaechst nur XTS-140 freigegeben (Entscheidung 20)                                  | `ui-redesign-bewertung.md`, Epic 15/16   | erledigt                              |
| O9  | BANF-Ausloesung: manuelle Anlage (heute) oder Automatik-Job                                                                            | XTS-032, Epic 4                          | Ressourcenmanagement, Einkauf, SAP-MM |
| O10 | Entschieden am 2026-09-12 mit Abnahme der Baseline (Entscheidung 21): ueberlagerndes modales Menue unter 1024 px                       | `design-baseline-xts-140.md` Abschnitt 4 | erledigt                              |
| O11 | Entschieden am 2026-09-12 mit Abnahme der Baseline (Entscheidung 21): Archivo lokal mit Fallback, `font-display: swap`, Lizenz im Repo | `design-baseline-xts-140.md` Abschnitt 4 | erledigt                              |
| O12 | Planungsruecknahme F/P/B nach V: ob und unter welchen Bedingungen (Belegbezug, Rechte, Audit, SAP-Folgen)                              | XTS-021, XTS-023, Epic 3/4               | Fachbereich, Einkauf, SAP             |
