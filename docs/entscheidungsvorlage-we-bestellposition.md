# Entscheidungsvorlage: Bestellpositionsbezug, Fehlerfall und Wiederholung der WE-Buchung (O4, XTS-061A)

Stand: 2026-09-19  
Status: **offen, keine Fachentscheidung getroffen.** Diese Vorlage beschreibt Ist-Stand, Optionen und Empfehlungen; alle Kontraktaenderungen in Abschnitt 5 sind **Vorschlaege** und werden erst nach fachlicher Bestaetigung durch SAP-MM und Einkauf umgesetzt. Bis dahin bleibt O4 offen und der Code unveraendert.  
Bezug: offene Entscheidung O4 in `entscheidungen-v0.1.md`, Audit-Befund 34 in `audit-2026-09-03.md`, Story XTS-061A in `backlog-v0.1.md`, Entscheidung 9 (Beleg- und Wertefluss), Konzept §5.6, §10, §11.3 (`Z_XTS_RETRY_GR`) und §16 Nr. 1 und 4.

## Fragestellung

Nach Genehmigung eines Arbeitstages (Status `G`) soll xTS synchron einen
Wareneingang (WE) zur zugehoerigen MM-Bestellposition buchen (Konzept §5.6,
Entscheidung 9). Offen ist, wie die Bestellposition eindeutig ermittelt wird,
was bei Fehlern und Teilerfolgen mit dem Tagesstatus geschieht und wie eine
Wiederholung ohne Doppelbuchung funktioniert, auch nach einem Timeout mit
unbekanntem SAP-Ergebnis. Der Mock simuliert heute nur einen laufenden Zaehler
ohne Bestellpositionsbezug (Audit-Befund 34).

Jeder der fuenf Abschnitte nennt Optionen, eine Empfehlung, die offene Frage
und die zustaendigen Entscheider. Die Empfehlungen sind aufeinander abgestimmt
(siehe Zusammenfassung), lassen sich aber einzeln anders entscheiden.

## 1. Ist-Stand im Mock und Abgrenzung zur echten SAP-WE-Buchung

### Ist-Stand Mock-API und WebClient

- `POST /odata/TimesheetApprovals` mit `action: "approve"` (`mock-api/src/routes.js`, Abschnitt Genehmigung): prueft Status `F`, Vier-Augen-Prinzip, Zustaendigkeit (Entscheidung 19) und `TIMESHEET_EMPTY`; setzt dann `status = "G"`, `approvedBy`, `approvedAt` und vergibt `weDocument = "WE-000001"` aus einem prozessweiten Zaehler `weDocumentCounter`. Der Zaehler startet bei jedem Testdaten-Reset wieder bei 0.
- Es gibt **keinen** Bezug zur Bestellposition (`EBELN`/`EBELP` der Beauftragung), keine Menge, keinen Fehlerfall, keine Wiederholung. Ein Tag mit Positionen auf mehreren Kontierungen erhaelt trotzdem genau einen `weDocument`-Wert.
- Audit-Log: Statuswechsel `F -> G` mit `details.weDocument`.
- Reporting (`mock-api/src/lifecycle.js`, `GET /odata/ResourceLifecycle`): genehmigte Tage **mit** `weDocument` zaehlen in `goodsReceiptHours`/`goodsReceipts`, genehmigte Tage **ohne** `weDocument` in `pendingGoodsReceiptHours` ("WE ausstehend"). Damit kennt das Reporting den Zustand "genehmigt, WE offen" bereits, nur entsteht er im Mock nie durch die Genehmigung selbst.
- Fixture: SCHILZ 2026-04-09, Kontierung `700000000004`, 8 Std., Status `G` **ohne** `weDocument` (`testdaten-uat-v0.1.md`, "genehmigt ohne WE-Beleg"). Der Tag ist der einzige Fall fuer "WE ausstehend" und wird nirgends als Fehlerfall gefuehrt oder wiederholt (Audit 34).
- WebClient: `approval.component.ts` zeigt nach Erfolg "Tag ... genehmigt, Wareneingang WE-000001 gebucht."; `uat.spec.ts` und `approval.spec.ts` erwarten diesen Text (UAT Fall A, Schritt 7). Einen Zustand "genehmigt, WE fehlgeschlagen" kennt der Client nicht.
- Daten fuer die Zuordnung sind vorhanden: `ZXTS_MABEAUF_T`-Simulation (`orders` mit `extNr`, `coIdent`, `periodFrom`/`periodTo`, `hours`, `status`, `banfNumber`/`banfItem`, `ebeln`/`ebelp`); der Bestelldaten-Job (`POST /odata/PurchaseOrderSyncRuns`) schreibt `EBELN`/`EBELP` aus der Fixture `purchaseOrders` zurueck (je Kontierung eine Bestellung, Position immer `00010`).

