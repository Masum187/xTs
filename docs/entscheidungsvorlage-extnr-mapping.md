# Entscheidungsvorlage: AD/OAuth-Attribut fuer das EXTNR-Mapping (XTS-050)

Stand: 2026-09-01  
Status: offen, Entscheidung durch Fachverantwortliche und IT/AD-Team erforderlich  
Bezug: Entscheidung 6 in `entscheidungen-v0.1.md`, Story XTS-050 in `backlog-v0.1.md`

## Fragestellung

Der WebClient authentifiziert ueber AD/OAuth (Microsoft Entra ID). xTS muss den
authentifizierten Benutzer eindeutig auf `ZXTS_WIW_T-EXTNR` abbilden. Offen ist,
welches Token-/Verzeichnisattribut das Mapping traegt und wo die
Mapping-Pflege stattfindet.

## Anforderungen an das Mapping

- Eindeutig und stabil ueber die gesamte Beschaeftigungsdauer (auch bei
  Namensaenderung, E-Mail-Wechsel, Firmenwechsel des Externen).
- Pflegbar durch xTS-Administration ohne Ticket beim AD-Team fuer jeden Fall.
- Externe ohne SAP-User muessen abbildbar sein.
- Nicht gemappte oder inaktive Benutzer muessen sauber abgewiesen werden
  (klare Fehlermeldung, kein stiller Fehler).

## Optionen

| Kriterium     | A: UPN in `ZXTS_WIW_T`                         | B: Entra `objectId` in `ZXTS_WIW_T`          | C: EXTNR als Entra-Extension-Attribut            |
| ------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Stabilitaet   | mittel (UPN kann sich bei Umbenennung aendern) | hoch (GUID, aendert sich nie)                | hoch                                             |
| Pflegeort     | xTS-Stammdaten                                 | xTS-Stammdaten                               | AD-Team / IT                                     |
| Pflegeaufwand | gering, menschenlesbar                         | gering, aber GUID muss nachgeschlagen werden | jeder Fall braucht AD-Aenderung                  |
| Token-Claim   | `preferred_username` / `upn` (Standard)        | `oid` (Standard)                             | Custom Claim noetig (App-Registrierung anpassen) |
| SAP-Aenderung | neues Feld in `ZXTS_WIW_T`                     | neues Feld in `ZXTS_WIW_T`                   | keine                                            |
| Risiko        | Mapping bricht bei UPN-Aenderung               | keines bekannt                               | Prozessabhaengigkeit vom AD-Team, Latenz         |

## Empfehlung

**Option B**: `ZXTS_WIW_T` erhaelt ein Feld `AAD_OID` (GUID des Entra-Benutzers,
Claim `oid`). Zusaetzlich wird der UPN redundant als Anzeige-/Suchfeld
gespeichert (`AAD_UPN`), damit die Administration Benutzer ohne
GUID-Nachschlagen findet. Das Mapping bleibt vollstaendig in xTS-Hand,
ist stabil gegen Umbenennungen und braucht keine Anpassung der
App-Registrierung.

Fallback, falls das DDIC-Feld kurzfristig nicht kommt: Option A (UPN) mit
dokumentiertem Restrisiko bei UPN-Aenderungen.

## Konsequenzen bei Zustimmung

1. DDIC: `ZXTS_WIW_T` um `AAD_OID` (CHAR36) und `AAD_UPN` (CHAR241) erweitern.
2. `GET /odata/MyProfile` mappt `oid`-Claim auf `EXTNR` und liefert Profil +
   Rollen; ohne Treffer HTTP 404 `NO_EXTNR_MAPPING`, bei inaktivem
   Mitarbeiter HTTP 403 `EMPLOYEE_INACTIVE`.
3. Rollen (`user`, `approver`) kommen im MVP aus xTS-Stammdaten, nicht aus
   AD-Gruppen; AD-Gruppen-Mapping kann spaeter ergaenzt werden.
4. xTS-Administrationsmaske (XTS-010) erhaelt die beiden neuen Felder.

## Abbildung in der Mock-API (bis zur Entscheidung)

Die Mock-API simuliert das Zielverhalten bereits, damit Frontend und Tests
nicht auf die Entscheidung warten muessen:

- Der Pseudo-Token-Claim wird als Header `x-mock-oauth-upn` uebergeben
  (Default: `stephan.schilz@qualitytimes.de`).
- Eine Mapping-Tabelle in den Fixtures bildet UPN auf `EXTNR` ab; ein
  Eintrag ohne `EXTNR` simuliert den nicht gemappten OAuth-User, ein
  inaktiver Mitarbeiter den Sperrfall.
- Fehlercodes `NO_EXTNR_MAPPING` (404) und `EMPLOYEE_INACTIVE` (403)
  entsprechen bereits dem Zielkontrakt aus dieser Vorlage.

## Offene Punkte fuer den Entscheidungstermin

- Bestaetigung durch IT: `oid`-Claim ist in den ausgestellten Tokens enthalten
  (Standard bei Entra ID, nur zu verifizieren).
- Prozess: Wer pflegt `AAD_OID`/`AAD_UPN` beim Onboarding eines Externen?
- Gilt ein Mapping-Verlust (AD-Konto geloescht) als Sperrgrund fuer offene
  Stundenerfassungen?
