# ADR-0012: SAP-Zieltabellen `ZPOT_TIME_T` und `ZPOT_PTIME_T` übernehmen

- **Status:** Proposed
- **Erstfassung:** 2026-09-12 · **Stand:** 2026-09-19
- **Autor:** Momo
- **SAP-Kontakt:** Feyzi Göktaş
- **Fachkontrakt-Referenz:** [`docs/odata-contracts.md`](../odata-contracts.md), Abschnitte „Timesheet-Verhalten", „Genehmigungs-Verhalten", „Freischaltung Stundenschreibung"

## Änderungshistorie

- **v1 (2026-09-12):** Erstfassung nach Screenshot von Feyzi (07.09.). Vorgeschlagene Entscheidung Option A, sieben offene Fragen.
- **v2 (2026-09-19):** Nach Repo-Review, drei Findings: Option D ergänzt und als Vorschlag gesetzt; Frage 1 auf Format statt Berechnungsort eingegrenzt; Fragen 8–11 ergänzt.
- **v3 (2026-09-19):** Nach zweitem Repo-Review, fünf Findings: Mapping aus `docs/odata-contracts.md`; Frage 6 gestrichen (Entscheidung 14); Frage 8 auf gesamthafte Tagesfreigabe (Entscheidung 19); Fragen 12 und 13 ergänzt; Konzeptnamen und Projektstand korrigiert; „vorgeschlagene Entscheidung".
- **v4 (2026-09-19):** Nach drittem Repo-Review, drei Findings:
  - Mapping auf die App-/Mock-Form des Kontrakts reduziert; OData-V2-Transportformat aus der Tabelle entfernt, DDIC-Konvertierung bleibt bis zur SAP-Klärung offen.
  - Frage 12 neu gefasst: WE-Auftrag, Bestellpositionsbezug (`EBELN`/`EBELP`), Buchungsstatus und Materialbelegreferenz; Granularität und Wiederholungslogik werden mit O4 entschieden. `KONTIERUNG` ist kein Sammelfeld für Belegreferenzen (auch Frage 4 angepasst). Referenztabelle ist Vorschlag, keine Entscheidung.
  - Frage 13 neu gefasst: atomare Kontingentprüfung je Mitarbeiter und Kontierung, tagübergreifend; Sperrschlüssel ohne Tagesdatum; Tagesänderungsschutz und WE-Idempotenz als getrennte Anforderungen.
- **v5 (2026-09-19):** Nach viertem Repo-Review, drei Präzisierungen:
  - Frage 2: Positionen auf derselben Kontierung müssen unterscheidbar erhalten bleiben; ein geeigneter Positionsschlüssel wird verlangt, `POSNR` ist nur ein Beispiel; Aggregation ausgeschlossen.
  - Backlog: DDIC-Erweiterung nicht auf `ZPOT_TIME_T` festgelegt — Persistenz gemäß bestätigten Antworten, im Kopf oder in geeigneten ergänzenden Tabellen.
  - Historie: Erstfassung bleibt auf 12.09. datiert; Dokumentstand 19.09.; keine Zuordnung des Review-Autors.

## Kontext

Feyzi Göktaş hat am 07.09.2026 die SAP-seitigen Zieltabellen für die xTS-Stundendaten bereitgestellt (Teams-Screenshot 07.09., 12:34). Sie heißen **`ZPOT_TIME_T`** (Tageszeiten, Kopf) und **`ZPOT_PTIME_T`** (Detail-Stunden, Positionen).

Im Konzept und im Fachkontrakt heißen die Tabellen `ZXTS_TIME_T` und `ZXTS_PTIME_T`; `docs/odata-contracts.md` verweist unter „Arbeitszeit und Tagesdifferenz" bereits auf `ZXTS_TIME_T-ARBEITSZEIT`. SAP hat das Präfix `ZPOT_` gewählt und einige Felder anders als im Konzept angelegt. Zeitfelder sind durchgängig `CHAR(6)`.