### Abgrenzung zur echten SAP-WE-Buchung

| Aspekt          | Mock heute                             | SAP (Zielbild, zu bestaetigen)                                                                                                                            |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beleg           | Zaehler `WE-nnnnnn`                    | Materialbeleg `MBLNR`/`MJAHR` (Bewegungsart 101 zur Bestellposition) oder Leistungserfassungsblatt (`LBLNI`) mit Abnahme, siehe Optionen                  |
| Bezug           | keiner                                 | `EBELN`/`EBELP` aus `ZXTS_MABEAUF_T`, Menge in Stunden (`BAMEI = H`, Entscheidung 10)                                                                     |
| Menge           | keine                                  | Summe der Tagespositionen je Kontierung; Restmenge der Bestellposition wird von MM geprueft (Fehler bei Ueberschreitung, je nach Ueberlieferungstoleranz) |
| Fehler          | nicht moeglich                         | fachlich (keine/uneindeutige Position, Restmenge, gesperrte Bestellung, Periode) und technisch (RFC-/HTTP-Fehler, Timeout)                                |
| Idempotenz      | nicht noetig                           | zwingend: Wiederholung darf keinen zweiten Materialbeleg erzeugen                                                                                         |
| Zeitpunkt       | synchron im Genehmigungsaufruf         | synchron ueber den ausloesenden Button (Konzept §16 Nr. 1), Ergebnis kann aber ausstehen                                                                  |
| Rueckabwicklung | keine (`G` ist final, Entscheidung 11) | Storno per Bewegungsart 102 nur als manueller Einkaufsprozess; xTS storniert im MVP nicht                                                                 |
| Berechtigung    | Rolle `approver`                       | technischer Benutzer des OData-Services bucht in MM; der Genehmiger braucht keine MM-Berechtigung                                                         |

### Optionen fuer den SAP-Buchungsmechanismus

| Kriterium           | A: Wareneingang 101 auf Bestellposition (Menge in Stunden)                             | B: Leistungserfassungsblatt (LERB) mit Abnahme                                     | C: Kein automatischer WE, xTS protokolliert nur  |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Voraussetzung       | Bestellposition als Standardposition mit Mengeneinheit `H` (passt zu `EBAN-BAMEI = H`) | Bestellposition als Dienstleistungsposition (`PSTYP = D`) mit Leistungsverzeichnis | keine                                            |
| Schnittstelle       | `BAPI_GOODSMVT_CREATE` (GM_CODE 01, BWART 101) oder OData-Aequivalent                  | `BAPI_ENTRYSHEET_CREATE` + Abnahme; WE entsteht durch die Abnahme                  | keine                                            |
| Aufwand SAP         | gering, Standardfall                                                                   | mittel, zusaetzlicher Beleg und Abnahmeprozess                                     | keiner                                           |
| Passung zum Konzept | hoch (Entscheidung 9/10: BANF mit Menge `H`)                                           | nur, wenn Einkauf Dienstleistungspositionen vorschreibt                            | widerspricht §5.6 und XTS-061A                   |
| Risiko              | Ueberlieferungstoleranz und Restmenge muessen definiert sein                           | Leistungsverzeichnis muss zur BANF-Anlage passen (Entscheidung 10 kennt keines)    | Wertefluss haengt an manueller Arbeit im Einkauf |

**Empfehlung:** Option A, sofern der Einkauf die Bestellpositionen aus den xTS-BANFen als Standardpositionen mit Mengeneinheit `H` fuehrt (so wie Entscheidung 10 die BANF definiert). Option B nur, wenn der Einkauf fuer externe Dienstleistungen zwingend Leistungserfassungsblaetter verlangt; dann muss Entscheidung 10 um das Leistungsverzeichnis ergaenzt werden. Option C ist keine Loesung fuer XTS-061A und nur als Uebergangsbetrieb denkbar.

**Offene Frage:** Welchen Positionstyp erhalten die aus xTS-BANFen entstehenden Bestellungen (Standard mit ME `H` oder Dienstleistung), und welche Ueberlieferungstoleranz gilt?  
**Entscheider:** SAP-MM (Buchungsmechanismus, BAPI, Toleranzen), Einkauf (Positionstyp der Bestellungen).

## 2. Eindeutige Zuordnung zur Bestellposition

### Sachlage

