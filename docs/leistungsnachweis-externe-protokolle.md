# Leistungsnachweis für externe Dienstleister: Protokolle und Abgleich

Stand: 2026-09-24  
Zweck: Zusammenführung der beiden Protokolle zum Leistungsnachweis für externe Dienstleister und Abgleich mit dem umgesetzten Stand (Kontrakt, Entscheidungslog, O4-Vorlage, ADR-0012, Klärungsliste).  
Status: **reine Dokumentation.** Keine Kontraktänderung, keine Fachentscheidung, keine Implementierungsfreigabe. **O4, O13 und K30 werden durch dieses Dokument nicht geschlossen**; ADR-0012 bleibt `Proposed`. Die Protokollergebnisse sind Protokollstand, nicht bestätigte Entscheidungen; die Übernahme ins Entscheidungslog erfolgt getrennt.

## Quellenlage

| Quelle                          | Datei                                        | Stand                     | Anmerkung                                                                                                                         |
| ------------------------------- | -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Protokoll 23.09.                | `Protokoll-Leistungsnachweis-Externe.docx`   | 23.09.2026, erste Fassung | Termin und Teilnehmer benannt                                                                                                     |
| Protokoll 23.09. (überarbeitet) | `Protokoll-Leistungsnachweis-Externe_1.docx` | 23.09.2026, überarbeitet  | Termin, Teilnehmer und Entscheidungsverantwortliche als „bitte bestätigen"; Formulierungen zu T1 und Entscheidung 19 abgeschwächt |
| Protokoll Folgetermin 24.09.    | `Protokoll-Folgetermin-24-09.docx`           | 24.09.2026                | Neuerer Protokollstand; E4 zweistufig, Statuslogik, Leistungsort, rechtliche Einordnung                                           |

Die Dateien liegen außerhalb des Repositorys. Abschnitte 3 und 4 enthalten die Repo-Kopien der jeweils aktuellen Fassung beider Protokolle; die abweichenden Formulierungen der ersten 23.09.-Fassung sind in Abschnitt 2 mit Quelle und Datum festgehalten.

## 1. Was dieses Dokument nicht tut

- Es ändert keine geltende Regel. Der verbindliche Kontrakt bleibt `odata-contracts.md`; dort ist nur ein getrennter Hinweis auf anstehende, noch nicht freigegebene Änderungen ergänzt.
- Es erklärt keine Frage für geschlossen. Wo ein Protokoll eine Frage fachlich beantwortet, gilt „fachlich beantwortet laut Folgeprotokoll, Bestätigung und technische Zuordnung ausstehend".
- Es weist Aussagen keiner Person zu, die nicht bestätigt ist.

## 2. Abgleich

### 2.1 E5 Dokumentationsfristen: Gegenaussagen

| Quelle                                               | Datum      | Aussage                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protokoll Leistungsnachweis (beide 23.09.-Fassungen) | 23.09.2026 | „Vertraglich vereinbart. xTS erinnert an offene Nachweise und erzwingt nichts." Status: Vorschlag, Bestätigung durch Einkauf und Recht/HR offen                                                                                    |
| Protokoll Folgetermin                                | 24.09.2026 | „Keine vertragliche Regelung vorhanden. Frist bis zum 20. des Monats ausgeschlossen … Heutiger Umfang: keine technische Fristsperre. Kulanzfrist bis zum 3. des Folgemonats und E-Mail-Erinnerung sind R2, nicht heutiger Umfang." |

Das ist keine Präzisierung, sondern eine Gegenaussage zur Frage, ob eine vertragliche Regelung besteht. Die Fassung vom **24.09. ist der neuere Protokollstand**. Getrennt davon zu behandeln sind:

- **Bestätigung**: E5 bleibt in beiden Fassungen ein Vorschlag; die Bestätigung durch Einkauf und Recht/HR steht aus.
- **Ablösung der bisherigen Regel**: Dass keine technische Fristsperre bestehen soll und Kulanzfrist sowie Erinnerung in eine zweite Ausbaustufe gehören, ist im Entscheidungslog als Ablösung auszuweisen, sobald bestätigt. Entscheidung 18 (Erfassungszeitraum, Monatsabschluss nach Regelwerk Infotyp 3) bleibt laut beiden Protokollen erhalten und trägt die Einreichfrist.

