# Release-Zuschnitt: Stundenerfassung in xTS, Verarbeitung in SAP

Stand: 2026-09-26. Vom Auftraggeber im Projektgespraech bestaetigt; dokumentiert als Entscheidung 23. Eine technische Umstellung ist mit diesem Doku-PR noch nicht erfolgt.

## Verbindlicher Umfang des aktuellen Releases

| Funktion                       | xTS-Frontend                                                          | SAP                                                   |
| ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Leistungsstunden               | Erfassen, speichern und zur Genehmigung einreichen                    | Fuehrende Speicherung und Validierung                 |
| Planung                        | Vorhandene SAP-Planung lesend anzeigen                                | Pflegen und freigeben                                 |
| Genehmigung                    | Zurueckgemeldeten Status und verfuegbaren Rueckweisungsgrund anzeigen | Genehmigen, zurueckweisen und Status bereitstellen    |
| Beauftragung, BANF, Bestellung | Vorhandene SAP-Belege und Belegkette lesend anzeigen                  | Anlegen, bearbeiten und verarbeiten                   |
| Wareneingang (WE)              | SAP-Buchungsstand lesend anzeigen                                     | Buchen und gegebenenfalls korrigieren                 |
| Reporting                      | Berechtigte Daten lesend darstellen                                   | Fuehrende Plan-, Genehmigungs- und Belegdaten liefern |

SAP ist fuer den Genehmigungsstatus fuehrend. Das Frontend darf eine Genehmigung weder selbst setzen noch aus einem erfolgreichen Speichern ableiten. Wie SAP Aenderungen bereitstellt (Abruf, Aktualisierung oder Push), ist noch abzustimmen. Keine bestimmte Push-Technik ist mit "SAP sendet den Status" beschlossen.

## Vorhandener Code und spaeterer Release

Die bereits implementierten Planungseditoren, Planfreigaben, Genehmigungs-/Rueckweisungsaktionen, Beauftragungsanlage, BANF-Textpflege, BANF-Anlage und WE-Ausloeser werden **nicht geloescht**. Sie bleiben fuer einen spaeteren Release erhalten, sind aber im aktuellen Release nicht verfuegbar. Eine spaetere Aktivierung braucht einen eigenen Auftrag und neue Abnahme; es gibt noch keine Release-Nummer oder Terminfreigabe dafuer.

Fuer den aktuellen Release muessen sowohl UI-Ausloeser als auch die zugehoerigen schreibenden API-Pfade serverseitig gesperrt sein. Dies gilt auch fuer Administratoren, direkte HTTP-Aufrufe, alte Clients und indirekte Ausloeser wie WE-Buchung nach Genehmigung. Ein clientseitiger Schalter allein reicht nicht. Die technische Form der Release-Steuerung ist noch festzulegen; Rollenberechtigung allein darf die Release-Sperre nicht umgehen.

Lesende Ansichten, Filter, Rollen-/Zustaendigkeitsschnitt, Lade-/Fehlerzustaende, Retry, barrierefreie Bedienung und Schutz vor ueberholten Antworten bleiben erhalten. Ein Status-Refresh darf ausschliesslich lesen. Der bisherige Mock-Bestelldaten-Job darf nicht als harmloser Refresh umetikettiert werden, wenn er den Belegstand veraendert.

**Ist-Zustand:** Der vorhandene Mock und das Frontend bieten die weitergehenden Schreibfunktionen noch an. Der aktuelle Code ist deshalb noch nicht releasekonform. Diese Dokumentation behauptet weder deaktivierte Endpunkte noch eine fertige SAP-Anbindung. Historische Tests pruefen den bisherigen Vollumfang; neue Release-Tests sind erst noch umzusetzen.

## Was diese Entscheidung nicht festlegt

- Die genauen Erfassungsfelder, Nutzergruppen und Anwesenheitsregeln bleiben Gegenstand von K30. "Nur Stunden erfassen" ist keine Entscheidung fuer ein unzugeordnetes Zahlenfeld und keine automatische Entfernung von Datum, Kontierung, Beschreibung oder Leistungsort.
- Die fachlichen Statusuebergaenge, Bearbeitbarkeit nach Einreichung, Pruefsperre, Wiederoeffnung und kaufmaennische Monatsfreigabe sind weiter abzustimmen. Bis zur gesonderten Aenderung beschreibt der vorhandene Kontrakt die implementierten Regeln.
- Einstellungen, Stammdaten- und Regelwerkspflege sowie technische Testdaten-Resets sind durch diesen Beschluss nicht pauschal freigegeben oder abgeschafft. Ihr Zugang im ausgelieferten Release ist gesondert abzugrenzen.
- O4 bleibt fuer die SAP-seitige Buchung, Bestellpositionszuordnung und Rueckmeldung relevant. Die bisher vorgeschlagene Buchungsausloesung aus xTS ist fuer diesen Release abgeloest. Rueckmeldung und Nachvollziehbarkeit bleiben erforderlich.
- O13 bleibt offen, ADR-0012 bleibt Proposed. K30 sowie O5, O6, O7, O9 und O12 werden nicht automatisch geschlossen. O9 und O12 duerfen insbesondere keine schreibenden Frontend-Funktionen fuer den aktuellen Release legitimieren.
- Entscheidung 17 (ECC/OData V2) bleibt bestehen. Der Release-Zuschnitt ist keine Migration zu S/4.
- Entscheidungen 14 und 18 werden dadurch nicht fachlich geaendert. Entscheidung 19 bleibt als fachlicher Bezug fuer die SAP-Genehmigung erhalten; ihre Frontend-Aktionen sind im aktuellen Release ausgeschlossen.