- Die Freischaltung (`ZXTS_MAZUKONT_T`, `mock-api/src/enablement.js`) aggregiert **mehrere** Beauftragungen je Mitarbeiter und Kontierung (Regel Infotyp 1, `MA_KONT`): beauftragte Stunden werden summiert, der Zeitraum ist die Huelle aller Beauftragungen. Eine Leistungsposition kennt nur `EXTNR`, `TAGESDATUM`, `CO_IDENT` und Stunden, **keine** Beauftragung.
- Damit kann ein Tag auf mehrere Bestellpositionen passen, sobald es je Mitarbeiter und Kontierung mehr als eine bestellte Beauftragung gibt, deren Laufzeit das Tagesdatum einschliesst (Aufstockung mitten im Zeitraum, Folgebeauftragung mit Ueberlappung, Wiederbeauftragung nach Pause). In den Fixtures gibt es genau eine Bestellung je Kombination; real ist das nicht garantiert.
- Ein Tag kann Positionen auf mehreren Kontierungen haben (UAT-Fall: Tag mit `700000000004` und `600000000001`). Jede Kontierung fuehrt zu einer eigenen Bestellposition, also zu einer eigenen WE-Buchung.
- Mit Regel Infotyp 2 = `P` (heute aktiv) ist die Stundenschreibung ab BANF freigeschaltet, **bevor** eine Bestellung existiert. Zum Genehmigungszeitpunkt kann `EBELN`/`EBELP` also fehlen, obwohl fachlich alles korrekt ist. Das ist kein Fehler der Zuordnung, sondern ein zeitlicher Zustand (siehe Abschnitt 3).

### Optionen fuer die Ermittlung

| Kriterium              | A: Genau eine Beauftragung je Mitarbeiter, Kontierung und Tagesdatum (Ueberlappung fachlich verboten)                                                                                                                       | B: Mehrere zulaessig, Auswahl nach Regel (aelteste Bestellposition mit Restmenge zuerst, FIFO) | C: Uneindeutigkeit blockiert; Zuordnung manuell durch Einkauf/Admin |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Determinismus          | vollstaendig; Zuordnung = die eine bestellte Beauftragung, deren Laufzeit das Tagesdatum enthaelt                                                                                                                           | deterministisch, aber abhaengig von Restmengen, die MM fuehrt (Abfrage vor Buchung noetig)     | nicht automatisch                                                   |
| Aenderung Beauftragung | neue Validierung bei Anlage: ueberlappende Laufzeit je Mitarbeiter und Kontierung wird abgewiesen (`ORDER_PERIOD_OVERLAP`); Aufstockung = Mengenaenderung der bestehenden Position oder Folgebeauftragung ohne Ueberlappung | keine                                                                                          | keine                                                               |
| Aufwand                | gering (eine Validierung, eine Ableitung)                                                                                                                                                                                   | mittel (Restmengenfuehrung je Bestellposition, Split eines Tages auf zwei Positionen moeglich) | gering im Code, hoch im Betrieb                                     |
| Risiko                 | Aufstockungen mitten im Monat brauchen einen Einkaufsprozess (Positionsmenge erhoehen)                                                                                                                                      | Split-Buchungen erschweren Nachvollziehbarkeit; Reihenfolge muss dokumentiert sein             | Genehmigung haengt an manueller Arbeit                              |

### Granularitaet der WE-Buchung

| Option                        | Bewertung                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Je Tag und Kontierung (Summe) | **empfohlen**: eine WE-Buchung je Kontierung des Tages mit der Summe der Positionen dieser Kontierung; entspricht der Bestellposition (Stunden je Kontierung) |
| Je Leistungsposition          | mehr Belege ohne fachlichen Mehrwert; Beschreibungstexte gehoeren nicht in den Materialbeleg                                                                  |
| Je Tag gesamt (ein Beleg)     | nicht moeglich, sobald der Tag mehrere Kontierungen und damit mehrere Bestellpositionen hat                                                                   |

**Empfehlung:** Option A mit Granularitaet je Tag und Kontierung. Die Zuordnung ist dann eine reine Ableitung aus `ZXTS_MABEAUF_T`: bestellte Beauftragung (`STATUS = bestellt`, `EBELN`/`EBELP` gefuellt) mit `EXTNR`, `CO_IDENT` und `BEGINN_DATUM <= TAGESDATUM <= ENDE_DATUM`. Ergebnisse: genau eine Position (buchen), keine Position (WE offen, Abschnitt 3), mehrere Positionen (nur moeglich bei Altdaten, dann Fehler `PURCHASE_ORDER_AMBIGUOUS` statt Raten). Option B bleibt als Ausbaustufe, falls der Einkauf Aufstockungen grundsaetzlich als neue Bestellposition mit ueberlappender Laufzeit abbildet.

