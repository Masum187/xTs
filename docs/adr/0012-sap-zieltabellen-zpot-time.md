# ADR-0012: SAP-Zieltabellen `ZPOT_TIME_T` und `ZPOT_PTIME_T` übernehmen

- **Status:** Proposed
- **Datum:** 2026-09-12
- **Autor:** Momo
- **SAP-Kontakt:** Feyzi Göktaş

## Kontext

Feyzi Göktaş hat am 07.09.2026 die SAP-seitigen Zieltabellen für die xTS-Stundendaten fertiggestellt und bereitgestellt (Screenshot vom 07.09., 12:34, in Teams). Sie heißen **`ZPOT_TIME_T`** (Tageszeiten, Kopf) und **`ZPOT_PTIME_T`** (Detail-Stunden, Positionen).

Diese weichen in **Namen** und in einigen **Feld-Details** von der ursprünglichen Konzeption ab:

- Ursprünglich in Konzept und Backlog (XTS-001, XTS-6 / XTS-110) benannt als **`ZXTS_TIME_H`** und **`ZXTS_TIME_P`** — SAP hat sie `ZPOT_*` genannt
- Feldnamen wie `TAGESDATUM`, `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `LEISTUNGSORT`, `ZEXTNR` (statt der zuvor gedachten englischen Kurznamen)
- Zeitfelder als **`CHAR(6)`** statt `TIMS` — Frontend-Format-Interpretation offen

Der SAP-Stand ist die technische Wahrheit — xTS ist der Client, nicht andersherum. Wir passen unsere Kontrakte an die realen Tabellen an.

## Betrachtete Optionen

### Option A — SAP-Tabellen übernehmen wie sind (empfohlen)

- OData-Kontrakte, Mock-API und Naming-Konvention an `ZPOT_*` und die realen Feldnamen anpassen
- Offene Fragen mit Feyzi klären, dann Kontrakt-Doku (XTS-6) und Mock-API (XTS-19) nachziehen
- **Vorteil:** Kein Umbau in SAP nötig, kein Blocker für Sprint 2
- **Nachteil:** Naming-Konvention `ZXTS_*` (aus SAP-Namenskonventionen-Doku XTS-38) muss angepasst oder für Tabellen anders geregelt werden

### Option B — SAP-Tabellen umbauen lassen

- SAP-Team rebenennt Tabellen und Felder auf `ZXTS_*` und einheitliche englische Feldnamen
- **Vorteil:** Konvention konsistent
- **Nachteil:** Verzögerung um mind. 1–2 Wochen, Bindung von SAP-Ressourcen für eine Kosmetik-Änderung; das Präfix `ZPOT_` ist möglicherweise bereits mit einem SAP-Naming-Standard beim Kunden abgestimmt (zu prüfen)

### Option C — Eigene Zwischentabellen mit Mapping

- xTS schreibt in eigene `ZXTS_*`-Tabellen, ein SAP-Job spiegelt in `ZPOT_*`
- **Vorteil:** vollständige Trennung
- **Nachteil:** doppelte Persistenz, Job-Scheduling, Konsistenz-Risiken, keinerlei Fachwert

## Entscheidung

**Option A** — `ZPOT_TIME_T` und `ZPOT_PTIME_T` werden als Ziel-Tabellen übernommen. OData-Kontrakte, Mock-API und Naming-Konventionsdoku werden angepasst.

Das Präfix `ZPOT_` bleibt als von SAP gesetzt bestehen; die Naming-Konventionsdoku (XTS-38) wird ergänzt: **„xTS-eigene Objekte in ABAP/DDIC nutzen Präfix `ZPOT_` für Zieltabellen, `ZCL_XTS_` für Klassen, `Z_XTS_SRV_` für OData-Services"** — Tabellen-Präfix folgt SAP-Kunden-Konvention, Anwendungsobjekte folgen xTS-Konvention.

## Feld-Struktur (Stand 2026-09-07)

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

## Offene Fragen an SAP-Seite (Feyzi Göktaş)

Diese Punkte müssen geklärt sein, bevor der OData-Kontrakt (XTS-6) und die Mock-API (XTS-19) final nachgezogen werden können:

1. **Zeitfelder-Format:** `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `ZEIT` sind alle `CHAR(6)`. Erwartetes Format `HHMMSS` (String) oder anders? Wie werden leere Werte („keine Pause") kodiert — `000000` oder Space? Kann `ARBEITSZEIT` > 24h sein (z. B. bei Wochenaggregat)?
2. **Positions-Eindeutigkeit in `ZPOT_PTIME_T`:** Der sichtbare Key ist nur `MANDT + ZEXTNR`. Ist `TAGESDATUM + KONTIERUNG` implizit auch Key, oder ist ein weiterer Positions-Schlüssel (z. B. `POSNR`) noch dazuzuplanen? Wenn ein Mitarbeiter an einem Tag zweimal auf dieselbe Kontierung bucht (vormittags 3h, nachmittags 2h) — eine Zeile aggregiert oder zwei Zeilen?
3. **STATUS-Werte:** Welche Werte kann `STATUS` (CHAR 1) annehmen? Vermutung: E=Entwurf, F=Freigegeben, G=Genehmigt, A=Abgelehnt, W=Wareneingang. Bitte verbindlich dokumentieren, inkl. erlaubten Übergängen.
4. **Beauftragungs- und BANF-Referenz:** Wo landet die BANF-/Bestellungs-/Beauftragungs-Nummer? Ist das Teil des `KONTIERUNG`-Strings (CHAR 40)? Oder gibt es dafür separate Felder / eine dritte Tabelle? Das ist relevant für Reporting (Budget-Monitor, Kontingent-Monitor) und die Beauftragung (Epic 4).
5. **`ZLBESCHREIBUNG` mit 20 Zeichen:** Ist das ein bewusstes Limit? Im Frontend hatten wir freien Text für Leistungsbeschreibungen wie „Kundengespräch Vertragsanpassung Q4" gedacht (>20 Zeichen). Erweiterbar oder Frontend muss auf 20 Zeichen validieren?
6. **`ARBEITSZEIT` im Tageskopf:** Wird `ARBEITSZEIT` in `ZPOT_TIME_T` aus den Positionen in `ZPOT_PTIME_T` berechnet und geschrieben, oder ist es ein separat gepflegter Wert (mit möglicher Differenz zu den Positionen)? Beides hat unterschiedliche Konsequenzen für Frontend-Validierung.
7. **Löschkennzeichen `LKZ` (CHAR 2):** Welche Werte („X ", „D "?) und ist Soft-Delete gewünscht oder physisches Löschen? Auswirkung auf Historie, Audit und Reporting.

## Konsequenzen

### Betrifft folgende Backlog-Elemente

- **XTS-6** (Sprint 2 aktiv, OData-Kontrakte dokumentieren) — `TimeDayHead` und `TimePositions` EntityTypes müssen an `ZPOT_TIME_T` / `ZPOT_PTIME_T` angepasst werden. Feldnamen: `ZEXTNR`, `TAGESDATUM`, `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `LEISTUNGSORT`, `KONTIERUNG`, `ZLBESCHREIBUNG`, `ZEIT`, `STATUS`, `LKZ`, `MODBE`, `AEDAT`, `AEZEIT`.
- **XTS-19** (Fertig, Mock-API Timesheet) — als **Tech Debt** nachziehen: aktuelle Mock-Struktur weicht ab, muss auf die realen Feldnamen umgestellt werden. Ergänzt XTS-38.
- **XTS-38** (Sprint 2 aktiv, SAP-Namenskonventionen + Datenmodell) — Präfix-Konvention ergänzen: Tabellen-Präfix `ZPOT_` bleibt SAP-Kunden-Standard, Anwendungsobjekte `ZCL_XTS_` / `Z_XTS_SRV_`.
- **XTS-30** (TC Mock-API 7 Endpunkte), **XTS-31** (TC Contract Tests) — Feldbezeichnungen in Testschritten aktualisieren, sobald XTS-6/XTS-19 nachgezogen sind.

### Betrifft folgende UI-Redesign-Punkte

- **K4 Planungsarithmetik** (aus [UI-Redesign-Bewertung](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/116883457)): Die Wahl `CHAR(6)` für Zeitfelder statt `INT` oder `DEC` bedeutet, dass **SAP-seitig keine Minuten-Rechnung stattfindet**. Frontend muss rechnen, SAP speichert die String-Anzeige. Muss in **XTS-89 (Design-Baseline)** notiert werden.

### Nicht betroffen

- Fachlogik in `*.logic.ts` (Minutenrechnung, Kontingente, Statusprüfungen)
- Auth, Rollen, Berechtigungen
- Mock-API-Endpunkt-Struktur (nur die JSON-Felder werden umbenannt)
- UI-Redesign-Umfang

## Nächste Schritte

1. Diese ADR mit Feyzi teilen und die 7 offenen Fragen klären
2. Wenn Antworten da: ADR-Status von `Proposed` auf `Accepted` setzen
3. XTS-6 (OData-Contracts) mit realen Feldern nachziehen
4. XTS-19 (Mock-API) als Follow-up-Story nachziehen
5. XTS-38 (SAP-Namenskonventionen) um Tabellen-Präfix-Erklärung ergänzen
6. XTS-89 (Design-Baseline) — Zeitfeld-Format als Frontend-Verantwortung dokumentieren

## Referenzen

- Screenshot von Feyzi Göktaş, Teams-Nachricht 2026-09-07 12:34
- [ADR-0011: AD/OAuth → EXTNR-Mapping](https://heri-jean-masum.atlassian.net/browse/XTS-10) (definiert wie `ZEXTNR` aus Entra-Login abgeleitet wird)
- [xTS Master Concept](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/111214593)
- [xTS Backlog-Register v6](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/110985498)
- [Confluence-Version dieser ADR](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/120291336)

---

## Repo-Review-Ergänzung (2026-09-19, xTS-Entwicklung)

Der Originaltext oben bleibt unverändert (Stand der Confluence-Seite). Die folgenden Punkte stammen aus dem Repo-Review zu PR #47 und sind **vor einem Wechsel auf `Accepted` aufzulösen**. Sie ändern die Entscheidung nicht, grenzen aber ein, was mit Option A tatsächlich entschieden ist, und ergänzen die offenen Fragen an die SAP-Seite.

### R1 Entscheidung 14 bleibt: Arbeitszeit wird serverseitig berechnet

Der Absatz „K4 Planungsarithmetik" schließt aus dem Speicherformat `CHAR(6)`, dass SAP-seitig keine Minutenrechnung stattfindet und das Frontend rechnen muss. Diese Folgerung ist nicht haltbar: ein Zeichenformat für die Ablage sagt nichts darüber aus, wo gerechnet wird. Entscheidung 14 in `entscheidungen-v0.1.md` bleibt verbindlich: Arbeitszeit = Geht − Kommt − Pause, **serverseitig berechnet**; Abweichungen der Positionssumme brauchen eine Begründung. Der Kontrakt liefert `workHours` bereits als servergeführten Wert. Zu klären sind daher nur Format und Konvertierung (Frage 1: `HHMMSS`, leere Werte, Rundung auf ganze Minuten nach Entscheidung 15), nicht der Ort der Berechnung. Der Hinweis auf XTS-89 (Design-Baseline) ist damit auf „Zeitfeld-Format und Konvertierung" zu beschränken; die Verantwortung für die Berechnung wechselt nicht ins Frontend.

### R2 Fehlende Option: ZPOT-Tabellen übernehmen, Fachkontrakt per Mapping erhalten

Option A koppelt die Übernahme der Tabellen mit einer Umbenennung der OData- und Mock-JSON-Felder auf die DDIC-Namen. Das ist eine eigenständige Schnittstellenänderung, keine zwingende Folge anderer Tabellennamen. Es fehlt die Option:

**Option D — ZPOT-Tabellen übernehmen, bestehenden Fachkontrakt durch Mapping im Gateway bzw. Adapter erhalten.** Die Persistenz folgt SAP (`ZPOT_TIME_T`, `ZPOT_PTIME_T`), der OData-Service mappt auf die fachlichen Feldnamen aus `docs/odata-contracts.md` (`extNr`, `date`, `startTime`, `endTime`, `breakMinutes`, `location`, `lines[{ coIdent, description, hours }]`, `status`, `workHours`, `varianceReason`, `rejectionReason`, `approvedBy`, `approvedAt`, `weDocument`). Für den WebClient und die Mock-API ändert sich nichts; das OData-V2-Format ist bereits ein Adapter (`mock-api/src/odata-v2.js`, Entscheidung 17).

| Kriterium                      | A (Felder umbenennen)                                                                              | D (Mapping im Service)                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Aufwand xTS                    | Kontrakt, Mock, Decoder, Frontend-Modelle, Specs, UAT-Drehbuch anfassen (XTS-6, XTS-19, XTS-30/31) | keiner im Client; Mapping-Tabelle im Service und in `odata-contracts.md` dokumentieren       |
| Aufwand SAP                    | keiner                                                                                             | gering: Feldzuordnung im Gateway-Modell (ohnehin nötig, weil DDIC-Namen nicht 1:1 JSON sind) |
| Stabilität des Kontrakts       | bricht bei jeder DDIC-Änderung erneut                                                              | DDIC-Änderungen bleiben im Service gekapselt                                                 |
| Nachvollziehbarkeit SAP ↔ JSON | direkt                                                                                             | über die Mapping-Tabelle                                                                     |

Die Umbenennung der Mock-JSON-Felder ist daher **separat** zu bewerten und nicht Teil der Tabellenentscheidung. Empfehlung der xTS-Entwicklung: Tabellen nach Option A übernehmen, Kontrakt nach Option D erhalten; die Mapping-Tabelle wird Bestandteil von XTS-6.

### R3 Persistenz ist mit den sieben Fragen nicht vollständig geklärt

Die Feldstruktur deckt den umgesetzten Fachkontrakt nicht ab. Zusätzlich zu den Fragen 1 bis 7 sind vor `Accepted` zu klären:

8. **Tagesstatus:** `ZPOT_TIME_T` hat kein Statusfeld; `STATUS` liegt nur an den Positionen (`ZPOT_PTIME_T`). Der Kontrakt führt den Status am Tag (`E`, `F`, `G`, `A`), und Entscheidung 19 legt fest, dass Genehmigung und Rückweisung **gesamthaft für den Tag** wirken. Wie wird der Tagesstatus abgelegt, und wie wird sichergestellt, dass alle Positionen eines Tages denselben Status tragen (ein Kopffeld, oder Positionsstatus mit serverseitiger Konsistenzregel)?
9. **Rückweisungsgrund:** Pflichtfeld bei Status `A` (Kontrakt `rejectionReason`, Entscheidung 11/12). Kein Feld vorhanden.
10. **Abweichungsbegründung:** Pflicht bei Abweichung zwischen Positionssumme und Arbeitszeit (Kontrakt `varianceReason`, Entscheidung 14). Kein Feld vorhanden.
11. **Genehmiger und Genehmigungszeitpunkt:** Kontrakt `approvedBy`, `approvedAt`; Konzept §7.3 sah `GENEHMIGER` und `GENEHMIGT_AM` im Tageskopf vor. `MODBE`/`AEDAT`/`AEZEIT` sind Änderungsstempel und kein Ersatz, weil sie bei jeder Änderung überschrieben werden.
12. **Wareneingangsbeleg:** Kontrakt `weDocument` bzw. die in der O4-Vorlage vorgeschlagene WE-Referenz je Tag und Kontierung (`docs/entscheidungsvorlage-we-bestellposition.md`, Abschnitt 4). Ablage am Tag, an der Position oder in einer eigenen Tabelle?
13. **Sperren und Nebenläufigkeit:** Der Kontrakt fordert eine Sperre je Mitarbeiter und Kontierung für die Kontingentprüfung (`enablement.js`, Kommentar zu `validateTimesheetEnablement`). Welches Sperrobjekt ist vorgesehen?

### R4 Bereits genannte Konflikte (aus dem PR-Text, weiterhin offen)

- **Namen:** Die ADR nennt `ZXTS_TIME_H`/`ZXTS_TIME_P` als ursprüngliche Konzeptnamen; das Entwicklungskonzept §7.3 führt `ZXTS_TIME_T` und `ZXTS_PTIME_T`. Confluence und Repo angleichen.
- **Schlüssel:** Konzept §7.3 sieht für die Positionstabelle den Schlüssel Mitarbeiter, Tagesdatum, Positionsnummer vor. Ohne Tagesdatum und Positionsnummer im Schlüssel von `ZPOT_PTIME_T` sind weder mehrere Positionen je Tag noch die Kontingentprüfung je Kontierung abbildbar (Frage 2, zuerst zu klären).
- **Längen:** `ZLBESCHREIBUNG` CHAR(20) gegen die heutige Grenze von 255 Zeichen für die Leistungsbeschreibung (Kontrakt, Audit Nr. 42, Fixtures und Specs mit Langtext). `KONTIERUNG` CHAR(40) gegen `CO_IDENT` CHAR(30) im Konzept; `LEISTUNGSORT` CHAR(10) reicht für `remote`/`on-site`.

### Bedingungen für `Accepted`

Die ADR kann erst auf `Accepted` gesetzt werden, wenn die Fragen 1 bis 13 beantwortet sind, R1 im Text korrigiert ist (Berechnung bleibt serverseitig), Option D bewertet und die Entscheidung zur Kontraktumbenennung getrennt festgehalten ist, und die Namens-, Schlüssel- und Längenkonflikte aus R4 aufgelöst sind. Bis dahin bleibt O13 im Entscheidungslog offen.