### 2.2 Entscheidung 19: Protokollbewertung, nicht die Entscheidung selbst

| Quelle                          | Datum      | Bewertung von Entscheidung 19                                                                                                    |
| ------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Protokoll 23.09., erste Fassung | 23.09.2026 | „wird durch die monatliche Bestätigung abgelöst. Die Zuständigkeit je Kontierung bleibt relevant, abhängig von offenem Punkt 1." |
| Protokoll 23.09., überarbeitet  | 23.09.2026 | „ist durch die monatliche Bestätigung zu überarbeiten. Der konkrete Zuschnitt hängt an offenem Punkt 1."                         |
| Protokoll Folgetermin           | 24.09.2026 | „bleibt in der Sache erhalten"; Ausbaustufe XTS-064 (positionsweise Genehmigung) entfällt bewusst                                |

**Die neuere Bewertung ersetzt die frühere Protokollbewertung, nicht automatisch die Entscheidung selbst.** Entscheidung 19 gilt unverändert weiter: Tagesgenehmigung und Zuständigkeit je Kontierung bleiben erhalten. **Ausdrücklich zu klären bleibt das Verhältnis zur kaufmännischen Monatsfreigabe**, also ob und wie eine zweite Stufe (E4.2) auf der Tagesgenehmigung aufsetzt; das ist offener Punkt 1 des Folgeprotokolls.

### 2.3 PR #50 Fachmodell

Beide 23.09.-Fassungen halten als Vereinbarung fest: „PR #50 wird nicht als abschließendes Fachmodell gemergt."

Klarstellung: **PR #50 ist bereits gemergt (2026-09-21, `main` 1ec8a26), ausschließlich als vorläufige Gesprächsgrundlage.** Das Dokument `fachmodell-tag-monat.md` sagt das selbst im Kopf und in Abschnitt 3a; es ist ausdrücklich kein bestätigtes Zielmodell für Externe. Die Vereinbarung ist damit sachlich erfüllt, ihre Formulierung aber überholt: sie liest sich wie „nicht gemergt".

### 2.4 Fachlich beantwortet laut Folgeprotokoll, Bestätigung und technische Zuordnung ausstehend

Das Folgeprotokoll enthält zur Statuslogik: „Der Status wird physisch nur auf Tagesebene gesetzt. Die Positionen leiten ihn ab: Time ist Eltern, Paytime ist Kind. Die Bestätigung eines Tages schließt alle Kontierungen dieses Tages, die Rückweisung wirft den ganzen Tag zurück. Positionsbezogene Freigabe wird bewusst nicht umgesetzt; Positionen erhalten keinen unabhängig änderbaren Status." Offener Punkt 6 nennt zusätzlich: „Neben dem Status werden Rückweisungsgrund, Bestätiger (als EXTNR) und Zeitstempel benötigt."

Damit sind folgende Fragen **fachlich beantwortet laut Folgeprotokoll; Bestätigung und technische Zuordnung stehen aus**:

| Frage                                                        | Gegenstand                                     | Fachliche Antwort laut Protokoll 24.09.                                                  |
| ------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ADR-0012 Frage 8, Klärungsliste K15                          | Tagesstatus und Verhältnis zum Positionsstatus | Status physisch am Tag, Positionen leiten ab, kein unabhängig änderbarer Positionsstatus |
| ADR-0012 Frage 3 (Positions-`STATUS`)                        | Semantik des Positionsstatus                   | abgeleitet, nicht unabhängig änderbar                                                    |
| ADR-0012 Frage 9, Klärungsliste K16 (Teil Rückweisungsgrund) | Ablage des Rückweisungsgrunds                  | am Tageskopf benötigt                                                                    |
| ADR-0012 Frage 11, Klärungsliste K17                         | Bestätiger und Zeitstempel                     | Bestätiger als EXTNR und Zeitstempel am Tageskopf benötigt                               |

**Diese Felder gelten dadurch nicht als in den SAP-Tabellen nachgewiesen.** Ob sie im Tageskopf oder in einem eigenen Objekt liegen, ist laut Protokoll Teil der Klärung; ADR-0012 bleibt `Proposed`, die Feldstruktur der ADR ist unverändert. Offen bleiben insbesondere ADR-Frage 12 (Wareneingang) und Frage 13 (Sperre), Letztere laut beiden Protokollen unabhängig von E4 erforderlich.