**Offene Fragen:** Wie bildet der Einkauf Aufstockungen ab (Menge der bestehenden Position erhoehen oder neue Position)? Darf xTS ueberlappende Beauftragungen je Mitarbeiter und Kontierung abweisen? Muss die Bestellposition zusaetzlich zur Laufzeit auf Restmenge geprueft werden, bevor gebucht wird (sonst Fehler aus MM)?  
**Entscheider:** Einkauf (Bestellstruktur, Aufstockung), SAP-MM (Restmengenpruefung), Ressourcenmanagement (Beauftragungsregel).

## 3. Verhalten bei Fehlern und Teilerfolgen: Wann darf der Tag auf `G` wechseln?

### Sachlage

- Ein Tag mit n Kontierungen loest n WE-Buchungen aus; jede kann einzeln scheitern (keine Bestellung, Restmenge, MM-Sperre, technischer Fehler). Teilerfolge sind damit der Normalfall, nicht die Ausnahme.
- `G` ist final und wird im MVP nicht zurueckgesetzt (Entscheidung 11, Konzept §10). Ein Storno gebuchter WE (Bewegungsart 102) ist ein Einkaufsprozess und im MVP nicht Teil von xTS.
- Mit Regel `P` (Stundenschreibung ab BANF) gibt es zwangslaeufig freigegebene Tage, deren Bestellung noch nicht existiert. Wuerde die WE-Buchung Vorbedingung fuer `G`, bliebe die Genehmigung bis zur Bestellung blockiert und das Kontingent des Mitarbeiters weiter in `F` gebunden.

### Optionen

| Kriterium                                 | A: `G` nur bei vollstaendigem WE-Erfolg (atomar)                                | B: `G` fachlich sofort, WE-Status je Kontierung getrennt (offen / gebucht / fehlgeschlagen / unklar), Wiederholung per Job und Knopf | C: Separater WE-Knopf nach Genehmigung (Konzept §16 Nr. 4) |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Tag bei Fehler                            | bleibt `F`, Genehmiger sieht Fehler, kann nichts tun ausser warten              | wird `G`; Reporting zeigt "WE ausstehend" bzw. "WE fehlgeschlagen" (heute schon `pendingGoodsReceiptHours`)                          | wird `G`; WE haengt an einem zweiten manuellen Schritt     |
| Teilerfolg                                | erfordert Storno der bereits gebuchten Kontierungen oder inkonsistenten Zustand | zulaessig: gebuchte bleiben gebucht, fehlende werden wiederholt                                                                      | wie B, aber manuell                                        |
| Regel `P`                                 | Genehmigung bis Bestellung blockiert (fachlich nicht gewollt)                   | funktioniert: WE offen bis der Bestelldaten-Job `EBELN`/`EBELP` liefert, dann Wiederholung                                           | funktioniert                                               |
| Vier-Augen und Finalitaet                 | unveraendert                                                                    | unveraendert; `G` bleibt Entscheidung des Projektleiters                                                                             | unveraendert                                               |
| Konzept §16 Nr. 1 (synchron ueber Button) | erfuellt                                                                        | erfuellt: der Genehmigen-Knopf loest den synchronen Versuch aus, das Ergebnis ist aber keine Vorbedingung                            | nur mit zweitem Knopf                                      |
| Aufwand                                   | gering im Code, hoch im Prozess (Storno)                                        | mittel: WE-Status je Kontierung, Referenztabelle, Job, Sichtbarkeit                                                                  | mittel, zusaetzliche Bedienung                             |

**Empfehlung:** Option B. Die Genehmigung ist die fachliche Entscheidung des Projektleiters ueber die Stunden; die WE-Buchung ist der technische Folgeschritt im Wertefluss. Der Genehmigen-Knopf bleibt der einzige Ausloeser und versucht die Buchung synchron; scheitert sie oder fehlt die Bestellung, wechselt der Tag trotzdem auf `G`, und der WE-Auftrag bleibt je Kontierung offen bzw. fehlgeschlagen. Ein Job (`Z_XTS_RETRY_GR`, Konzept §11.3) und ein Knopf fuer Einkauf/Administration wiederholen. Der Genehmiger sieht das Ergebnis je Kontierung in der Meldung ("Wareneingang gebucht" / "Wareneingang ausstehend, Bestellung fehlt" / "Wareneingang fehlgeschlagen: ..."). Ein Tag darf also auf `G` wechseln, sobald die fachlichen Pruefungen (Status `F`, Vier-Augen, Zustaendigkeit, Stunden vorhanden) bestanden sind; der WE-Erfolg ist keine Bedingung.