Die Fachlogik ist umgesetzt: Login mit Entra (XTS-050, Option B), WebClient mit Stundenschreibung, Genehmigung, Planung, Beauftragung und Reporting laufen gegen die Mock-API in beiden Antwortformen (Entscheidung 17). Diese ADR regelt, wie die SAP-Persistenz an den bestehenden Kontrakt angebunden wird — Voraussetzung für die Ablösung der Mock-API durch den echten Gateway-Service, nicht für die ursprüngliche Entwicklung.

## Betrachtete Optionen

### Option A — SAP-Feldnamen bis in den OData-Kontrakt durchreichen

- Kontrakt, Mock-API und WebClient auf `ZPOT_*`-Feldnamen umstellen
- **Vorteil:** eine Nomenklatur, keine Mapping-Schicht
- **Nachteil:** Mock-API, WebClient, Frontend-Adapterschicht (`odata-http.ts`, `decode.ts`) und alle Contract-Tests müssten migriert werden; SAP-Interna werden Fachvokabular

### Option B — SAP-Tabellen umbauen lassen

- SAP benennt nach Konzept (`ZXTS_*`, englische Feldnamen, kontraktnahe Typen)
- **Vorteil:** Konzept und Persistenz identisch
- **Nachteil:** Verzögerung, SAP-Ressourcen für Kosmetik; `ZPOT_` ist möglicherweise Kunden-Namensstandard (zu prüfen)

### Option C — Eigene Zwischentabellen mit Spiegelung

- xTS schreibt in `ZXTS_*`, ein Job spiegelt nach `ZPOT_*`
- **Nachteil:** doppelte Persistenz, Job-Scheduling, Konsistenzrisiko, kein Fachwert

### Option D — ZPOT-Persistenz übernehmen, Fachkontrakt im Gateway-Service mappen (vorgeschlagen)

- SAP-seitig bleiben `ZPOT_TIME_T` / `ZPOT_PTIME_T` die Persistenz — ergänzt um die Felder, die für den Kontrakt fehlen (Fragen 8–12)
- Der OData-Service (Gateway, `Z_XTS_SRV_*`, DPC/MPC) bildet den bestehenden Fachkontrakt `TimesheetDays` unverändert ab
- Das Mapping DDIC ↔ EntityType liegt vollständig im Gateway-Service; die Frontend-Adapterschicht (V2 ↔ App-Form) bleibt unverändert
- **Vorteile:** Mock-API, WebClient und Contract-Tests bleiben stabil; SAP-Interna in einer Schicht; Konvertierung an genau einem Ort; Entscheidung 14 unberührt
- **Nachteile:** Mapping ist zu pflegen; zwei Nomenklaturen (fachlich englisch, DDIC deutsch) müssen dokumentiert bleiben

## Vorgeschlagene Entscheidung