## Vorrang und historische Quellen

Dieser Release-Zuschnitt und Entscheidung 23 bestimmen, **welche Funktionen ausgeliefert werden duerfen**. Der OData-Kontrakt dokumentiert weiterhin den implementierten Schnittstellenstand, bis ein gepruefter technischer Aenderungs-PR folgt. Bei Abweichung ist der Code anzupassen und zu testen; keine stillschweigende Auslieferung des alten Vollumfangs.

Konzept, Audit, Design-Baseline, alte Stories und Protokolle bleiben als Implementierungs- und Entscheidungshistorie erhalten. Aussagen wie "xTS legt BANF an", "Planung speichern" oder "WE nach Genehmigung" beschreiben dort den bisherigen Vollumfang beziehungsweise eine spaetere Ausbaustufe, nicht den aktuellen Release-Auftrag. Die Erhaltungspflicht der Design-Baseline verlangt Code-Erhalt, nicht die Sichtbarkeit der ausgeschlossenen Aktionen.

## Abzuleitende Arbeitspakete

Die Kennungen RLS-01 bis RLS-05 sind lokale Vorschlaege, keine angelegten Jira-Stories. Bestaetigt ist der Release-Umfang; konkreter technischer Zuschnitt, Reihenfolge und Code-PRs sind noch abzustimmen. Dieser Auftrag betrifft Dokumentation, nicht die Ausfuehrung dieser Pakete.

Zuschnitt RLS-01 zur Pruefung (ohne Umsetzungsfreigabe): [RLS-01: Release-Steuerung und serverseitige Schreibsperren](rls-01-zuschnitt.md). Die Sperre gilt fuer Zugriffe aus xTS; produktiv gehoert sie in die Middleware, der Mock ist die Referenz.

| Paket  | Inhalt                                                 | Abnahmekriterien                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RLS-01 | Release-Steuerung und serverseitige Schreibsperren     | Ausgeschlossene Operationen auch bei direktem Aufruf/alten Clients/Admin abgelehnt; kein Seiteneffekt; bestehende Implementierung fuer spaeter erhalten                                                            |
| RLS-02 | Planung und Belegansichten lesend                      | Kein Planeditor, keine Planfreigabe, Beauftragungsanlage, BANF-Textpflege oder BANF-Anlage; SAP-Daten mit Filter, Status, Retry und Rollenfilter sichtbar                                                          |
| RLS-03 | SAP-Genehmigungsstatus statt Frontend-Genehmigung      | Keine Genehmigungs-/Rueckweisungsaktion, kein WE-Ausloeser; Status aus SAP anzeigen; unbekannter/fehlender/fehlgeschlagener Status nicht als genehmigt darstellen                                                  |
| RLS-04 | SAP-Lesekontrakt und Statusabgleich                    | Identitaet, Zuordnung, Aktualitaet, Statusmapping und Fehlerfaelle dokumentiert und getestet; Transportweg abgestimmt; keine unbeabsichtigte Schreiboperation beim Refresh                                         |
| RLS-05 | Release-Abnahme und Erhaltung der spaeteren Funktionen | Beide Antwortformen pruefen; Rollenmatrix inkl. Admin, direkte API-Negativtests, Nebenwirkungen, veraltete Antworten/Identitaetswechsel; separate Regression fuer erhaltenen Vollumfang in isolierter Testumgebung |

Die Abnahme darf bestehende Demo-Daten nicht unangekuendigt zuruecksetzen. Lokale Server auf 4200/4010 bleiben bis zur Abstimmung unangetastet. Build und Testnachweise muessen den tatsaechlichen neuen Release-Modus pruefen, nicht nur gruene Tests des alten Vollumfangs.

## Referenzen

- [Entscheidungslog](entscheidungen-v0.1.md)
- [Entwickler-Uebergabe](entwickler-uebergabe.md)
- [Zuschnitt RLS-01](rls-01-zuschnitt.md)
- [Backlog](backlog-v0.1.md)
- [Implementierter OData-Kontrakt](odata-contracts.md)
- [Protokolle 23./24.09.](leistungsnachweis-externe-protokolle.md)