Konsequenz fuer XTS-061A: "blockiert oder markiert" wird zu "markiert und wiederholt"; die Blockade bleibt nur fuer die fachlichen Pruefungen der Genehmigung selbst.

**Offene Fragen:** Akzeptiert der Einkauf genehmigte Tage, deren WE laengere Zeit offen bleibt (Obligo, Periodenabschluss)? Gibt es eine Frist, nach der ein offener WE eskaliert wird, und an wen? Wer bearbeitet dauerhaft fehlgeschlagene WE (Einkauf, xTS-Administration)? Soll der Genehmiger vor der Genehmigung sehen, ob eine Bestellung existiert?  
**Entscheider:** Einkauf (Verbindlichkeit und Fristen des WE), SAP-MM (Periodensteuerung), Projektleitung/Fachbereich (Sichtbarkeit fuer Genehmiger).

## 4. Wiederholung ohne Doppelbuchung, auch nach Timeout mit unbekanntem Ergebnis

### Sachlage

Ein synchroner Aufruf kann mit Timeout enden, obwohl SAP den Materialbeleg
gebucht hat. Eine naive Wiederholung erzeugt dann einen zweiten Beleg und
doppelte Wareneingangsmenge. Auch Doppelklicks und parallele Aufrufe muessen
abgefangen werden (fuer den Genehmigungsaufruf selbst greift heute `409
TIMESHEET_NOT_SUBMITTED` beim zweiten Aufruf, weil der Tag schon `G` ist).

### Optionen

| Kriterium     | A: Idempotenzschluessel im Beleg plus Abfrage vor Wiederholung                                                                                                                                                                                                                | B: Zustand "unklar" mit manueller Klaerung, kein automatischer Retry                                              | C: Bei Unklarheit stornieren und neu buchen      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Prinzip       | xTS vergibt je WE-Auftrag (Mitarbeiter, Tagesdatum, Kontierung) einen Referenzschluessel und schreibt ihn in den Materialbeleg (z. B. `MKPF-XBLNR`, 16 Zeichen); vor jeder Wiederholung fragt xTS nach einem Beleg mit dieser Referenz und uebernimmt ihn statt neu zu buchen | Timeout setzt den WE-Auftrag auf "unklar"; Einkauf prueft in MM und setzt manuell "gebucht" oder "fehlgeschlagen" | nach Timeout Storno-Versuch und Neubuchung       |
| Doppelbuchung | ausgeschlossen, solange die Referenz eindeutig und abfragbar ist                                                                                                                                                                                                              | ausgeschlossen, aber jeder Timeout wird Handarbeit                                                                | Storno kann selbst scheitern; erzeugt Belegpaare |
| Aufwand       | mittel: Referenzfeld, Abfrage (z. B. Lesen `MKPF`/`MSEG` nach `XBLNR` oder eigener Z-Tabelle), Zustandsautomat                                                                                                                                                                | gering im Code                                                                                                    | hoch, riskant                                    |
| Betrieb       | automatisch, Eskalation nur bei wiederholtem Fehler                                                                                                                                                                                                                           | manuell                                                                                                           | ungeeignet                                       |

### Vorgeschlagener Zustandsautomat je WE-Auftrag (Option A)

`offen` (keine Bestellposition oder noch nicht versucht) -> `in Arbeit` (Aufruf laeuft, sperrt parallele Versuche) -> `gebucht` (Materialbeleg bekannt) | `fehlgeschlagen` (fachlicher oder technischer Fehler mit Meldung, wiederholbar) | `unklar` (Timeout ohne Antwort). Wiederholung (`Z_XTS_RETRY_GR` und Knopf) verarbeitet `offen`, `fehlgeschlagen` und `unklar`; bei `unklar` beginnt sie immer mit der Abfrage nach dem Referenzschluessel. Versuche werden gezaehlt; ab einer Obergrenze (Vorschlag: 5) wird nicht mehr automatisch wiederholt, sondern im Fehlerprotokoll eskaliert. `gebucht` ist final; ein Storno bleibt Einkaufsprozess ausserhalb xTS.

Referenztabelle (Vorschlag, SAP-seitig `ZXTS_WE_T`, im Mock `goodsReceipts`): `ID`, `EXTNR`, `TAGESDATUM`, `CO_IDENT`, `EBELN`, `EBELP`, `MENGE_STD`, `REF_KEY`, `WE_STATUS`, `MBLNR`/`MJAHR`, `VERSUCHE`, `LETZTER_FEHLER`, `LETZTER_VERSUCH`, Aenderungsstempel. Damit erfuellt XTS-061A die Anforderung "am genehmigten Tag oder in einer technischen Referenztabelle protokolliert".

