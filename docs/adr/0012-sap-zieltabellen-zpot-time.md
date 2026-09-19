# ADR-0012: SAP-Zieltabellen `ZPOT_TIME_T` und `ZPOT_PTIME_T` übernehmen

- **Status:** Proposed
- **Datum:** 2026-09-12
- **Autor:** Momo
- **SAP-Kontakt:** Feyzi Göktaş

## Änderungshistorie

- **2026-09-12 (v1):** Erstfassung. Entscheidung Option A (SAP-Feldnamen bis in OData-Kontrakte durchreichen). Sieben offene Fragen an Feyzi.
- **2026-09-12 (v2):** Repo-Review (Bugbot/Router auf `8c25ec5`) fand drei P2-Findings. Alle drei eingearbeitet:
  - Finding 1 aufgelöst: K4-Konsequenz „Frontend muss rechnen" entfernt. `CHAR(6)` ist Speicherformat und schließt serverseitige Berechnung nicht aus — Entscheidung 14 (Arbeitszeit serverseitig aus Kommt/Geht/Pause) bleibt unverändert. Frage 1 präzisiert auf Format und Konvertierung im Adapter.
  - Finding 2 aufgelöst: **Option D** neu aufgenommen — ZPOT-Persistenz übernehmen, Fachkontrakt im Gateway-/Adapter-Mapping erhalten. **Entscheidung von A auf D geändert.**
  - Finding 3 aufgelöst: Vier zusätzliche offene Fragen (8–11) zu Tagesstatus, Rückweisungsgrund, Abweichungsbegründung, Genehmiger + Genehmigungszeitpunkt ergänzt.

## Kontext

Feyzi Göktaş hat am 07.09.2026 die SAP-seitigen Zieltabellen für die xTS-Stundendaten fertiggestellt und bereitgestellt (Screenshot vom 07.09., 12:34, in Teams). Sie heißen **`ZPOT_TIME_T`** (Tageszeiten, Kopf) und **`ZPOT_PTIME_T`** (Detail-Stunden, Positionen).

Diese weichen in **Namen** und in einigen **Feld-Details** von der ursprünglichen Konzeption ab:

- Ursprünglich in Konzept und Backlog (XTS-001, XTS-6 / XTS-110) benannt als **`ZXTS_TIME_H`** und **`ZXTS_TIME_P`** — SAP hat sie `ZPOT_*` genannt
- Feldnamen wie `TAGESDATUM`, `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `LEISTUNGSORT`, `ZEXTNR` (statt der zuvor gedachten englischen Kurznamen)
- Zeitfelder als **`CHAR(6)`** statt `TIMS` — Format und Konvertierung müssen im Adapter geklärt werden, die Berechnungslogik bleibt davon unberührt

Der SAP-Stand ist die technische Wahrheit auf Persistenz-Ebene. Wie diese Persistenz nach außen (OData-Kontrakt, Mock-API, Frontend) sichtbar wird, ist eine separate Schnittstellenentscheidung.

## Betrachtete Optionen

### Option A — SAP-Feldnamen bis in OData-Kontrakte durchreichen

- OData-Kontrakte, Mock-API und Naming-Konvention an `ZPOT_*` und die realen deutschen Feldnamen anpassen
- **Vorteil:** eine Nomenklatur, keine Mapping-Schicht
- **Nachteil:** Mock-API (XTS-19, fertig) wird zu Tech Debt; TCs (XTS-30/31) müssen Feldnamen nachziehen; Frontend-Verträge ändern sich; SAP-Interna leaken ins Fachvokabular

### Option B — SAP-Tabellen umbauen lassen

- SAP-Team rebenennt Tabellen und Felder auf `ZXTS_*` und einheitliche englische Feldnamen
- **Vorteil:** Konvention konsistent
- **Nachteil:** Verzögerung um mind. 1–2 Wochen, Bindung von SAP-Ressourcen für eine Kosmetik-Änderung; das Präfix `ZPOT_` ist möglicherweise bereits mit einem SAP-Naming-Standard beim Kunden abgestimmt (zu prüfen)

### Option C — Eigene Zwischentabellen mit Mapping

- xTS schreibt in eigene `ZXTS_*`-Tabellen, ein SAP-Job spiegelt in `ZPOT_*`
- **Vorteil:** vollständige Trennung
- **Nachteil:** doppelte Persistenz, Job-Scheduling, Konsistenz-Risiken, keinerlei Fachwert

### Option D — ZPOT-Persistenz übernehmen, Fachkontrakt im Adapter/Gateway mappen (empfohlen)

- SAP-seitig bleibt `ZPOT_TIME_T` / `ZPOT_PTIME_T` unverändert die Persistenz
- OData-Service bzw. Adapter-Schicht bildet den Fachkontrakt: `TimeDayHead` und `TimePositions` mit englischen Feldnamen (`employeeExtNr`, `date`, `startTime`, `endTime`, `breakDuration`, `workingTime`, `workLocation`, `deletedFlag`), wie in bestehender Contracts-Doku und XTS-19 bereits verwendet
- Mapping-Regeln pro Feld dokumentiert (z. B. `ZEXTNR ↔ employeeExtNr`, `TAGESDATUM ↔ date` mit DATS → ISO 8601, `KOMMT ↔ startTime` mit `CHAR(6) HHMMSS` ↔ Minuten-Integer oder ISO-Zeit-String)
- **Vorteile:**
  - Mock-API (XTS-19) bleibt bit-identisch stabil — keine Tech Debt
  - Frontend-Verträge ändern sich nicht — keine Migration im UI-Redesign nötig
  - SAP-Details bleiben auf einer Ebene isoliert
  - Adapter-Schicht ist der eine klare Ort für Format-Konvertierung (`CHAR(6)` ↔ Minuten)
  - Berechnungslogik (Entscheidung 14, Arbeitszeit serverseitig aus Kommt/Geht/Pause) bleibt in derselben Schicht möglich, ohne dass Frontend oder Fachlogik davon betroffen werden
- **Nachteile:**
  - Eine zusätzliche Mapping-Schicht pflegen (klein, ohne Fachlogik)
  - Doppelte Nomenklatur (fachlich englisch, technisch deutsch/`ZPOT_*`) muss dokumentiert bleiben
  - Bei DDIC-Änderungen SAP-seitig ist auch das Mapping anzupassen

## Entscheidung

**Option D** — ZPOT-Persistenz übernehmen, Fachkontrakt im Adapter/Gateway mappen.

Begründung:

- Isolation der SAP-Interna gegenüber Fachvokabular und Frontend
- Mock-API und Contract-Tests bleiben stabil (kein Rückschritt in bereits geliefertem Sprint-1-Umfang)
- Adapter-Schicht ist der natürliche Ort für Format-Konvertierung (`CHAR(6)` ↔ Minuten) und lässt serverseitige Berechnung nach Entscheidung 14 unverändert bestehen
- Fach-Nomenklatur folgt weiter dem geführten Kontrakt, technische Nomenklatur folgt SAP-Standard beim Kunden

**Naming-Konvention (SAP-seitig):** Tabellen-Präfix `ZPOT_` folgt SAP-Kunden-Standard; Anwendungsobjekte in xTS bleiben `ZCL_XTS_` (Klassen) und `Z_XTS_SRV_` (OData-Services). Die Naming-Konventionsdoku (XTS-38) wird nur um diese Präfix-Klarstellung ergänzt.

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

| Feld             | Key | Typ  | Länge | Bedeutung                     |
| ---------------- | --- | ---- | ----- | ----------------------------- |
| `MANDT`          | ✓   | CLNT | 3     | Mandant                       |
| `ZEXTNR`         | ✓   | CHAR | 12    | Ident für den Userstammsatz   |
| `TAGESDATUM`     |     | DATS | 8     | Datum                         |
| `KONTIERUNG`     |     | CHAR | 40    | Kontierung                    |
| `ZLBESCHREIBUNG` |     | CHAR | 20    | Leistungsbeschreibung         |
| `ZEIT`           |     | CHAR | 6     | Zeit                          |
| `STATUS`         |     | CHAR | 1     | Ptime-Status (Positionsebene) |
| `MODBE`          |     | CHAR | 12    | Letzter Änderer               |
| `AEDAT`          |     | DATS | 8     | Datum der letzten Änderung    |
| `AEZEIT`         |     | TIMS | 6     | Änderungsuhrzeit              |
| `LKZ`            |     | CHAR | 2     | Löschkennzeichen              |

## Offene Fragen an SAP-Seite (Feyzi Göktaş)

Diese Punkte müssen geklärt sein, bevor der Adapter/Gateway (XTS-6-Ergänzung) und die vollständige Persistenz-Abdeckung nachgezogen werden können.

### Format und Struktur

1. **Zeitfelder-Format und Konvertierung im Adapter:** `KOMMT`, `GEHT`, `PAUSE`, `ARBEITSZEIT`, `ZEIT` sind alle `CHAR(6)`. Erwartetes Format `HHMMSS` (String) oder anders? Wie werden leere Werte („keine Pause") kodiert — `000000` oder Space? Kann `ARBEITSZEIT` > 24h sein (z. B. bei Wochenaggregat)? Die Klärung betrifft ausschließlich das Format und die Konvertierung im Adapter — die serverseitige Berechnung nach Entscheidung 14 bleibt unverändert bestehen.
2. **Positions-Eindeutigkeit in `ZPOT_PTIME_T`:** Der sichtbare Key ist nur `MANDT + ZEXTNR`. Ist `TAGESDATUM + KONTIERUNG` implizit auch Key, oder ist ein weiterer Positions-Schlüssel (z. B. `POSNR`) noch dazuzuplanen? Wenn ein Mitarbeiter an einem Tag zweimal auf dieselbe Kontierung bucht (vormittags 3h, nachmittags 2h) — eine Zeile aggregiert oder zwei Zeilen?
3. **Positions-STATUS-Werte:** Welche Werte kann `STATUS` (CHAR 1) an der Position annehmen? Vermutung: E=Entwurf, F=Freigegeben, G=Genehmigt, A=Abgelehnt, W=Wareneingang. Bitte verbindlich dokumentieren, inkl. erlaubten Übergängen.
4. **Beauftragungs- und BANF-Referenz:** Wo landet die BANF-/Bestellungs-/Beauftragungs-Nummer? Ist das Teil des `KONTIERUNG`-Strings (CHAR 40)? Oder gibt es dafür separate Felder / eine dritte Tabelle? Das ist relevant für Reporting (Budget-Monitor, Kontingent-Monitor) und die Beauftragung (Epic 4).
5. **`ZLBESCHREIBUNG` mit 20 Zeichen:** Ist das ein bewusstes Limit? Im Frontend hatten wir freien Text für Leistungsbeschreibungen wie „Kundengespräch Vertragsanpassung Q4" gedacht (>20 Zeichen). Erweiterbar oder Adapter/Frontend müssen auf 20 Zeichen validieren?
6. **`ARBEITSZEIT` im Tageskopf:** Wird `ARBEITSZEIT` in `ZPOT_TIME_T` aus den Positionen in `ZPOT_PTIME_T` berechnet und geschrieben, oder ist es ein separat gepflegter Wert (mit möglicher Differenz zu den Positionen)? Beides hat unterschiedliche Konsequenzen für Validierung (siehe auch Frage 10 Abweichungsbegründung).
7. **Löschkennzeichen `LKZ` (CHAR 2):** Welche Werte („X ", „D "?) und ist Soft-Delete gewünscht oder physisches Löschen? Auswirkung auf Historie, Audit und Reporting.

### Persistenz für Genehmigungs- und Statuslogik (neu in v2)

Die folgenden Persistenzen sind für die Fach-Anforderungen aus Epic 7 (Genehmigung) und der UI-Redesign-Erhaltungsliste zwingend, aber in den beiden sichtbaren Tabellen bisher nicht abgebildet:

8. **Tagesstatus im Kopf:** `ZPOT_TIME_T` hat kein Statusfeld. Wie wird der Status eines gesamten Tages persistiert (Entwurf / Freigegeben / Genehmigt / Zurückgewiesen / Korrektur)? Ableitung aus Positions-`STATUS` ist bei gemischten Tagen (Konflikt K3 UI-Redesign — Beispiel: 3 Positionen freigegeben, 1 zurückgewiesen) nicht ausreichend. Bitte Zusatzfeld im Kopf oder separate Status-Tabelle vorsehen.
9. **Rückweisungsgrund:** Bei Ablehnung durch Genehmiger ist ein Pflichtgrund erforderlich (Konflikt K3 und Erhaltungsliste). Wo wird dieser gespeichert? Zusatzfeld im Kopf, separate `ZPOT_REJECT_T` mit Historie, oder Freitextfeld an der Position?
10. **Abweichungsbegründung:** Wenn Summe der Positions-Zeiten ≠ `ARBEITSZEIT` im Kopf, ist ein Pflichttext zur Begründung nötig (Erhaltungsliste UI-Redesign). Wo wird dieser gespeichert? Zusatzfeld im Kopf oder separate Historie?
11. **Genehmiger und Genehmigungszeitpunkt:** `MODBE` ist der letzte Änderer, nicht semantisch der Genehmiger. Für Vier-Augen-Prüfung und Audit (Erhaltungsliste UI-Redesign, Epic 7) braucht es einen dedizierten Genehmiger-`ZEXTNR` und einen Genehmigungs-Timestamp — getrennt von der letzten Bearbeitung. Separates Feld im Kopf oder Historisierungstabelle?

Fragen 8–11 zielen auf denselben Kern: **Genehmigungs- und Rückweisungssemantik brauchen eigene Persistenz**, die weder in `ZPOT_TIME_T` noch in `ZPOT_PTIME_T` heute vollständig abgebildet ist. Ohne diese Klarheit können XTS-6 (Contracts) und Epic 7 (Genehmigung) nicht sauber gebaut werden.

## Konsequenzen

### Betrifft folgende Backlog-Elemente

- **XTS-6** (Sprint 2 aktiv, OData-Kontrakte dokumentieren) — Fachkontrakt (`TimeDayHead` / `TimePositions` mit englischen Feldnamen) bleibt bestehen. Ergänzung: Adapter-/Gateway-Mapping-Sektion mit Feld-für-Feld-Zuordnung `ZPOT_*` ↔ Fachkontrakt und Konvertierungsregeln (DATS → ISO, `CHAR(6)` → Minuten oder ISO-Zeit).
- **XTS-19** (Fertig, Mock-API Timesheet) — **unverändert**, keine Tech Debt. Die JSON-Struktur bleibt am Fachkontrakt.
- **XTS-38** (Sprint 2 aktiv, SAP-Namenskonventionen + Datenmodell) — nur um Präfix-Klarstellung ergänzen: Tabellen-Präfix `ZPOT_` folgt SAP-Kunden-Standard, Anwendungsobjekte in xTS `ZCL_XTS_` / `Z_XTS_SRV_`. Keine Feldnamen-Regelung.
- **XTS-30** (TC Mock-API 7 Endpunkte), **XTS-31** (TC Contract Tests) — **unverändert**, weil Mock-API stabil bleibt.
- **Neue Follow-up-Story (offen):** „Adapter/Gateway-Mapping `ZPOT_*` ↔ Fachkontrakt". Klein, aber muss vor XTS-050 (Login, blockiert durch ADR-0011) und Epic 6 (WebClient Stundenschreibung) fertig sein, spätestens wenn das SAP-Backend live geht.

### Nicht betroffen

- Fachlogik in `*.logic.ts` (Minutenrechnung, Kontingente, Statusprüfungen)
- Auth, Rollen, Berechtigungen
- Mock-API-Endpunkt-Struktur und JSON-Felder
- Frontend-Verträge (keine Migration im UI-Redesign nötig wegen SAP-Feldnamen)
- UI-Redesign-Umfang (Konflikt K4 bleibt eine reine Fachfrage der Minuten-vs-Dezimal-Präzision im Fachkontrakt, unabhängig vom SAP-Speicherformat)

### Serverseitige Berechnung bleibt bestehen

Die Speicherform `CHAR(6)` schließt serverseitige Berechnung nicht aus. Entscheidung 14 (Arbeitszeit wird serverseitig aus `Kommt`, `Geht` und `Pause` berechnet) bleibt unverändert. Der Adapter/das Gateway ist der Ort, an dem das Speicherformat in ein Rechenformat und zurück konvertiert wird — das ist eine reine Konvertierungsaufgabe, keine Verlagerung von Logik.

## Nächste Schritte

1. Diese ADR mit Feyzi teilen und die 11 offenen Fragen klären, insbesondere Fragen 2, 4 und 8–11 (persistenzkritisch)
2. Wenn Antworten da: ADR-Status von `Proposed` auf `Accepted` setzen; ggf. weitere Änderungshistorie-Einträge, falls Feyzis Antworten zu Anpassungen führen
3. XTS-6 (OData-Contracts) um Adapter-Mapping-Sektion ergänzen — nicht Feldnamen umbenennen
4. XTS-38 (SAP-Namenskonventionen) um Tabellen-Präfix-Klarstellung ergänzen
5. Neue Follow-up-Story für „Adapter/Gateway-Mapping" anlegen und in Epic 12 (OData Contracts & Mock API) einhängen
6. Wenn Fragen 8–11 zusätzliche Persistenz-Objekte ergeben (Statusfeld im Kopf, `ZPOT_REJECT_T`, Genehmiger-Felder): Feld-Struktur-Tabellen in dieser ADR aktualisieren, dann `Accepted`

## Referenzen

- Screenshot von Feyzi Göktaş, Teams-Nachricht 2026-09-07 12:34
- [ADR-0011: AD/OAuth → EXTNR-Mapping](https://heri-jean-masum.atlassian.net/browse/XTS-10) (definiert wie `ZEXTNR` aus Entra-Login abgeleitet wird)
- [xTS Master Concept](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/111214593)
- [xTS Backlog-Register v6](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/110985498)
- [UI-Redesign-Bewertung](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/116883457) (Konflikt K3 Genehmigung, K4 Planungsarithmetik)
- [Confluence-Version dieser ADR](https://heri-jean-masum.atlassian.net/wiki/spaces/xTs/pages/120291336)
- Repo-Review 2026-09-12 auf Head `8c25ec5` (Findings 1–3 aufgelöst in v2)

---

## Repo-Review-Ergänzung (2026-09-19, xTS-Entwicklung, Stand nach v2)

Der Text oben ist die unveränderte v2 der Confluence-Seite. v2 löst die Review-Findings R1 (Berechnung bleibt serverseitig, Entscheidung 14), R2 (Option D, Kontrakt per Mapping erhalten) und den Kern von R3 (Fragen 8 bis 11) auf. Die folgenden Punkte sind mit v2 **noch nicht** abgedeckt und **vor `Accepted`** aufzulösen.

### E1 Fehlende Persistenzfragen (Ergänzung zu 8 bis 11)

12. **Wareneingangsbeleg:** Der Kontrakt führt `weDocument` am genehmigten Tag; die O4-Vorlage (`docs/entscheidungsvorlage-we-bestellposition.md`, Abschnitt 4) schlägt eine WE-Referenz je Tag und Kontierung mit Status, Beleg und Versuchszähler vor. Ablage am Kopf, an der Position oder in einer eigenen Tabelle?
13. **Sperrobjekt:** Die Kontingentprüfung beim Speichern braucht eine Sperre je Mitarbeiter und Kontierung (`mock-api/src/enablement.js`, `validateTimesheetEnablement`; im Mock nur durch Single-Thread-Verarbeitung abgedeckt). Welches Sperrobjekt ist SAP-seitig vorgesehen?

### E2 Tagesfreigabe ist gesamthaft, gemischte Tage gibt es im MVP nicht

Frage 8 begründet den Tagesstatus mit gemischten Tagen („3 Positionen freigegeben, 1 zurückgewiesen"). Nach Entscheidung 19 wirken Genehmigung und Rückweisung im MVP **gesamthaft für den Tag**; positionsweise Genehmigung ist eine dokumentierte Ausbaustufe (Backlog P2). Der Tagesstatus im Kopf ist damit die fachliche Führungsgröße, nicht nur ein Zusammenfassungswert. Für die Antwort auf Frage 8 heißt das: ein Kopffeld mit den Werten `E`, `F`, `G`, `A` plus serverseitige Regel, dass Positionsstatus und Tagesstatus nicht auseinanderlaufen; eine Ableitung aus den Positionen genügt nicht, weil sie die Regel nur nachträglich prüfen könnte.

### E3 Namen des Fachkontrakts

Option D nennt als Fachkontrakt `employeeExtNr`, `breakDuration`, `workingTime`, `workLocation`, `deletedFlag`. Der geführte Kontrakt in diesem Repo (`docs/odata-contracts.md`, umgesetzt in Mock-API und WebClient) verwendet `extNr`, `breakMinutes`, `workHours`, `location`, `lines[{ coIdent, description, hours }]`, `status`, `varianceReason`, `rejectionReason`, `approvedBy`, `approvedAt`, `weDocument`. Die Mapping-Sektion in XTS-6 muss auf die tatsächlich umgesetzten Namen abbilden; eine Änderung dieser Namen wäre die in Option A beschriebene Schnittstellenänderung und ist nicht Teil dieser ADR.

### E4 Bereits genannte Konflikte (weiterhin offen)

- **Konzeptnamen:** Die ADR nennt `ZXTS_TIME_H`/`ZXTS_TIME_P`; das Entwicklungskonzept §7.3 führt `ZXTS_TIME_T` und `ZXTS_PTIME_T`. Confluence und Repo angleichen.
- **Schlüssel:** Konzept §7.3 sieht für die Positionstabelle Mitarbeiter, Tagesdatum und Positionsnummer als Schlüssel vor; Frage 2 bleibt die zuerst zu klärende Frage.
- **Längen:** `ZLBESCHREIBUNG` CHAR(20) gegen 255 Zeichen im Kontrakt (Frage 5); `KONTIERUNG` CHAR(40) gegen `CO_IDENT` CHAR(30) im Konzept; `LEISTUNGSORT` CHAR(10) reicht für `remote`/`on-site`.
- **Historie:** Der v2-Eintrag datiert das Repo-Review auf den 2026-09-12 und schreibt es Bugbot/Router zu; das Review fand am 2026-09-19 im PR #47 statt.

### Bedingungen für `Accepted`

Fragen 1 bis 13 beantwortet, E2 in der Antwort zu Frage 8 berücksichtigt, Mapping-Sektion (XTS-6) auf die umgesetzten Kontraktnamen bezogen, Namens-, Schlüssel- und Längenkonflikte aus E4 aufgelöst. Bis dahin bleibt O13 im Entscheidungslog offen.