Die Abweichungsbegründung (`varianceReason`, ADR-Frage 10) ist nicht in gleicher Weise beantwortet: Sie hängt an der berechneten Arbeitszeit, die laut beiden Protokollen für diesen Erfassungsmodus neu zu bewerten ist.

### 2.5 Auswirkungen auf O4

Das Folgeprotokoll führt zu E6 aus: „Remote und Vor-Ort führen zu unterschiedlichen Stundensätzen, daher gegebenenfalls zwei Konditionssätze je Mitarbeiter und bis zu vier Bestellpositionen." Offener Punkt 3 ordnet das O4 zu.

Folge für die O4-Vorlage: Die dortige Zuordnungsempfehlung (genau eine bestellte Beauftragung je Mitarbeiter, Kontierung und Tagesdatum) ist **überprüfungsbedürftig**. Zusätzliche Merkmale werden benötigt, **wenn** Mitarbeiter, Kontierung und Datum mehrere passende Bestellpositionen ergeben. Unterschiedliche Konditionen allein belegen das noch nicht; ob daraus mehrere gleichzeitig passende Positionen entstehen, ist Teil von offenem Punkt 3.

**Kontingente je Bestellposition bleiben eine eigene Entscheidung.** Der Konsequenzen-Abschnitt des Folgeprotokolls nennt sie als Folge getrennter Positionen; sie berühren die in `fachmodell-tag-monat.md` Abschnitt 5 beschriebene Berechnung (Aggregation je Mitarbeiter und Kontierung, Hülle der Beauftragungszeiträume) und sind dort bereits als separat zu entscheidende Neuregelung markiert.

### 2.6 Wiederöffnung nach Wareneingang oder Fakturierung

Das Folgeprotokoll löst ab: „Status G ist final, genehmigte Tage sind nicht zurücksetzbar" wird zu „PM-bestätigte Tage können durch den PM wieder geöffnet werden"; offener Punkt 5 behandelt die Zulässigkeit nach WE-Buchung oder Fakturierung, mit Storno oder Korrekturbeleg als möglicher Folgeaktion, und hält fest, dass eine Wiederöffnung bestehende Buchungen nicht stillschweigend verändern darf.

Ergänzend gegen den O4-Zustandsautomaten abzugleichen:

- Ein **gebuchter** WE-Vorgang ist dort final; ein Storno bleibt Einkaufsprozess außerhalb von xTS. Eine Wiederöffnung des Tages darf den Buchungsnachweis nicht zurücksetzen.
- Ein WE-Vorgang im Zustand **`unklar`** (Timeout ohne Ergebnis) ist gesperrt, bis der Fall sicher geklärt ist. Eine Wiederöffnung darf diesen Zustand und damit den Doppelbuchungsschutz nicht zurücksetzen; insbesondere darf der Referenzschlüssel nicht neu vergeben werden.
- **Das Verfahren dafür bleibt offen** und ist Teil von offenem Punkt 5 in Abstimmung mit O4.

## 3. Repo-Kopie: Protokoll vom 23.09.2026 (überarbeitete Fassung)

> Unveränderte Übernahme. Termin, Teilnehmer und Entscheidungsverantwortliche sind in dieser Fassung als „bitte bestätigen" geführt.

**Termin:** [Datum und Uhrzeit bitte bestätigen — nach Terminplanung 23.09.2026, 11:00 Uhr] · **Teilnehmer:** [bitte bestätigen — vorgesehen: Stephan Schilz, Feyzi Göktaş, Momo] · **Protokoll:** Momo · **Stand:** 23.09.2026  
**Grundlage:** Entscheidungsvorlage „Leistungsnachweis für externe Dienstleister" (Stand 21.09.2026)  
**Status:** Ergebnisse festgehalten. Übernahme ins Entscheidungslog erst nach Abstimmung mit Recht/HR und Einkauf. Aus den festgehaltenen Ergebnissen folgt keine pauschale Implementierungsfreigabe; der technische Zuschnitt wird gesondert entschieden.

### Ergebnisse