**Empfehlung:** Option A mit dem Zustandsautomaten. Der Referenzschluessel ist aus Mitarbeiter, Tagesdatum und Kontierung ableitbar (z. B. `XTS-<ID der Referenzzeile>`), damit auch ein Neuaufbau der Tabelle die Belege wiederfindet.

**Offene Fragen:** Welches Belegfeld traegt den Referenzschluessel verlaesslich (`XBLNR` im Kopf, `SGTXT` in der Position, oder eine eigene Z-Tabelle mit Belegnummer)? Darf der OData-Service Materialbelege nach Referenz lesen (Berechtigung, Performance)? Welche Timeout-Grenze gilt fuer den synchronen Aufruf aus dem WebClient, und wie werden Belege behandelt, die nach der Abfrage noch verbucht werden (Commit-Verzoegerung)? Wie laeuft ein Storno, wenn eine WE-Buchung fachlich falsch war?  
**Entscheider:** SAP-MM (Referenzfeld, Abfrage, BAPI-Verhalten bei Timeout), SAP-Basis (Timeouts), Einkauf (Storno-Prozess).

## 5. Vorgeschlagene Kontraktaenderungen, Auswirkungen auf bestehende Daten, Abnahmefaelle

Alles in diesem Abschnitt ist **Vorschlag** und setzt die Empfehlungen aus 1 bis 4 voraus (Option A Buchung, Option A Zuordnung je Tag und Kontierung, Option B Statusverhalten, Option A Idempotenz). Bei anderer Entscheidung aendern sich die Vorschlaege entsprechend; umgesetzt wird erst nach Bestaetigung, als eigener Zuschnitt zu XTS-061A.

### 5.1 Kontraktaenderungen (Vorschlag, `odata-contracts.md`)

| Endpunkt                                     | Vorschlag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /odata/TimesheetApprovals` (`approve`) | Antwort um `goodsReceipts: [{ coIdent, hours, ebeln, ebelp, status: "booked" \| "pending" \| "failed" \| "unknown", weDocument, error?: { code, message } }]` erweitern, ein Eintrag je Kontierung des Tages. `weDocument` am Tag bleibt als Kompatibilitaetsfeld (erster gebuchter Beleg oder leer) bis Client und Specs umgestellt sind, danach entfaellt es. Die fachlichen Fehler (`TIMESHEET_NOT_SUBMITTED`, `SELF_APPROVAL`, `NOT_RESPONSIBLE`, `TIMESHEET_EMPTY`) bleiben HTTP-Fehler; WE-Fehler sind **kein** HTTP-Fehler, sondern Status im Body. |
| `GET /odata/ApprovalTimesheets`              | Optional je Tag `purchaseOrderCoverage: [{ coIdent, ebeln, ebelp }]` bzw. `null` fuer Kontierungen ohne Bestellung, damit der Genehmiger vor der Genehmigung sieht, ob der WE buchbar ist (nur wenn Entscheider in Abschnitt 3 das wollen).                                                                                                                                                                                                                                                                                                                |
| `GET /odata/GoodsReceipts`                   | Neu: Referenzzeilen mit Filter `?status=` und `?extNr=`; Rollen `admin` und eine noch zu benennende Einkaufsrolle (heute nicht vorhanden, siehe O6), `approver` nur fuer eigene Zustaendigkeit.                                                                                                                                                                                                                                                                                                                                                            |
| `POST /odata/GoodsReceiptRetries`            | Neu: `{ extNr, date, coIdent }` wiederholt genau einen WE-Auftrag nach dem Zustandsautomaten; `409 GOODS_RECEIPT_ALREADY_BOOKED`, `409 GOODS_RECEIPT_IN_PROGRESS`, `404 GOODS_RECEIPT_NOT_FOUND`. Ein Mock-Job `POST /odata/GoodsReceiptRetryRuns` simuliert `Z_XTS_RETRY_GR` analog zu `PurchaseOrderSyncRuns`.                                                                                                                                                                                                                                           |
| `GET /odata/ResourceLifecycle`               | `goodsReceipts` um `coIdent`, `ebeln`, `ebelp`, `status` erweitern; `pendingGoodsReceiptHours` bleibt und wird um `failedGoodsReceiptHours` ergaenzt.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /odata/Orders`                         | Neue Validierung `409 ORDER_PERIOD_OVERLAP` (Abschnitt 2, Option A) mit `conflictId` der ueberlappenden Beauftragung.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Fehlercodes im WE-Status                     | `PURCHASE_ORDER_MISSING` (keine bestellte Beauftragung am Tagesdatum), `PURCHASE_ORDER_AMBIGUOUS` (mehrere, nur Altdaten), `PURCHASE_ORDER_QUANTITY_EXCEEDED`, `GOODS_RECEIPT_REJECTED` (MM-Fehler mit Originalmeldung), `GOODS_RECEIPT_TIMEOUT`.                                                                                                                                                                                                                                                                                                          |
| Audit-Log                                    | Statuswechsel `F -> G` traegt je Kontierung den WE-Status; jede Wiederholung schreibt einen Eintrag (`category: "job"`), Fehler mit `details`.                                                                                                                                                                                                                                                                                                                                                                                                             |

