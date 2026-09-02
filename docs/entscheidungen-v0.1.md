# xTS Entscheidungen v0.1

Stand: 2026-05-08  
Quelle der Antworten: `xTS Offene Entscheidungen v0.docx` und `xTS Entwicklungskonzept v0.docx`

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

Offener Folgepunkt:

- Welches AD/OAuth-Attribut das Mapping traegt, ist noch nicht entschieden.
  Entscheidungsvorlage mit Optionen und Empfehlung:
  [entscheidungsvorlage-extnr-mapping.md](entscheidungsvorlage-extnr-mapping.md)
- Entschieden am 2026-09-02: **Option B** (Entra `oid` als `AAD_OID`,
  `AAD_UPN` als Fallback). WebClient meldet ueber Entra ID (MSAL) an, die
  Mock-API mappt Bearer-Token-Claims; Anleitung und offene SAP-Punkte in
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