| Nr. | Thema                    | Ergebnis                                                                                                                                                                                                                                                                                       | Status                                                      |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| E1  | Nutzergruppen            | Selbstständige Dienstleister und Mitarbeiter von Dienstleistern. Interne nicht im Scope. Arbeitnehmerüberlassung gesondert zu klären.                                                                                                                                                          | Vorschlag; Bestätigung durch Recht/HR offen                 |
| E2  | Erfasste Angaben         | Für den externen Modus werden erfasst: Datum, Kontierung/Auftrag, Leistungsbeschreibung (Pflicht), Stunden. Anwesenheitsangaben werden nicht erfasst. Die Anwesenheitsfelder werden in der Oberfläche nicht angeboten und sollen für einen möglichen späteren internen Modus erhalten bleiben. | entschieden; Umsetzungsregeln offen (siehe offener Punkt 2) |
| E3  | Positionen je Kontierung | Mehrere Positionen auf derselben Kontierung an einem Tag bleiben möglich, jeweils mit eigener Beschreibung.                                                                                                                                                                                    | entschieden                                                 |
| E4  | Zeitraum der Bestätigung | Die Bestätigung erfolgt monatlich zum Monatsabschluss. Damit ist der Zeitraum festgelegt, nicht das Bestätigungsobjekt.                                                                                                                                                                        | Zeitraum entschieden; Objekt offen (siehe offener Punkt 1)  |
| E5  | Dokumentationsfristen    | Vertraglich vereinbart. xTS erinnert an offene Nachweise und erzwingt nichts.                                                                                                                                                                                                                  | Vorschlag; Bestätigung durch Einkauf und Recht/HR offen     |
| E6  | Leistungsort             | Bleibt optional, für Reisekosten.                                                                                                                                                                                                                                                              | entschieden                                                 |

### Tabellen (SAP)

- **T1 — `ZPOT_TIME_T`**: offen. Aus E2 folgt nicht, dass dieselbe physische Tabelle weitergeführt werden muss. Zu klären ist, welche Daten im externen Modus künftig benötigt werden und wie Bestandsdaten erhalten bleiben. Für die monatliche Bestätigung wird zusätzlich eine Ablage für Status, Rückgabegrund, Bestätiger (als EXTNR, nicht als Name) und Zeitstempel benötigt; ob im Kopf oder in einem eigenen Objekt, ist Teil der Klärung.
- **T2 — Positions-`STATUS`**: nicht besprochen, bleibt offen.
- **T3 — Sperre für die Kontingentprüfung**: nicht besprochen, bleibt offen. Unabhängig von E4 erforderlich.

### Offene Punkte

| Nr. | Punkt                                                                                                                                                                                                                                                                                            | Zuständig                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | Bestätigungsobjekt: Mitarbeiter × Monat × Kontierung oder Mitarbeiter × Monat insgesamt. Ausdrücklich mitentscheiden: Verhalten bei gemischten Zuständigkeiten und Wirkung einer Rückweisung (gesamter Nachweis oder Teil). Die Zuordnung zum Wareneingang bleibt zusätzlich mit O4 abzustimmen. | Fachbereich                |
| 2   | Umsetzungsregeln zum externen Modus: Für Externe keine Anwesenheitserfassung, keine automatischen Ersatzwerte und entsprechende serverseitige Regeln, die solche Werte ablehnen. Das bloße Ausblenden von Feldern genügt nicht.                                                                  | Fachbereich, SAP, Recht/HR |
| 3   | Erhalt der Anwesenheitsfelder für einen späteren internen Modus: welche Daten benötigt werden, wie Bestandsdaten erhalten bleiben und wie die rechtliche Bewertung des Vorhaltens ausfällt. Nicht vorwegnehmen.                                                                                  | Fachbereich, SAP, Recht/HR |
| 4   | T2 Positions-`STATUS` neben einem Status am Nachweis                                                                                                                                                                                                                                             | SAP                        |
| 5   | T3 Sperre für die Kontingentprüfung: Sperrschlüssel und Transaktionsgrenze                                                                                                                                                                                                                       | SAP                        |
| 6   | E1 und E5 durch Recht/HR und Einkauf bestätigen; Arbeitnehmerüberlassung gesondert klären                                                                                                                                                                                                        | Recht/HR, Einkauf          |
| 7   | O4 Wareneingang: Bestellung und Position für die bestätigten Stunden, Verhalten bei Fehlern und Teilerfolgen, Wiederholung ohne Doppelbuchung                                                                                                                                                    | SAP, Einkauf               |
| 8   | O13 — Inhalt aus dem Entscheidungslog ergänzen                                                                                                                                                                                                                                                   | —                          |