### 5.2 Auswirkungen auf bestehende Daten und Code

- **Genehmigte Tage ohne WE** (heute nur Fixture SCHILZ 2026-04-09; produktiv gibt es noch keine Daten, weil kein SAP angebunden ist): erhalten je Kontierung eine Referenzzeile im Status `offen` und laufen ueber die Wiederholung. Der Fixture-Tag wird zum dokumentierten Fall "genehmigt, Bestellung fehlt" mit Begruendung im Testdatenpaket.
- **`weDocument`-Format**: `WE-nnnnnn` aus dem Zaehler wird durch Materialbelegnummer und Jahr ersetzt; der Mock simuliert z. B. `5000000001/2026`. `uat.spec.ts` (Fall A Schritt 7) und `approval.spec.ts` erwarten heute "Wareneingang WE-000001" und muessen mit dem Kontrakt angepasst werden.
- **WebClient**: `approval.component.ts` zeigt das Ergebnis je Kontierung statt eines Belegs; Reporting (`reporting.component.html`, Live-Circle) zeigt die neuen Spalten; eine Sicht fuer offene und fehlgeschlagene WE (Einstellungen oder Reporting) ist neu. Test-IDs und Labels der bestehenden Screens bleiben, neue kommen hinzu.
- **Mock-API**: `weDocumentCounter` entfaellt; `routes.js` bekommt die Ableitung der Bestellposition aus `orders`, die Referenzzeilen, den Zustandsautomaten und einen Fehlerhebel fuer Tests (z. B. Kontierung ohne `purchaseOrders`-Eintrag bleibt `pending`, ein Header oder eine Regel simuliert `unknown`). Das ist ein Grund, XTS-158 (Mock-Zerlegung) vor oder mit der Umsetzung zu bewerten, ohne es hier vorwegzunehmen.
- **Berechtigung**: Wiederholung und Sicht auf fehlgeschlagene WE brauchen eine Rolle; bis O6 (Rollen aus AD) entschieden ist, kommt `admin` in Frage.
- **Reset**: `TestDataResets` setzt Referenzzeilen mit zurueck; `counts` bekommt `goodsReceipts`.

### 5.3 Konkrete Abnahmefaelle (fuer Contract-Tests, E2E und UAT)