**Option D**, unter der Bedingung, dass die offenen Fragen 1–13 mit SAP geklärt sind und die dort identifizierten Persistenz-Lücken geschlossen werden. Die Tabellen in ihrem heutigen Stand reichen für den Kontrakt **nicht** aus (Mapping-Tabelle, Spalte „SAP-Stand").

Naming-Konvention: Tabellen-Präfix `ZPOT_` folgt dem SAP-Kunden-Standard; Anwendungsobjekte bleiben `ZCL_XTS_` (Klassen) und `Z_XTS_SRV_` (OData-Services). XTS-38 wird nur um diese Klarstellung ergänzt.

## Feld-Struktur SAP-seitig (Stand 2026-09-07)

### `ZPOT_TIME_T` — Tageszeiten (Kopf, 1 Zeile pro Tag)

| Feld           | Key | Typ  | Länge | Bedeutung                   |
| -------------- | --- | ---- | ----- | --------------------------- |
| `MANDT`        | ✓   | CLNT | 3     | Mandant                     |
| `ZEXTNR`       | ✓   | CHAR | 12    | Ident für den Userstammsatz |
| `TAGESDATUM`   | ✓   | DATS | 8     | Datum                       |
| `KOMMT`        |     | CHAR | 6     | Kommt                       |
| `GEHT`         |     | CHAR | 6     | Geht                        |
| `PAUSE`        |     | CHAR | 6     | Pause                       |
| `ARBEITSZEIT`  |     | CHAR | 6     | Arbeitszeit                 |
| `LEISTUNGSORT` |     | CHAR | 10    | Leistungsort                |
| `MODBE`        |     | CHAR | 12    | Letzter Änderer             |
| `AEDAT`        |     | DATS | 8     | Datum der letzten Änderung  |
| `AEZEIT`       |     | TIMS | 6     | Änderungsuhrzeit            |
| `LKZ`          |     | CHAR | 2     | Löschkennzeichen            |

### `ZPOT_PTIME_T` — Detail-Stunden (Positionen, N Zeilen pro Tag)

| Feld             | Key | Typ  | Länge | Bedeutung                   |
| ---------------- | --- | ---- | ----- | --------------------------- |
| `MANDT`          | ✓   | CLNT | 3     | Mandant                     |
| `ZEXTNR`         | ✓   | CHAR | 12    | Ident für den Userstammsatz |
| `TAGESDATUM`     |     | DATS | 8     | Datum                       |
| `KONTIERUNG`     |     | CHAR | 40    | Kontierung                  |
| `ZLBESCHREIBUNG` |     | CHAR | 20    | Leistungsbeschreibung       |
| `ZEIT`           |     | CHAR | 6     | Zeit                        |
| `STATUS`         |     | CHAR | 1     | Ptime-Status                |
| `MODBE`          |     | CHAR | 12    | Letzter Änderer             |
| `AEDAT`          |     | DATS | 8     | Datum der letzten Änderung  |
| `AEZEIT`         |     | TIMS | 6     | Änderungsuhrzeit            |
| `LKZ`            |     | CHAR | 2     | Löschkennzeichen            |

## Mapping Fachkontrakt ↔ SAP-Persistenz

Kontrakt in App-/Mock-Form aus `docs/odata-contracts.md`. Das OData-V2-Transportformat (Dezimalwerte als String, Uhrzeit `Edm.Time`, Datum `/Date(ms)/`) ist dort dokumentiert und hier nicht Gegenstand. DDIC-Konvertierungen bleiben bis zur SAP-Klärung offen. Spalte „SAP-Stand" bewertet, ob der heutige DDIC-Stand das Feld trägt.

### `TimesheetDays` (Tag) ↔ `ZPOT_TIME_T`

| Kontrakt-Feld     | Bedeutung / Format (App-Form)                         | SAP-Feld                   | SAP-Typ | SAP-Stand                                | Frage |
| ----------------- | ----------------------------------------------------- | -------------------------- | ------- | ---------------------------------------- | ----- |
| `extNr`           | Mitarbeiterkennung                                    | `ZEXTNR`                   | CHAR 12 | vorhanden                                | —     |
| `date`            | Kalendertag `YYYY-MM-DD`                              | `TAGESDATUM`               | DATS 8  | vorhanden                                | —     |
| `startTime`       | Uhrzeit `HH:MM`                                       | `KOMMT`                    | CHAR 6  | vorhanden, Format offen                  | 1     |
| `endTime`         | Uhrzeit `HH:MM`                                       | `GEHT`                     | CHAR 6  | vorhanden, Format offen                  | 1     |
| `breakMinutes`    | Pause in ganzen Minuten                               | `PAUSE`                    | CHAR 6  | vorhanden, Format offen                  | 1     |
| `workHours`       | Arbeitszeit in Dezimalstunden, serverseitig berechnet | `ARBEITSZEIT`              | CHAR 6  | vorhanden, Format offen                  | 1     |
| `location`        | `remote` oder `on-site`                               | `LEISTUNGSORT`             | CHAR 10 | vorhanden, Wertemapping offen            | 1     |
| `status`          | Tagesstatus `E`, `F`, `G`, `A`                        | —                          | —       | **fehlt**                                | 8     |
| `varianceReason`  | Abweichungsbegründung, höchstens 255 Zeichen          | —                          | —       | **fehlt**                                | 10    |
| `rejectionReason` | Servergeführter Rückweisungsgrund                     | —                          | —       | **fehlt**                                | 9     |
| `approvedBy`      | Genehmiger (EXTNR), servergeführt                     | —                          | —       | **fehlt** (`MODBE` ist nicht Genehmiger) | 11    |
| `approvedAt`      | Genehmigungszeitpunkt, servergeführt                  | —                          | —       | **fehlt**                                | 11    |
| `weDocument`      | Bisherige WE-Belegreferenz; Weiterentwicklung mit O4  | —                          | —       | **fehlt**                                | 12    |
| —                 | (kein Kontraktfeld)                                   | `MODBE`, `AEDAT`, `AEZEIT` |         | vorhanden, Änderungsstempel              | —     |
| —                 | (logisches Löschen, kein Kontraktfeld am Tag)         | `LKZ`                      | CHAR 2  | vorhanden, Semantik offen                | 7     |

### `TimesheetDays.lines[]` (Position) ↔ `ZPOT_PTIME_T`

| Kontrakt-Feld | Bedeutung / Format (App-Form)       | SAP-Feld               | SAP-Typ | SAP-Stand                     | Frage |
| ------------- | ----------------------------------- | ---------------------- | ------- | ----------------------------- | ----- |
| `coIdent`     | Kontierung                          | `KONTIERUNG`           | CHAR 40 | vorhanden                     | —     |
| `description` | Beschreibung, höchstens 255 Zeichen | `ZLBESCHREIBUNG`       | CHAR 20 | **Längenkonflikt** 255 vs. 20 | 5     |
| `hours`       | Stunden in Dezimalstunden           | `ZEIT`                 | CHAR 6  | vorhanden, Format offen       | 1     |
| —             | (kein Positions-Status im Kontrakt) | `STATUS`               | CHAR 1  | vorhanden, ohne Kontraktbezug | 3, 8  |
| —             | (Zuordnung zum Tag)                 | `ZEXTNR`, `TAGESDATUM` |         | `TAGESDATUM` nicht im Key     | 2     |
| —             | (logisches Löschen)                 | `LKZ`                  | CHAR 2  | vorhanden, Semantik offen     | 7     |

## Offene Fragen an SAP-Seite (Feyzi Göktaş)

Alle Fragen sind Bedingung für `Accepted`. Fragen 2, 8–13 sind persistenzkritisch.

### Format und Konvertierung

1. **Speicherformat der `CHAR(6)`-Felder und `LEISTUNGSORT`.** `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `ZEIT` sind `CHAR(6)`. Der Kontrakt führt Uhrzeiten als `HH:MM`, Pause in ganzen Minuten, Stunden und Arbeitszeit in Dezimalstunden. Zu klären: Uhrzeitfelder als `HHMMSS`? `PAUSE` als Minutenzahl oder als Dauer `HHMMSS`? `ZEIT`/`ARBEITSZEIT` als Dauer `HHMMSS` oder als Dezimalstunden als Text? Leerwert `000000` oder Space? Kann `ARBEITSZEIT` 24 h übersteigen? Für `LEISTUNGSORT` (CHAR 10): Wertemapping zu `remote`/`on-site`. Die Berechnung `workHours = Geht − Kommt − Pause` bleibt serverseitig (Entscheidung 14); hier geht es ausschließlich um Speicherformat und Konvertierung im Gateway-Service.
2. **Positions-Eindeutigkeit in `ZPOT_PTIME_T`.** Sichtbarer Key ist `MANDT + ZEXTNR`; `TAGESDATUM` ist nicht als Key markiert. Der Kontrakt erlaubt mehrere Positionen pro Tag, auch auf derselben Kontierung, und diese müssen unterscheidbar erhalten bleiben — eine Aggregation wäre keine reine Persistenzentscheidung, sondern würde Beschreibungen und Bearbeitbarkeit verändern. Bitte einen geeigneten Positionsschlüssel vorsehen (z. B. eine laufende Nummer je Tag wie `POSNR`; die technische Lösung ist SAP-seitig frei). Ist `TAGESDATUM` zusätzlich Bestandteil des Keys?
3. **Semantik von `ZPOT_PTIME_T.STATUS`.** Der Kontrakt führt Status nur am Tag (`E`/`F`/`G`/`A`, Entscheidung 19). Welche Werte trägt der Positions-`STATUS`, und wie verhält er sich zum Tagesstatus — redundante Ableitung, oder Vorbereitung auf die Ausbaustufe XTS-064? Zusammen mit Frage 8 zu beantworten.
4. **Beauftragungs-, BANF- und Bestellreferenz in der Planungs-/Beauftragungskette.** Wo liegen Beauftragung, BANF-Nummer/-Position und Bestellung/-Position (`EBELN`/`EBELP`) für `ResourceLifecycle`, `BudgetMonitor` und Epic 4? `KONTIERUNG` (CHAR 40) ist das Kontierungsobjekt und **nicht** als Sammelfeld für Belegreferenzen zu verwenden. Separate Felder oder eigene Tabelle (`ZXTS_MABEAUF_T`-Pendant)? Die Zuordnung genehmigter Stunden zur Bestellposition für den Wareneingang ist Gegenstand von Frage 12 und O4.
5. **`ZLBESCHREIBUNG` CHAR 20 vs. Kontrakt 255.** Kontrakt validiert `description` bis 255 Zeichen (`DESCRIPTION_TOO_LONG`). Erweiterbar, oder muss der Kontrakt auf 20 abgesenkt werden? Absenken wäre eine Kontraktänderung mit WebClient-Folge.
6. _(gestrichen in v3 — Berechnung von `ARBEITSZEIT` ist entschieden, Entscheidung 14; Format siehe Frage 1)_
7. **Löschkennzeichen `LKZ` (CHAR 2).** Wertevorrat, Soft-Delete oder physisches Löschen; Auswirkung auf Historie, Audit-Log (`ZXTS_LOG_T`) und Reporting.

### Persistenz für Genehmigung, Status und Wareneingang

8. **Tagesstatus im Kopf.** Der Kontrakt führt `status` gesamthaft am Tag (`E` Entwurf, `F` freigegeben, `G` genehmigt, `A` zurückgewiesen; Entscheidung 19: Tagesfreigabe und -rückweisung wirken für den ganzen Tag). `ZPOT_TIME_T` hat kein Statusfeld. Bitte Statusfeld im Kopf vorsehen (CHAR 1, Wertevorrat `E`/`F`/`G`/`A`) oder eine gleichwertige Persistenz benennen. Positionsweise Genehmigung ist nicht Gegenstand (Ausbaustufe XTS-064).
9. **Rückweisungsgrund.** `action: "reject"` schreibt `rejectionReason`; bei erneutem Speichern durch den Mitarbeiter (Flow `A → E → F`) wird das Feld geleert. Wo wird der Grund persistiert (Feld im Kopf oder Historientabelle)? Muss die Historie über den Flow hinaus erhalten bleiben (Audit)?
10. **Abweichungsbegründung.** Bei Freigabe (`F`) mit Positionssumme ≠ `workHours` ist `varianceReason` (≤ 255) Pflicht (`VARIANCE_REASON_REQUIRED`). Wo wird sie persistiert?
11. **Genehmiger und Genehmigungszeitpunkt.** `approvedBy` (EXTNR) und `approvedAt` sind servergeführt und für Vier-Augen-Prüfung und Audit erforderlich. `MODBE`/`AEDAT`/`AEZEIT` sind Änderungsstempel und dafür nicht geeignet. Bitte dedizierte Felder im Kopf oder Historientabelle vorsehen.
12. **Wareneingang: Auftrag, Bestellpositionsbezug, Buchungsstatus, Materialbeleg.** Wo werden WE-Auftrag, Bestellpositionsbezug (`EBELN`/`EBELP`), Buchungsstatus und Materialbelegreferenz gespeichert und eindeutig dem Tag sowie den betroffenen Positionen beziehungsweise Kontierungen zugeordnet? Die endgültige Granularität und Wiederholungslogik werden mit **O4** entschieden. O4 behandelt: welche Bestellung/Position für die genehmigten Stunden verwendet wird; was bei fehlender Bestellung, Fehlern oder Teilerfolgen geschieht; wie nach Fehlern oder unklarem Timeout-Ergebnis ohne Doppelbuchung wiederholt wird. Die BANF allein ist keine Bestellpositionsreferenz. Das bisherige `weDocument` im Kontrakt ist die Übergangsform; eine separate Referenztabelle Tag/Position ↔ WE-Auftrag ist ein Vorschlag, keine Entscheidung.
13. **Atomare Kontingentprüfung je Mitarbeiter und Kontierung.** Der Kontrakt fordert für gleichzeitige Speichervorgänge eine Sperre je Mitarbeiter und Kontierung. Gemeint ist die atomare Prüfung des Kontingents über alle Tage hinweg, nicht nur der Schutz desselben Tages. Beispiel: 8 Stunden sind offen; zwei parallele Requests speichern je 6 Stunden auf unterschiedlichen Tagen — beide dürfen nicht unabhängig „8 Stunden frei" lesen und zusammen 12 Stunden buchen. Die serverseitige Absicherung muss Restermittlung, Prüfung und Speichern einschließlich Kontingentfortschreibung zusammen schützen; beim Upsert wird die bisherige Fassung desselben Tages berücksichtigt (Audit Nr. 4). Ein SAP-Enqueue-Objekt ist eine mögliche Umsetzung; SAP legt Sperrschlüssel (`ZEXTNR` + `KONTIERUNG`, ohne Tagesdatum) und Transaktionsgrenze fest. Das ist keine langlebige Reservierung während der Benutzereingabe. Getrennt davon: Tagesänderungsschutz (ETag/`If-Match`, mit dem ersten Gateway-Service zu vereinbaren) und die Idempotenzsperre für WE-Aufträge aus O4.

## Konsequenzen

### Backlog

- **XTS-6** (OData-Kontrakte): Fachkontrakt bleibt. Ergänzung um die Mapping-Tabelle und Konvertierungsregeln, sobald Frage 1 beantwortet ist. Keine Feldumbenennung.
- **XTS-19** (Mock-API), **XTS-30**, **XTS-31** (TCs): unverändert.
- **XTS-38** (Namenskonventionen): Präfix-Klarstellung `ZPOT_`; sonst keine Änderung.
- **Neu (nach `Accepted`):** Story „Gateway-Service `Z_XTS_SRV_TIMESHEET`: Mapping `ZPOT_*` ↔ `TimesheetDays`" in Epic 12. Voraussetzung für die Ablösung der Mock-API; blockiert keine laufende Entwicklung.
- **Neu (nach Antworten zu 8–12):** SAP-seitige Story in Epic 14: Persistenz für Tagesstatus, `varianceReason`, `rejectionReason`, `approvedBy`, `approvedAt` sowie die WE-Persistenz nach O4 — gemäß den bestätigten Antworten, im Kopf oder in geeigneten ergänzenden Tabellen.

### Nicht betroffen

- Fachlogik in `*.logic.ts`, `shared/hours.ts` (Minutenrechnung) und `mock-api/src/hours.js`
- Frontend-Adapterschicht (`odata-http.ts`, `decode.ts`, `api-error.ts`)
- Auth (XTS-050), Rollen, Zuständigkeit (Entscheidung 19), Datumsregeln (Entscheidung 18)
- UI-Redesign-Umfang

### Entschiedene Regeln, die diese ADR nicht öffnet

- **Entscheidung 14:** `workHours` = Geht − Kommt − Pause, serverseitig, Minutenpräzision.
- **Entscheidung 17:** OData V2, SAP ECC mit klassischem Gateway.
- **Entscheidung 18:** Erfassbarer Zeitraum laufender Monat und Vormonat bis Monatsabschluss.
- **Entscheidung 19:** Gesamthafte Tagesfreigabe und -rückweisung; positionsweise Genehmigung ist Ausbaustufe XTS-064.
- **O4** bleibt offen und wird durch diese ADR nicht vorweggenommen.

## Bedingungen für `Accepted`

1. Antworten zu Fragen 1–5 und 7 liegen vor und sind in der Mapping-Tabelle eingearbeitet.
2. Fragen 8–11 sind beantwortet und die fehlende Persistenz (Tagesstatus, `varianceReason`, `rejectionReason`, `approvedBy`, `approvedAt`) ist SAP-seitig konkret benannt — im Kopf oder in ergänzenden Tabellen; die Feld-Struktur-Tabellen sind aktualisiert.
3. Frage 12 ist so weit beantwortet, dass die Persistenz für WE-Auftrag, Bestellpositionsbezug, Buchungsstatus und Materialbeleg festgelegt ist; Granularität und Wiederholungslogik sind mit O4 abgestimmt oder ausdrücklich an O4 delegiert.
4. Frage 13 ist beantwortet: Sperrschlüssel und Transaktionsgrenze der atomaren Kontingentprüfung sind SAP-seitig festgelegt.
5. Keine offenen Namens-, Schlüssel- oder Längenkonflikte zwischen Kontrakt und DDIC.

## Nächste Schritte

1. ADR mit Feyzi teilen; Fragen 1–5, 7–13 klären. Fragen 2, 8, 12 und 13 zuerst.
2. Antworten einarbeiten (v6), Status auf `Accepted`.
3. XTS-6 um Mapping und Konvertierungsregeln ergänzen; XTS-38 um Präfix-Klarstellung.
4. Gateway-Mapping-Story (Epic 12) und DDIC-Erweiterungs-Story (Epic 14) anlegen.

## Referenzen

- Teams-Screenshot Feyzi Göktaş, 2026-09-07 12:34
- [`docs/odata-contracts.md`](../odata-contracts.md) — Fachkontrakt (App-/Mock-Form und V2-Transport), Timesheet-, Genehmigungs- und Freischaltungs-Verhalten
- [ADR-0011: AD/OAuth → EXTNR-Mapping](https://heri-jean-masum.atlassian.net/browse/XTS-10)
- [xTS Master Concept](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/111214593)
- [xTS Backlog-Register v6](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/110985498)
- [UI-Redesign-Bewertung](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/116883457)
- [Confluence-Fassung dieser ADR](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/120291336)

---

## Repo-Abgleich (2026-09-19, xTS-Entwicklung)

Der Text oben ist die unveränderte v5 der Confluence-Fassung. Die Repo-Verweise wurden gegen den Stand von `main` geprüft: die Abschnitte „Timesheet-Verhalten", „Genehmigungs-Verhalten" und „Freischaltung Stundenschreibung" in `docs/odata-contracts.md`, der Verweis auf `ZXTS_TIME_T-ARBEITSZEIT`, die Fehlercodes `DESCRIPTION_TOO_LONG` und `VARIANCE_REASON_REQUIRED`, die Sperre je Mitarbeiter und Kontierung, der Punkt ETag/`If-Match` und die Ausbaustufe XTS-064 im Backlog existieren wie zitiert. Die Mapping-Tabelle verwendet die umgesetzten Kontraktnamen. Die Ergänzungen früherer Repo-Reviews (Berechnung serverseitig, Option D, Fragen 12 und 13, gesamthafte Tagesfreigabe, Konzeptnamen, Datierung) sind in v5 enthalten; eine gesonderte Repo-Ergänzung entfällt. Die Bedingungen für `Accepted` stehen in der ADR selbst; O13 im Entscheidungslog bleibt bis dahin offen.