### Auswirkungen auf xTS (laut Protokoll)

Zu prüfen, sobald die offenen Punkte entschieden sind. Keine Änderung wird vorab beauftragt.

- Entscheidung 14 (Arbeitszeit serverseitig als Geht − Kommt − Pause) trägt im externen Modus nicht mehr, da keine Anwesenheitsangaben erfasst werden. Für einen späteren internen Modus wäre sie erneut zu bewerten.
- Entscheidung 19 (gesamthafte Tagesfreigabe, Zuständigkeit je Kontierung) ist durch die monatliche Bestätigung zu überarbeiten. Der konkrete Zuschnitt hängt an offenem Punkt 1.
- Entscheidung 18 (Erfassungszeitraum, Monatsabschluss nach Regelwerk Infotyp 3) bleibt und trägt die Einreichfrist.
- Kontrakt `TimesheetDays`: Im externen Modus entfallen die Anwesenheits- und Abweichungsfelder; `location` bleibt optional. Ob der Status am Tag oder am Nachweis geführt wird, hängt an offenem Punkt 1.
- WebClient: Erfassung ohne Anwesenheitsfelder, Bestätigungsansicht entsprechend dem Bestätigungsobjekt. Betrifft die Redesign-Stories XTS-92 und XTS-93.
- Tests, Mock-API und ADR-0012 folgen dem entschiedenen Zuschnitt.

Unverändert bleiben Kontierungen, Positionen, Kontingentprüfung, Rollen und Zuständigkeiten, Reporting und die OData-Adapterschicht.

### Vereinbarungen

- Bis zur Klärung der offenen Punkte 1 bis 5 werden die Tabellen nicht umgebaut.
- PR #50 wird nicht als abschließendes Fachmodell gemergt. (Siehe Abschnitt 2.3: bereits gemergt, ausschließlich als vorläufige Gesprächsgrundlage.)
- E1 und E5 bleiben Vorschläge bis zur Bestätigung durch Recht/HR und Einkauf.

### Nächste Schritte (laut Protokoll, ohne Termine)

- Termin, Teilnehmer und Entscheidungsverantwortliche bestätigen
- Offenen Punkt 1 (Bestätigungsobjekt) entscheiden
- Offene Punkte 2 und 3 (Umsetzungsregeln, Erhalt der Felder) klären
- E1 und E5 mit Recht/HR und Einkauf abstimmen
- Ergebnis ins Entscheidungslog übernehmen
- Kontrakt, ADR-0012 und Backlog-Stories nachziehen

### Abweichungen der ersten 23.09.-Fassung (historisch)

| Gegenstand            | Erste Fassung 23.09.2026                                                       | Überarbeitete Fassung 23.09.2026                                                                           |
| --------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Termin und Teilnehmer | „23.09.2026, 11:00 Uhr · Teilnehmer: Stephan Schilz, Feyzi Göktaş, Momo"       | als „bitte bestätigen" geführt                                                                             |
| T1                    | „In der heutigen Form als Tageskopf nicht mehr erforderlich"                   | „offen. Aus E2 folgt nicht, dass dieselbe physische Tabelle weitergeführt werden muss."                    |
| Entscheidung 19       | „wird durch die monatliche Bestätigung abgelöst"                               | „ist durch die monatliche Bestätigung zu überarbeiten"                                                     |
| E2                    | „Die Anwesenheitsfelder werden ausgeblendet, nicht entfernt"                   | „Anwesenheitsangaben werden nicht erfasst … in der Oberfläche nicht angeboten"; Umsetzungsregeln offen     |
| E4                    | „Rhythmus der Bestätigung: Monatlich zum Monatsabschluss." Status: entschieden | „Zeitraum der Bestätigung … Damit ist der Zeitraum festgelegt, nicht das Bestätigungsobjekt." Objekt offen |

