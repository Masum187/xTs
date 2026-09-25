# xTS: Entwickler-Uebergabe

Stand: 2026-09-25. Gepruefter lokaler Ausgangsstand: `main`, Commit `4a3eb78a822d2972a81d6b3264684061a4ecc212` (Squash-Merge PR #53). Vor Erstellung dieser Uebergabe war der Arbeitsbaum sauber. Diese Angaben sind eine Momentaufnahme, keine Aussage ueber spaetere Commits.

**Wichtig:** Implementierter Stand, Protokollstand und freigegebene Arbeit sind unterschiedliche Dinge. Diese Uebergabe erteilt keine Freigabe fuer neue Fachfunktionen, SAP-Implementierung oder die unten genannten offenen Stories.

## 1. Projekt in Kurzform

xTS unterstuetzt Ressourcenplanung, Beauftragung, Stundenschreibung, Genehmigung und Reporting externer Ressourcen. Die Prozesskette im Mock lautet: Planung -> Planfreigabe -> Beauftragung -> BANF -> Bestellung -> Stundenschreibung -> Tagesgenehmigung -> simulierter Wareneingang.

- Repository: [Masum187/xTs](https://github.com/Masum187/xTs).
- Frontend: Angular 22, TypeScript 6, Standalone Components, Signals und OnPush.
- Backend fuer lokale Entwicklung: Node-Mock-API mit In-Memory-Daten und Contract-Tests. Kein produktives Persistenz- oder Berechtigungssystem.
- Zielintegration laut geltender Entscheidung 17: SAP ECC, klassisches Gateway, OData V2. Die Bezeichnung "S/4-Portal" im Folgeprotokoll aendert diese Entscheidung nicht.
- Entra-Anmeldung ist im Frontend vorbereitet; echte SAP-Tokenvalidierung, Gateway-Mapping und SAP-seitige Umsetzung sind noch ausstehende Integrationsarbeit. Ein gruener Mock-Test beweist keine SAP-Integration.
- Alle sechs Screens sind im Modernist-Design migriert, einschliesslich der Einstellungen mit Unterseiten. Planung zeigt die kontierungsuebergreifende Auslastung und lesende Mock-Monatskapazitaet.
- Laut Folgeprotokoll: Konzeptphase, noch nicht fakturierbar. Ziel Ende Oktober 2026; konkreten Lieferumfang, Abnahmekriterien und Verbindlichkeit des Termins vor einer Aufwandzusage mit dem PO bestaetigen.

## 2. Quellen und Lese-Reihenfolge

1. Diese Uebergabe, danach [README](../README.md) fuer Stack und Einstieg.
2. [Entscheidungslog](entscheidungen-v0.1.md) und [OData-Kontrakt](odata-contracts.md): geltende Regeln und Schnittstelle. Als "nicht geltend" markierte Vorschlaege sind keine Implementierungsvorgabe.
3. [Testdaten und UAT](testdaten-uat-v0.1.md) zusammen mit der laufenden Anwendung.
4. [Design-Baseline](design-baseline-xts-140.md), [Tokens](design-tokens.md) und [Backlog](backlog-v0.1.md): Erhaltungspflichten, Test-IDs, Stories und Freigabestatus. Konzept-Story-IDs und Jira-Keys nicht gleichsetzen; die Zuordnung steht im Backlog.
5. [Audit](audit-2026-09-03.md) und [Development Workflow](development-workflow.md).
6. [O4-Vorlage](entscheidungsvorlage-we-bestellposition.md), [ADR-0012](adr/0012-sap-zieltabellen-zpot-time.md) und [Klaerungsliste K1 bis K30](klaerungsliste-o4-adr-0012.md).
7. [Fachmodell Tag und Monat](fachmodell-tag-monat.md) und [Protokolle mit Abgleich](leistungsnachweis-externe-protokolle.md): vorlaeufige Gespraechsgrundlagen, kein abschliessend bestaetigtes Zielmodell fuer Externe.

Das [Entwicklungskonzept](entwicklungskonzept-v0.1.md) ist eine historische Baseline mit Abweichungshinweisen. Einzelne README- und UAT-Formulierungen nennen noch fruehere UI-Staende (z.B. "Verwaltung" statt "Einstellungen" oder Redesign noch nicht angewendet). Daraus keine Rueckbauanforderung ableiten. Bei Widerspruechen geltenden Kontrakt, Entscheidungsstatus und Code vergleichen und den PO um Klaerung bitten; nicht stillschweigend eine neue Fachregel waehlen.

## 3. Kontakte und Zugaenge vor Uebergabe ergaenzen

Namen, Kontaktdaten und Rechte wurden nicht als verbindliche Zustaendigkeiten geliefert. Die folgende Liste muss mit dem Projektverantwortlichen vervollstaendigt werden. Test-Personas sind keine Liste realer Ansprechpartner.

| Verantwortung / Zugang                   | Zu hinterlegen                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| PO, Priorisierung und fachliche Freigabe | Name, Kontakt, Vertretung: **offen**                                                   |
| Technisches Review und Merge             | Name, Kontakt, Vertretung: **offen**                                                   |
| GitHub                                   | Einladung zum privaten Repo, benoetigte Rechte, Branch Protection pruefen              |
| Jira und Confluence                      | Projekt-/Space-Links, Einladung, fuehrende Dokumente: **offen**                        |
| SAP-Entwicklung / Gateway / Basis        | Ansprechpartner, System, Mandant, Service-URL, VPN, Transportweg: **offen**            |
| SAP-MM und Einkauf                       | Verantwortliche fuer O4, Bestellposition und Buchungsverfahren: **offen**              |
| Fachbereich und Controlling              | Verantwortliche fuer Freigabeprozess und Kennzahlen: **offen**                         |
| Recht, HR und gegebenenfalls Datenschutz | Verantwortliche fuer K30 und bestaetigten Geltungsbereich: **offen**                   |
| Entra / IT                               | App-Registrierung, Tenant-/Client-ID, Redirect-URIs, Testzugang: **offen**             |
| Betrieb und Bereitstellung               | Zielumgebung, Verantwortlicher, Deployment- und Wiederherstellungsverfahren: **offen** |

Zugangsdaten ausschliesslich ueber den freigegebenen Passwort-/Secret-Kanal uebergeben. Keine Tokens, Passwoerter oder produktiven Personendaten ins Repo oder in PR-Texte schreiben. Fuer Entra siehe [Anbindungsanleitung](entra-anbindung.md); der Mock-Persona-Header ist kein produktiver Authentifizierungsnachweis.

## 4. Lokal starten

Alle Befehle ab Repository-Wurzel, fuer macOS/Linux. Node entsprechend `.nvmrc` verwenden (Node 24; CI verwendet ebenfalls 24). Die genauen erlaubten Versionen stehen in `package.json`.

```bash
nvm use
npm ci
git config core.hooksPath .githooks
npx playwright install chromium
```

Falls nvm nicht installiert ist, Node auf anderem freigegebenem Weg in passender Version bereitstellen. Bei Fehlern von `npm ci` die Ursache pruefen; nicht ungefragt Lockfile oder Abhaengigkeiten neu erzeugen.

Terminal 1, Mock fuer die vorhandenen Testdaten:

```bash
XTS_TODAY=2026-05-05 npm run start --workspace mock-api
```

Terminal 2, Frontend:

```bash
npm run start --workspace frontend
```

Frontend: `http://localhost:4200`. Mock-Health: `http://127.0.0.1:4010/health`. Health meldet Antwortform und Systemdatum. Die Frontend-Proxy-Konfiguration verbindet die lokalen Dienste.

V2-Antwortform: eigenen Mock vorher beenden, dann starten:

```bash
XTS_TODAY=2026-05-05 npm run start:v2 --workspace mock-api
```

Echte Entra-Anmeldung nur nach Konfiguration gemaess Anleitung:

```bash
npm run start:entra --workspace frontend
```

### Testdaten und typische Stolperstellen

- Schilz: Stundenschreiber. Roeper: Stundenschreiber, Planer, Genehmiger und Admin. Weber: Genehmigerin mit eingeschraenkter Zustaendigkeit. Krause: Controlling. Altmann: inaktiv. "Neuer Externer": fehlendes Mapping. Vollstaendige Zuordnung steht im Testdaten-Dokument.
- `XTS_TODAY=2026-05-05` ist ein Test-Stichtag, keine Empfehlung fuer Produktivbetrieb. Ohne Vorgabe greift das aktuelle Systemdatum; historische Fixture-Tage koennen dann durch die geltende Datumsregel gesperrt sein.
- Mock-Daten sind fluechtig. Neustart oder Testdaten-Reset verwirft lokale Aenderungen.
- Smoke-Tests setzen die Daten vor jedem Test zurueck. Nicht gegen eine von anderen genutzte Demo-/UAT-Instanz laufen lassen; lokale Server vorher abstimmen.
- Playwright startet fehlende Server selbst. Wiederverwendete Server muessen zum erwarteten Datum und Antwortformat passen, sonst bricht das Setup ab. Fuer Mock- und V2-Lauf am einfachsten eigene manuell gestartete Server vorher beenden; keine fremden Prozesse stoppen.
- Aenderungen an Asset-/Build-Konfiguration koennen einen Neustart des Dev-Servers erfordern.
- Die "Monatskapazitaet (Mock)" ist eine Monatsstundentabelle mit Vorgabewert, kein echter Werkkalender. Arbeitstage und Feiertage sind nicht verfuegbar und duerfen nicht aus Stundenwerten erfunden werden.

## 5. Architekturkarte

| Bereich                                          | Einstieg im Repo                                                                                                                                                     | Verantwortung                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Shell und Routing                                | `frontend/src/app/app.component.ts`, `app.routes.ts`                                                                                                                 | Navigation, Auth-Zustaende, mobile Fokusfalle; Startscreen direkt, andere Screens lazy |
| Identitaet und Rollen                            | `frontend/src/app/auth/`                                                                                                                                             | Entra, Profil, Persona, Rollen-Guard; Mapping ueber OID, UPN-Fallback                  |
| Transport und Pruefung                           | `frontend/src/app/shared/odata-http.ts`, `decode.ts`, `api-error.ts`                                                                                                 | Mock-/V2-Antworten, Paging, Decoder, einheitliche Fehler                               |
| Gemeinsame Zustaende                             | `shared/async-state.ts`, `unsaved-changes.service.ts`, `approval-badge.service.ts`                                                                                   | Ueberholte Antworten verwerfen, Aktionsschutz, Entwurfsschutz, Badge                   |
| Stundenschreibung                                | `frontend/src/app/timesheet/`                                                                                                                                        | Tageseditor, `timesheet-day.store.ts`, Datum/Fenster/Cache, Validierung                |
| Genehmigung / Planung / Beauftragung / Reporting | `frontend/src/app/approval/`, `planning/`, `orders/`, `reporting/`                                                                                                   | Jeweils Komponenten, Services, Modelle und testbare Logik                              |
| Einstellungen                                    | `frontend/src/app/settings/`, `frontend/src/app/admin/`                                                                                                              | Unterseiten und Aktions-/Navigationssperre; gemeinsame Stammdaten-Services             |
| Design                                           | `frontend/src/design-system.css`, `frontend/src/styles.css`                                                                                                          | Opt-in-Bausteine, Tokens, lokal gehostete Schrift; screen-lokale Layouts               |
| Mock                                             | `mock-api/src/server.js`, `routes.js`, `fixtures.js`                                                                                                                 | HTTP, Routing, In-Memory-Testdaten                                                     |
| Mock-Fachregeln                                  | `timesheet-validation.js`, `timesheet-window.js`, `enablement.js`, `planning.js`, `orders.js`, `reporting.js`, `lifecycle.js`, `masterdata.js` unter `mock-api/src/` | Validierung, Zeitraum, Kontingente, Planung, Belegkette und Reporting                  |
| SAP                                              | `sap/`, insbesondere `sap/ddic/` und `sap/odata/`                                                                                                                    | Integrationsdokumentation; keine fertig implementierte ABAP-Loesung                    |

Backendantworten werden feldweise decodiert; keine blinden Typumwandlungen als Ersatz fuer Laufzeitpruefung. Dezimalstunden an der Schnittstelle, Berechnungen ueber ganze Minuten. V2-Folgeseiten duerfen nur auf dieselbe Origin unterhalb des Service-Roots zeigen; Identitaetswechsel darf keine Seiten verschiedener Identitaeten vermischen.

## 6. Geltende Regeln nicht versehentlich aendern

- Tagesstatus: E = Entwurf, F = freigegeben, G = genehmigt, A = zurueckgewiesen. Mitarbeiter bearbeiten E/A; F/G sind heute gesperrt. Nach Speichern eines zurueckgewiesenen Tages wird dessen aktueller Rueckweisungsgrund entfernt.
- Entscheidung 14 gilt: Arbeitszeit wird serverseitig aus Kommt, Geht und Pause berechnet. Bei abweichender Positionssumme braucht die Freigabe eine Begruendung. Fuer Externe ist die kuenftige Regel offen, nicht bereits abgeschafft.
- Entscheidung 18 gilt: laufender Monat plus Vormonat bis zum konfigurierten Abschlusstag (Fixture: 5), Zukunft gesperrt. Inaktive Monatsabschlussregel laesst den Vormonat den ganzen Monat offen. Keine eigenmaechtige Umstellung auf Tag 3 oder Abschaltung der Sperre.
- Entscheidung 19 gilt: gesamthafte Tagesgenehmigung, Zustaendigkeit je Kontierung. Eine passende Zustaendigkeit berechtigt zur Genehmigung des ganzen Tages; alle Positionen bleiben sichtbar. Vier-Augen-Prinzip gilt auch fuer Vertreter.
- Erfassungspositionen: Viertelstundenraster, Tagessumme maximal 24 Stunden. Planung: ganze Minuten, 0 bis 744 Stunden, gueltige Teamzuordnung bei Speichern und Freigabe.
- Kontingent: qualifizierende Beauftragungen je Mitarbeiter/Kontierung minus gebuchte Stunden in E/F/G; A verbraucht kein Kontingent. Beim Upsert wird die bisherige Fassung desselben Tages herausgerechnet. Die Anzeige beinhaltet dagegen bereits gespeicherte Stunden. Genaue Aggregation und Gueltigkeitshuellen siehe Fachmodell Abschnitt 5 und `enablement.js`.
- SAP muss die Kontingentpruefung ueber mehrere Tage atomar schuetzen. Diese Sperre ist von Tagesversion/ETag und WE-Idempotenz zu unterscheiden; der Single-Thread-Mock ersetzt diese Nachweise nicht.
- WE im Mock ist simuliert. `weDocument` bedeutet weiterhin "ganzer Tag gebucht"; keinen ersten Teilbeleg hineinschreiben und dadurch offene Stunden als gebucht zaehlen.
- Ladefehler sind keine leeren Listen oder Nullwerte. Aktionssperren, Retry, getrennte Datenquellen, verworfene alte Antworten, Identitaetswechsel und Schutz ungespeicherter Eingaben erhalten.
- Labels, Test-IDs, Rollenfilter, barrierefreie Bedienung und mobile Layouts sind Teil der Design-Baseline, nicht bloss optische Details.

## 7. Offene Entscheidungen und Grenzen

| Punkt | Noch zu entscheiden / bestaetigen                                                                                                                                                  | Beteiligte                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| O4    | Bestellposition, WE-Ausloeser und -Granularitaet, Transaktionsgrenzen, Teil-/Fehlerfaelle, Wiederholung und Doppelbuchungsschutz; Wiederoeffnung gebuchter oder unklarer Vorgaenge | SAP-MM, Einkauf, Fachbereich und Entwicklung je Fragestellung  |
| O5    | Ueberplanung: Warnung oder Blockade; heute Warnung                                                                                                                                 | Ressourcenmanagement                                           |
| O6    | Rollen aus AD-Gruppen und Pflegeprozess fuer Identitaetsmapping                                                                                                                    | IT, Administration                                             |
| O7    | Status L / Loeschsemantik fuer Stundenzettel und Planung                                                                                                                           | Fachbereich                                                    |
| O9    | Manuelle BANF-Ausloesung oder Automatik                                                                                                                                            | Ressourcenmanagement, Einkauf, SAP-MM                          |
| O12   | Ruecknahme von Planungsstatus F/P/B nach V mit Belegfolgen                                                                                                                         | Fachbereich, Einkauf, SAP                                      |
| O13   | ZPOT-Zieltabellen, Schluessel, fehlende Persistenzfelder und Mapping; ADR-0012 bleibt Proposed                                                                                     | SAP- und xTS-Entwicklung mit fachlicher Bestaetigung           |
| K30   | Nutzergruppen und Leistungsnachweis fuer Externe, Anwesenheitsfelder, Arbeitszeitvergleich und Abweichungsgrund                                                                    | Fachbereich, Recht und HR, Einkauf, PO; Datenschutz bei Bedarf |

Die Protokolle vom 23./24.09. sind im Repo erhalten und abgeglichen. Noch nicht als neue Implementierungsvorgabe behandeln:

- Bearbeitung eingereichter Tage bis zur PM-Pruefung und deren konkreter Sperrausloeser, Ablauf und Abbruch.
- E4.1/E4.2: Zuordnung von Einreichung, PM-Bestaetigung und kaufmaennischer Freigabe; Monatsbezug.
- Wiederoeffnung nach Genehmigung, WE oder Fakturierung. Buchungsnachweis und Doppelbuchungsschutz duerfen dabei nicht zurueckgesetzt werden.
- Wegfall der Fristsperre und gegebenenfalls spaetere Kulanzfrist bis Tag 3 mit E-Mail-Erinnerung.
- Remote/Vor-Ort, gemischte Tage, Konditionssaetze und eindeutige Bestellpositionszuordnung. Kontingente je Bestellposition sind eine eigene Entscheidung.
- Die Aussage "rechtliche Pruefung nicht erforderlich" hat noch keine bestaetigte verantwortliche Person und kein bestaetigtes Datum. Sie ist keine durch die Entwicklung erteilte rechtliche Freigabe.

Fachlich im Folgeprotokoll beantwortete ADR-Fragen sind nicht automatisch technisch umgesetzt oder geschlossen. `Accepted` erst nach erfuellten und bestaetigten Annahmekriterien. Fuer den ersten echten Gateway-Service bleiben ausserdem CSRF-Handshake, ETag/If-Match und Filterabbildung mit SAP zu vereinbaren.

## 8. Offene Arbeitspakete, keine automatische Beauftragung

| Story   | Stand / Voraussetzung                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| XTS-024 | Teil 1 Monatskapazitaet in Planung umgesetzt; lesende Admin-Unterseite offen und nicht freigegeben. Story insgesamt nicht abgeschlossen |
| XTS-073 | Vor UI-Umsetzung Kennzahlen mit Controlling/Projektleitung definieren; auch Doku-Arbeit explizit beauftragen                            |
| XTS-074 | Optionaler Pivot/Diagramm; abhaengig von Kennzahldefinitionen                                                                           |
| XTS-083 | Integrationsstatus braucht echte Betriebsdaten, keine erfundenen Beispielzustaende                                                      |
| XTS-084 | Jobstatus; Betriebsdaten und Rollen-/Startrechte beachten                                                                               |
| XTS-158 | Mock-API-Zerlegung; nachrangig, nicht freigegeben                                                                                       |
| XTS-159 | App-Shell-Struktur; nachrangig, nicht freigegeben                                                                                       |

SAP-Epics 9/14 und XTS-061A sind kein impliziter Folgeauftrag dieser Uebergabe. Audit-Schritt 15 Teil B bleibt wegen XTS-158/159 teilweise offen; Befund 34 haengt an O4. XTS-156 bleibt die begleitende Abnahmecheckliste. Vor jeder Story aktuellen Backlog, Abhaengigkeiten und ausdrueckliche Freigabe pruefen.

## 9. Pruefungen und Merge-Verfahren

```bash
npm run precommit
npm run ci
npm run test:smoke
npm run test:smoke:v2
```

- `precommit`: Format, Lint, Typecheck, Frontend-Unit- und Mock-Contract-Tests.
- `ci`: zusaetzlich Doku-Linkpruefung und Produktions-Build, **keine Smoke-Tests**. Der GitHub-Workflow fuehrt beide Smoke-Varianten als weitere Schritte aus.
- Frontend-Tests liegen neben der Logik, Mock-Tests unter `mock-api/test/`, E2E unter `frontend/e2e/`. E2E nutzt eine gemeinsame Reset-Fixture und einen Worker; nicht ungeprueft parallelisieren.
- Produktions-Build: Warnschwelle 500 kB, Fehlergrenze 1 MB. Aktuelle Groesse messen, nicht alte Angaben als neuen Build-Nachweis ausgeben.
- Die Befehle oben sind eine Anleitung. Fuer diese reine Uebergabedokumentation wird kein neuer fachlicher Volltestlauf behauptet. Testzahlen aendern sich; beim eigenen Abnahmelauf Commit, Befehle und Ergebnisse dokumentieren.

Feature-Arbeit auf eigenem Branch, kein direkter Commit auf main. Ein abgegrenzter Auftrag je PR, relevante Tests und Doku mitliefern. Merge erst nach Review-Freigabe und gruenem Required Check `Quality Gate`, per Squash. Vollstaendigen Head abfragen, nie einen Kurz-Hash ergaenzen:

```bash
gh pr view <PR-NUMMER> --json headRefOid
```

Bei neuen Commits pruefen, ob Review und Checks noch fuer den freizugebenden Head gelten. Zusaetzliche Agenten-Checks ersetzen das menschliche Review nicht. Bei ausbleibender CI zuerst PR-Konflikte und Workflow-Ereignisse pruefen; Branch Protection nicht umgehen. Keinen selbststaendigen Merge ohne entsprechende Freigabe.

## 10. Erster Einarbeitungsauftrag und Uebergabeabnahme

**Vorschlag zur Einarbeitung, keine fachliche Aenderungsstory:** Projekt lokal aufsetzen, Quellen lesen, UAT-Prozesskette mit den Personas durchgehen und offene Fragen an den PO zurueckmelden. Keine ungefragten Reparaturen, Paket-Upgrades oder Kontraktaenderungen mit der Einarbeitung vermischen.

- [ ] Ansprechpartner, Review-/Merge-Verantwortung und benoetigte Zugaenge bestaetigt.
- [ ] Zieltermin und konkret erwarteter Lieferumfang geklaert.
- [ ] Ausgangscommit und eigener Arbeitszweig festgehalten.
- [ ] Frontend und Mock gestartet; Test-Stichtag und Antwortform verstanden.
- [ ] Stundenschreibung, Genehmigung, Planung, Beauftragung, Reporting und Einstellungen mit passenden Rollen angesehen.
- [ ] Unit-/Contract-Tests, Build und beide Smoke-Varianten ausgefuehrt; Ergebnisse oder reproduzierbare Umgebungsblocker dokumentiert.
- [ ] Unterschied zwischen Mock und echter SAP-Anbindung erklaert.
- [ ] Geltende Entscheidungen 14/18/19 von den unbestaetigten Protokollvorschlaegen unterschieden.
- [ ] O4/O13/K30 und weitere offene Entscheidungen mit den richtigen Entscheidern zugeordnet.
- [ ] Eine erste konkrete Umsetzungsstory mit Umfang, Abnahmekriterien und ausdruecklicher Freigabe vereinbart, bevor Codearbeit beginnt.

Uebergabegespraech: gemeinsam Anwendung und Prozesskette ansehen, offene Entscheidungen durchgehen, danach Zugangsluecken und ersten Auftrag festhalten. Die vollstaendige Chat-Historie ist dafuer keine Voraussetzung; diese Uebergabe und die verlinkten Repo-Quellen sollen den Einstieg tragen.