| Nr.  | Ausgangslage                                                                                  | Aktion                                                   | Erwartung                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AF1  | Tag `F`, eine Kontierung, genau eine bestellte Beauftragung mit Laufzeit ueber dem Tagesdatum | genehmigen                                               | Tag `G`; `goodsReceipts` mit einem Eintrag `booked`, Beleg gesetzt; Live-Circle zaehlt die Stunden in `goodsReceiptHours`; Audit-Log mit Beleg                                           |
| AF2  | Tag `F`, zwei Kontierungen, beide bestellt                                                    | genehmigen                                               | zwei Eintraege `booked` mit unterschiedlichen `ebeln`/`ebelp`; Summen je Kontierung entsprechen den Positionen                                                                           |
| AF3  | Tag `F`, Kontierung nur mit BANF (Regel `P`), keine Bestellung                                | genehmigen; danach Bestelldaten-Job; danach Wiederholung | Tag `G`, Eintrag `pending` mit `PURCHASE_ORDER_MISSING`; nach Job und Wiederholung `booked`; Live-Circle wechselt von "WE ausstehend" zu gebucht                                         |
| AF4  | Tag `F`, zwei Kontierungen, eine bestellt, eine ohne Bestellung                               | genehmigen; Wiederholung fuer die offene                 | Tag `G`; ein `booked`, ein `pending`; kein Storno; Wiederholung bucht nur den offenen Auftrag, der gebuchte bleibt unveraendert                                                          |
| AF5  | Altdaten: zwei bestellte Beauftragungen mit ueberlappender Laufzeit fuer dieselbe Kontierung  | genehmigen                                               | Tag `G`; Eintrag `failed` mit `PURCHASE_ORDER_AMBIGUOUS`, beide Positionen in der Meldung; keine Buchung; Neuanlage einer ueberlappenden Beauftragung liefert `409 ORDER_PERIOD_OVERLAP` |
| AF6  | WE-Aufruf laeuft in einen Timeout, SAP hat aber gebucht (im Mock simuliert)                   | Wiederholung                                             | Eintrag geht von `unknown` auf `booked` und uebernimmt den vorhandenen Beleg; **genau ein** Beleg mit dem Referenzschluessel, keine zweite Menge                                         |
| AF7  | Tag `F`                                                                                       | genehmigen zweimal parallel bzw. Doppelklick             | zweiter Aufruf `409 TIMESHEET_NOT_SUBMITTED`; genau eine WE-Buchung je Kontierung (heute schon durch Statuspruefung und Client-Sperre abgedeckt)                                         |
| AF8  | Bestellposition hat weniger Restmenge als die Tagesstunden der Kontierung                     | genehmigen                                               | Tag `G`; Eintrag `failed` mit `PURCHASE_ORDER_QUANTITY_EXCEEDED` (angefordert, offen); kein Teil-WE; Meldung fuer Genehmiger und Fehlerprotokoll                                         |
| AF9  | Eintrag `failed` fuenfmal wiederholt                                                          | Job laeuft erneut                                        | keine weitere automatische Wiederholung; Eskalationseintrag im Fehlerprotokoll; manueller Knopf bleibt moeglich                                                                          |
| AF10 | Rolle `approver` ohne `admin`                                                                 | `POST /odata/GoodsReceiptRetries`                        | `403`; Wiederholung nur fuer die festgelegte Rolle                                                                                                                                       |
| AF11 | Fixture SCHILZ 2026-04-09 (`G` ohne WE)                                                       | Testdaten-Reset, dann Reporting                          | Referenzzeile `pending` mit Begruendung; Live-Circle "WE ausstehend" 8 Std.; nach Bestelldaten-Job und Wiederholung gebucht                                                              |
| AF12 | Persona-Wechsel oder Reload waehrend der Genehmigung laeuft                                   | Antwort kommt nach dem Wechsel                           | keine Anzeige unter der neuen Identitaet (bestehende Regel Audit Nr. 12); WE-Status ist beim naechsten Laden aus den Serverdaten sichtbar                                                |

**Offene Frage:** Welche Faelle koennen gegen ein SAP-Testsystem geprueft werden und welche bleiben Mock-Simulation (insbesondere AF6 und AF8)?  
**Entscheider:** SAP-MM (Testsystem, Belegfaelle), Einkauf (fachliche Abnahme AF3, AF4, AF8), PO (UAT-Drehbuch).

## Zusammenfassung der Empfehlungen

| Abschnitt | Empfehlung                                                                                                                                   | Entscheider                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1         | WE 101 auf Standard-Bestellposition mit Mengeneinheit `H`; LERB nur bei Vorgabe des Einkaufs                                                 | SAP-MM, Einkauf                       |
| 2         | Genau eine bestellte Beauftragung je Mitarbeiter, Kontierung und Tagesdatum; Ueberlappung bei Anlage abweisen; WE je Tag und Kontierung      | Einkauf, SAP-MM, Ressourcenmanagement |
| 3         | `G` fachlich sofort nach den Genehmigungspruefungen; WE-Status je Kontierung getrennt, Teilerfolge zulaessig, Wiederholung per Job und Knopf | Einkauf, SAP-MM, Projektleitung       |
| 4         | Idempotenz ueber Referenzschluessel im Beleg und Abfrage vor jeder Wiederholung; Zustandsautomat mit `unklar` nach Timeout                   | SAP-MM, SAP-Basis, Einkauf            |
| 5         | Kontrakt- und Datenaenderungen wie oben, nur nach Bestaetigung; Abnahmefaelle AF1 bis AF12                                                   | SAP-MM, Einkauf, PO                   |

## Naechste Schritte

1. Termin mit SAP-MM und Einkauf; Entscheidung je Abschnitt in `entscheidungen-v0.1.md` als Entscheidung 22 (O4) festhalten.
2. Erst danach XTS-061A mit eigenem Zuschnitt freigeben: Kontrakt (`odata-contracts.md`), Mock-API, WebClient, Specs und UAT-Drehbuch in dieser Reihenfolge; XTS-158 (Mock-Zerlegung) dabei bewerten.
3. Bis zur Entscheidung bleibt der Mock unveraendert; Audit-Befund 34 bleibt offen und verweist auf diese Vorlage.