## 4. Repo-Kopie: Protokoll Folgetermin vom 24.09.2026

> Unveränderte Übernahme. Teilnehmer sind als „bitte bestätigen" geführt.

**Termin:** 24.09.2026 · **Teilnehmer:** [bitte bestätigen] · **Protokoll:** Momo · **Grundlage:** Protokoll vom 23.09.2026, Agenda vom 24.09.2026  
**Status:** Entscheidungsgrundlage, kein vollständiger Implementierungsauftrag. Mehrere bisher geltende Regeln werden abgelöst; die Ablösungen sind unten ausgewiesen und im Entscheidungslog nachzuziehen.  
**Projektkontext:** Konzeptphase, noch nicht fakturierbar; Stunden können vorerst nicht ausgeschrieben werden. Fertigstellung des Konzepts bis Ende Oktober angestrebt.

### Entscheidungen

| Nr.    | Thema                 | Ergebnis                                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2     | Erfasste Angaben      | Datum, Kontierung, Leistungsbeschreibung, Stunden. Kein zusätzliches Feld „Auftrag". Der Leistungsort kommt nach E6 hinzu.                                                                                                                                                                                                                                |
| E4     | Freigabe              | Zweistufig: E4.1 erste Freigabe (Stundenschluss) und E4.2 zweite Freigabe (kaufmännisch, Fakturierung). Zuordnung der einzelnen Aktionen siehe offener Punkt 1.                                                                                                                                                                                           |
| E4.1   | Ablauf                | Der Stundenschreiber gibt die Stunden zur Genehmigung frei. Der PM sieht sie und bestätigt oder weist zurück. Solange der PM nicht bestätigt hat, kann der Stundenschreiber weiter ändern. Nach PM-Bestätigung sind die Stunden gesperrt; nur der PM kann zurückweisen und damit wieder öffnen.                                                           |
| —      | Vertreterregelung     | Der Vertreter erhält dieselben Berechtigungen wie der Hauptverantwortliche. Kein Übergabeprotokoll.                                                                                                                                                                                                                                                       |
| Status | Statuslogik           | Der Status wird physisch nur auf Tagesebene gesetzt. Die Positionen leiten ihn ab: Time ist Eltern, Paytime ist Kind. Die Bestätigung eines Tages schließt alle Kontierungen dieses Tages, die Rückweisung wirft den ganzen Tag zurück. Positionsbezogene Freigabe wird bewusst nicht umgesetzt; Positionen erhalten keinen unabhängig änderbaren Status. |
| E5     | Dokumentationsfristen | Keine vertragliche Regelung vorhanden. Frist bis zum 20. des Monats ausgeschlossen (bis zu elf Tage Forecast-Vorlauf, Überzahlungen, Korrekturen im Folgemonat). Heutiger Umfang: keine technische Fristsperre. Kulanzfrist bis zum 3. des Folgemonats und E-Mail-Erinnerung sind R2, nicht heutiger Umfang.                                              |
| E6     | Leistungsort          | Wird benötigt, Feld ist in der Time-Tabelle vorhanden. Remote und Vor-Ort führen zu unterschiedlichen Stundensätzen, daher gegebenenfalls zwei Konditionssätze je Mitarbeiter und bis zu vier Bestellpositionen.                                                                                                                                          |
| —      | Budget                | Budgetwert läuft ins Controlling, nicht in POT. PM sieht den Geldtopf im CO-Report. POT bleibt Stundensicht, CO ist Wertsicht. Vorschlag: CO-Report in POT integrieren.                                                                                                                                                                                   |
| —      | Reisekosten           | Nicht im Stundenschreibungstool abbildbar.                                                                                                                                                                                                                                                                                                                |

### Dokumentarische Einordnung: rechtliche Prüfung

Im Termin wurde festgehalten, eine rechtliche Prüfung sei nicht erforderlich, weil der Aufbau der bestehenden Bestellung und dem Leistungsblatt entspricht und die Kontierung eine Controlling-Anforderung ist, auf die der Kostenträger belastet wird.

Festzuhalten als Aussage der verantwortlichen Person, nicht als von uns bestätigtes rechtliches Ergebnis:

