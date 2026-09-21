# xTS Fachmodell Tag und Monat

Stand: 2026-09-21 (Repo-Kopie der Gesprächsgrundlage „xTS — Fachmodell Tag und Monat", Word-Dokument vom 21.09.2026)  
Zweck: Gesprächsgrundlage für die Abstimmung der ZPOT-Tabellen mit der SAP-Seite. Die zwei fachlichen Ebenen und ihre Objekte werden so gezeigt, dass die physischen Tabellen daran geprüft werden können. Physische Tabellen dürfen anders geschnitten sein; der fachliche Tag und der fachliche Monat müssen widerspruchsfrei abbildbar bleiben.  
Grundlage: `odata-contracts.md`, Entscheidungen 14, 18, 19 in `entscheidungen-v0.1.md`. Bezug: ADR-0012 (`adr/0012-sap-zieltabellen-zpot-time.md`, Status Proposed), O4 (`entscheidungsvorlage-we-bestellposition.md`), Klärungsliste (`klaerungsliste-o4-adr-0012.md`).  
Status: reine Dokumentation. Keine Kontraktänderung, keine Fachentscheidung. ADR-0012 bleibt Proposed, O4 und O13 bleiben offen. Die in Abschnitt 6 genannten SAP-Feldstände sind **laut Rückmeldung bzw. Screenshot vom 21.09.2026** wiedergegeben und **keine bestätigte Zielstruktur**.

## 1. Zwei Ebenen, zwei Genehmigungen

Zwei Genehmigungen, zwei Objekte, zwei Zeitgranularitäten:

| Aspekt       | Planungsfreigabe                                    | Stundengenehmigung                                                                        |
| ------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Objekt       | Planzeile (Monat)                                   | Tag                                                                                       |
| Wer          | Planner                                             | Approver mit Zuständigkeit für eine Kontierung des Tages (Vier-Augen: nicht der Erfasser) |
| Übergang     | V → F                                               | F → G (mit WE) oder F → A (mit Pflichtgrund)                                              |
| Wirkung      | Zeile wird Beauftragungskandidat                    | ganzer Tag, alle Positionen (positionsweise = Ausbaustufe XTS-064)                        |
| Begründungen | Planungs-Kommentar, Planungs-Absage (siehe Hinweis) | Abweichungsbegründung (bei F), Rückweisungsgrund (bei A)                                  |

Hinweis zu Planungs-Kommentar, Planungs-Absage und Planungsgenehmiger: Diese Felder gibt es im umgesetzten Kontrakt (`PlanningEntries`, `PlanningReleases`) **nicht**. Sie sind **nicht beauftragte Erweiterungen** der Planungsfreigabe; ihre Aufnahme wäre eine Kontrakterweiterung der Planung, nicht nur eine SAP-Ablage, und ist weder entschieden noch freigegeben (Klärungsliste K29).

## 2. Tagesstatus (Entscheidung 19)

- Nur `E` und `A` sind für den Mitarbeiter änderbar; `F` und `G` sind gesperrt.
- `F` verlangt mindestens eine Position > 0, alle Pflichtfelder und bei Abweichung Positionssumme ≠ Arbeitszeit die Begründung.
- Die Domäne liefert die Werte; die Übergänge, Berechtigungen und die gesamthafte Tageswirkung setzt der Server durch.

## 3. Was der Tageskopf tragen muss

| Feld (fachlich)          | Kontrakt                     | Bemerkung                                                                   |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------------- |
| Mitarbeiter, Kalendertag | `extNr`, `date`              | Schlüssel des Tages: genau eine fachliche Tageszeile je Mitarbeiter und Tag |
| Kommt, Geht              | `startTime`, `endTime`       | Uhrzeit `HH:MM`, Minutenpräzision                                           |
| Pause                    | `breakMinutes`               | ganze Minuten                                                               |
| Arbeitszeit              | `workHours`                  | Server berechnet, Minutenpräzision (Entscheidung 14)                        |
| Leistungsort             | `location`                   | Wertevorrat `remote` / `on-site`                                            |
| Tagesstatus              | `status`                     | `E` / `F` / `G` / `A`                                                       |
| Abweichungsbegründung    | `varianceReason`             | ≤ 255, Pflicht bei `F` mit Abweichung                                       |
| Rückweisungsgrund        | `rejectionReason`            | servergeführt, gesetzt bei `A`, geleert bei erneutem Speichern              |
| Genehmiger, Zeitpunkt    | `approvedBy`, `approvedAt`   | EXTNR und Zeitstempel, servergeführt                                        |
| WE-Referenz              | `weDocument` (Übergangsform) | Ablage im Kopf oder in einer eindeutig zugeordneten Referenzstruktur: O4    |

Positionen: je Tag n Zeilen mit Kontierung, laufender Nummer, Beschreibung (≤ 255) und Dauer. Mehrere Positionen auf derselben Kontierung bleiben getrennt.

## 4. Präzision

Kontrakt: Uhrzeiten `HH:MM`, Pause in ganzen Minuten, Stunden in Dezimalstunden mit Minutenpräzision; Erfassung der Positionen im Viertelstundenraster.

- Zwei Dezimalstellen sind für Positionsdauern im Viertelstundenraster verlustfrei.
- Für Uhrzeiten, beliebige Pausenminuten und die berechnete Arbeitszeit stellen endliche Dezimalstellen den Wert nicht mathematisch exakt dar (8:20 → 8,33 h; 7 min → 0,12 h; auch drei Nachkommastellen der V2-Form: 8:20 → 8,333). Dezimalstunden sind damit **nicht grundsätzlich ungeeignet**: mit definierter Rundung zurück auf ganze Minuten kann die Darstellung eindeutig sein. Entscheidend ist ein **nachgewiesener, minutengenauer Hin-und-zurück-Abgleich** über den zulässigen Wertebereich (0 bis 24 h Arbeitszeit, 0 bis 744 h Planstunden). Ganze Minuten bzw. geeignete Zeittypen sind die klarere Empfehlung, aber nicht die einzig mögliche Lösung (Klärungsliste K21).

## 5. Kontingent und gleichzeitiges Speichern

Offene Stunden je Mitarbeiter und Kontierung = beauftragte Stunden qualifizierender Beauftragungen (Regel Infotyp 2, Gültigkeit zum Tagesdatum) − gebuchte Stunden in Status `E`/`F`/`G`, wobei die bisherige Fassung desselben Tages herausgerechnet wird (Upsert). Zurückgewiesene Tage (`A`) geben ihr Kontingent frei.

Zwei Speichervorgänge desselben Mitarbeiters auf derselben Kontierung, auch für verschiedene Tage, dürfen nicht beide gegen denselben Reststand prüfen und dann gemeinsam das Kontingent überschreiten. Restermittlung, Prüfung und Speichern gehören zusammen in einen geschützten Abschnitt. Sperrumfang, Transaktionsgrenze, Fehlerverhalten und der Fall mehrerer betroffener Kontierungen in einem Tag sind SAP-seitig festzulegen (Klärungsliste K19).

## 6. Abgleich mit dem Stand vom 21.09. (laut Rückmeldung/Screenshot, nicht bestätigt)

| Tabelle           | Passt (laut Rückmeldung 21.09.)                                             | Zu klären                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZPOT_PTIME_T`    | Schlüssel mit `DATUM` und `LFDNR`, Beschreibung 255, Statusdomäne, `LOEVM`  | `KONT_ID` (CHAR 8) ↔ `coIdent`; Dauer mit 2 Dezimalstellen nur im Viertelstundenraster verlustfrei                                                                                             |
| `ZPOT_TIME_T`     | Zeitfelder vorhanden, Leistungsort, `LOEVM`                                 | Schlüssel enthält `KONT_ID` und `LFDNR` → keine garantiert eindeutige Tageszeile; kein Statusfeld im Screenshot; Begründungen, Genehmiger, Genehmigungszeitpunkt fehlen; Uhrzeiten als Dezimal |
| `ZPOT_MABEAUF_T`  | BANF und Bestellung je Beauftragung                                         | Zuordnung Tag → Beauftragung bei mehreren Beauftragungen derselben Kontierung im Zeitraum                                                                                                      |
| `ZPOT_MAPLAN_T`   | Planstatus, Planstunden, Planungs-Kommentar und -Absage, Planungsgenehmiger | Felder gehören zur Planungsfreigabe (Monat), nicht zur Stundengenehmigung (Tag); Kommentar, Absage und Genehmiger sind nicht beauftragte Erweiterungen                                         |
| WE-Referenz       | Bestellpositionsbezug über Beauftragung                                     | Materialbeleg, Buchungsstatus, Zuordnung zum Tag: O4                                                                                                                                           |
| Kontingentprüfung | —                                                                           | Sperrumfang und Transaktionsgrenze                                                                                                                                                             |

Diese Feldstände weichen von der Feldstruktur in ADR-0012 v5 (Stand 07.09.) ab. Sie werden nach dem Klärungstermin in einer v6 der ADR eingearbeitet; ein Statuswechsel auf `Accepted` erfolgt erst nach erfüllten und bestätigten Annahmekriterien.

## 7. Repo-Abgleich (2026-09-21, xTS-Entwicklung)

Geprüft gegen `odata-contracts.md`, `timesheet.logic.ts`, `enablement.js` und die Entscheidungen 14, 18, 19:

- Abschnitte 2, 3 und 5 entsprechen dem umgesetzten Kontrakt (Statusregeln, Pflichtfelder bei `F`, servergeführte Felder, Leeren des Rückweisungsgrunds beim erneuten Speichern, Kontingentformel mit Upsert und Freigabe durch `A`). Viertelstundenraster bei der Erfassung (`HOURS_STEP = 0.25`) und beliebige Minutenwerte in der Planung stimmen.
- Präzision (Abschnitt 4): Der Kontrakt sagt heute „SAP-seitig entspricht das QUAN mit Stunden auf zwei Nachkommastellen; Rundung auf ganze Minuten ist zu vereinbaren". Die Vereinbarung fehlt noch; nach der Entscheidung ist der Kontraktsatz nachzuziehen (keine Änderung in diesem Dokument).
- Tageskopf-Schlüssel (Abschnitt 6): Ein zusammengesetzter Kopfschlüssel mit `KONT_ID` und `LFDNR` macht die gesamthafte Tagesfreigabe nicht unmöglich; er garantiert lediglich keine eindeutige Tageszeile. SAP muss deshalb entweder einen eindeutigen Tageskopf oder eine gleichwertige, atomar konsistente Tagesstruktur vorsehen, in der mehrere widersprüchliche Tagesstatus oder Genehmiger nicht entstehen können (Klärungsliste K15).
- Planungsfelder (Abschnitte 1 und 6): Planungs-Kommentar, Planungs-Absage und Planungsgenehmiger sind nicht beauftragt (Klärungsliste K29).