- Verantwortliche Person: **Bestätigung ausstehend**
- Datum der Aussage: **Bestätigung ausstehend**
- Geltungsbereich: Aufbau des Leistungsnachweises (Felder, Bezug zu Bestellung und Leistungsblatt). Nicht ausdrücklich erfasst: Nutzergruppen einschließlich Arbeitnehmerüberlassung (E1).

Weder die Teilnahme am Termin noch das Protokolldatum belegt, wer diese Verantwortung übernommen hat. Die Aussage bleibt bis zur Bestätigung ohne Zuordnung.

**Bezug K30**: Klärung des Erfassungsmodells für externe Dienstleister gegenüber einem möglichen internen Anwesenheitsmodell. K30 betrifft Anwesenheitsfelder, berechnete Arbeitszeit und Abweichungsbegründung sowie die Folgen für Tageskopf, Validierung und SAP-Mapping. Zuständig sind Fachbereich, Recht und HR, Einkauf sowie PO; Datenschutz bei Bedarf. SAP-MM und Einkauf entscheiden darüber nicht allein. Die vorliegenden Festlegungen werden K30 zugeordnet; ein Abschluss setzt die bestätigte Entscheidung einschließlich Geltungsbereich voraus.

### Was bisherige Regeln ablöst

| Bisher                                                                                     | Künftig                                                                                                          | Nachzuziehen                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Status `F` sperrt den Tag für den Mitarbeiter                                              | Eingereichte Stunden bleiben bearbeitbar, bis der PM die Prüfung übernimmt                                       | Kontrakt, Validierung, Tests                                                                 |
| Status `G` ist final, genehmigte Tage sind nicht zurücksetzbar                             | PM-bestätigte Tage können durch den PM wieder geöffnet werden                                                    | Kontrakt; offen: Zulässigkeit nach WE-Buchung oder Fakturierung (offener Punkt 5)            |
| Entscheidung 18 mit Monatsabschlussregel (Regelwerk Infotyp 3) wird serverseitig erzwungen | Vorerst keine Fristsperre                                                                                        | Ablösung ausdrücklich im Entscheidungslog dokumentieren; Tag 3 und E-Mail-Erinnerung sind R2 |
| Entscheidung 19: gesamthafte Tagesfreigabe, Zuständigkeit je Kontierung                    | bleibt in der Sache erhalten                                                                                     | Ausbaustufe XTS-064 (positionsweise Genehmigung) entfällt bewusst                            |
| Entscheidung 14: Arbeitszeit serverseitig aus Kommt, Geht und Pause                        | Für diesen Erfassungsmodus neu zu bewerten: Kommt, Geht, Pause, berechnete Arbeitszeit und Abweichungsbegründung | Kontrakt, Oberfläche, Tests                                                                  |

### Offene Punkte

| Nr. | Punkt                                                                                                                                                                                                                                                                                                                                                                                                                                      | Zuständig                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 1   | E4.1/E4.2 und Monatsbezug. Einreichung durch den Stundenschreiber, PM-Bestätigung und kaufmännische Freigabe sind drei Aktionen; jede ist eindeutig E4.1 oder E4.2 zuzuordnen. Die früher genannte monatliche Bestätigung ist noch nicht eingeordnet: Werden Tage einzeln bestätigt, gesammelt als Monatsnachweis, oder erst kaufmännisch monatlich abgeschlossen?                                                                         | Fachbereich               |
| 2   | Sperre und geprüfter Datenstand. „Beim PM-Einstieg" braucht einen eindeutigen Auslöser, etwa „Prüfung übernehmen". Festzulegen: Ablauf der Sperre, Freigabe bei Abbruch, Verhalten beim Schließen des Browsers. Der Server muss verhindern, dass ein PM einen inzwischen geänderten Datenstand bestätigt. Getrennt von der weiterhin nötigen Kontingentprüfung über mehrere Tage.                                                          | SAP, Fachbereich          |
| 3   | Leistungsort und Bestellposition. Liegt der Leistungsort am Tag, gilt er für alle Positionen des Tages. Kann derselbe Tag Remote- und Vor-Ort-Leistungen enthalten? Falls ja, reicht ein einziges Tagesfeld für die Satzzuordnung nicht; die eindeutige Zuordnung zur Bestellung muss dann neben Mitarbeiter, Kontierung und Datum auch den abrechnungsrelevanten Leistungsort beziehungsweise Leistungstyp berücksichtigen. Gehört zu O4. | Fachbereich, Einkauf, SAP |
| 4   | Zielsystem und Tabellenbezeichnungen. Die Bezeichnung „S/4-Portal" ersetzt Entscheidung 17 (SAP ECC mit klassischem Gateway, OData V2) für sich genommen nicht. Zuerst zu klären: Ist ein Referenzprozess gemeint, eine Oberfläche vor ECC, oder tatsächlich ein anderes Zielsystem? Erst danach ist zu bewerten, ob Entscheidung 17 berührt ist. Ebenso `Z_POT_TIME`/`Z_POT_PAYTIME` gegen `ZPOT_TIME_T`/`ZPOT_PTIME_T` bestätigen.       | Fachbereich, SAP          |
| 5   | Wiederöffnen nach WE-Buchung oder Fakturierung. Was ist zulässig, wenn ein bestätigter Tag bereits zu einem Wareneingang oder zu einer Rechnung geführt hat? Storno oder Korrekturbeleg können erforderlich sein; welche Folgeaktion nötig ist, hängt von der Änderung, vom Buchungsstand und vom bestätigten Verfahren ab. Eine Wiederöffnung darf bestehende Buchungen nicht stillschweigend verändern. Berührt O4.                      | Fachbereich, Einkauf, SAP |
| 6   | Felder im Tageskopf. Neben dem Status werden Rückweisungsgrund, Bestätiger (als EXTNR) und Zeitstempel benötigt; ob zusätzliche Felder für die zweite Stufe nötig sind, hängt an Punkt 1.                                                                                                                                                                                                                                                  | SAP                       |
| 7   | T3 Sperre für die Kontingentprüfung                                                                                                                                                                                                                                                                                                                                                                                                        | SAP                       |
| 8   | E1 Nutzergruppen, insbesondere Arbeitnehmerüberlassung                                                                                                                                                                                                                                                                                                                                                                                     | Fachbereich, Recht/HR     |
| 9   | CO-Report in POT integrieren; Verhältnis zum bestehenden Budget-Monitor klären, der sein Budget heute aus der Beauftragung ableitet                                                                                                                                                                                                                                                                                                        | Fachbereich, Controlling  |
| 10  | O4 Wareneingang und O13                                                                                                                                                                                                                                                                                                                                                                                                                    | SAP, Einkauf              |

### Konsequenzen für xTS (laut Protokoll)

- Kontrakt: Sperrverhalten bei `F` und Finalität bei `G` ändern sich (siehe Ablösungstabelle). Eine zweite Freigabestufe kommt hinzu, sobald Punkt 1 entschieden ist. Anwesenheitsfelder und Abweichungsbegründung sind für diesen Modus neu zu bewerten.
- Freischaltung und Kontingent: Sind Remote und Vor-Ort getrennte Bestellpositionen, werden Kontingente je Position geführt. Das berührt `MyEnabledCostObjects`, den Kontingent-Monitor und die Prüfung beim Speichern.
- Reporting: Budget bleibt im CO; die Zukunft des Budget-Monitors in POT ist Punkt 9.
- Neue Anforderung ohne Story: E-Mail-Erinnerung bei offenen Nachweisen (R2).
- Tests und Mock-API folgen dem entschiedenen Zuschnitt; ADR-0012 wird erst nach den Punkten 1 bis 6 neu geschnitten.

### Nächste Schritte (laut Protokoll, ohne Termine)

- E4-Split dokumentieren und die drei Aktionen eindeutig zuordnen (Punkt 1)
- Sperr-Logik festlegen: Auslöser, Ablauf, Abbruch, Schutz vor veraltetem Datenstand (Punkt 2)
- Zielsystem und Tabellennamen bestätigen (Punkt 4)
- Konditionssatz-Konzept Remote/Vor-Ort prüfen; gemischte Tage klären (Punkt 3)
- Ablösung von Entscheidung 18 im Entscheidungslog dokumentieren; Tag 3 und E-Mail als R2 vormerken
- Aussage zur rechtlichen Prüfung durch Person und Datum bestätigen lassen; K30-Eintrag entsprechend ändern
- Danach Kontrakt, ADR-0012 und Backlog-Stories nachziehen
