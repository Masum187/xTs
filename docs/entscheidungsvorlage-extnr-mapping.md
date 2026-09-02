# Entscheidungsvorlage: AD/OAuth-Attribut fuer das EXTNR-Mapping (XTS-050)

Stand: 2026-09-02  
Status: **entschieden am 2026-09-02 fuer Option B** (Entra `oid` als `AAD_OID`, `AAD_UPN` als Fallback). Umsetzung im WebClient und in der Mock-API abgeschlossen (siehe Abschnitt "Umsetzungsstand" und [entra-anbindung.md](entra-anbindung.md)); SAP-seitig stehen DDIC-Erweiterung und Token-Validierung aus.  
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

## Umsetzungsstand (Stand 2026-09-02, Option B technisch vorbereitet)

Damit die Entscheidung mit laufendem Code getroffen werden kann, ist die
Empfehlung bereits umgesetzt, ohne die fachliche Entscheidung vorwegzunehmen:

- **Mitarbeiterstamm** (`ZXTS_WIW_T`-Simulation, Fixture `employees`) traegt
  `aadOid` (Entra objectId, GUID) und `aadUpn`. Beide Felder sind in der
  Verwaltung (XTS-010) pflegbar; die Mock-API validiert das GUID-Format
  (`INVALID_AAD_OID`) und die Eindeutigkeit (`AAD_OID_IN_USE`,
  `AAD_UPN_IN_USE` mit `conflictId` des anderen Mitarbeiters).
- **Mapping** in `GET /odata/MyProfile`: Claim `oid` fuehrend (Option B),
  Claim `upn` als Fallback (Option A, fuer den Uebergang oder falls das
  DDIC-Feld spaeter kommt). Die Antwort enthaelt `mappedBy: "oid" | "upn"`,
  damit im Betrieb sichtbar ist, welches Attribut gegriffen hat. Ohne
  Treffer: HTTP 404 `NO_EXTNR_MAPPING` mit beiden Claims im Body; inaktiv
  oder geloescht: HTTP 403 `EMPLOYEE_INACTIVE`.
- **Pseudo-Claims bis zur echten Anmeldung**: Header `x-mock-oauth-oid` und
  `x-mock-oauth-upn`; ohne Header gilt die Default-Persona SCHILZ per UPN.
  Die Dev-Personas des WebClients tragen beide Claims; die Persona "Neuer
  Externer" hat eine OID ohne Treffer und zeigt den Nicht-gemappt-Fall
  inklusive der Claims an, die die Administration zum Anlegen braucht.
- **WebClient-Integrationspunkt** (`environment.auth`): Modus `mock` sendet
  die Pseudo-Claims, Modus `entra` sendet `Authorization: Bearer <token>`
  aus `AuthService.accessToken`. Fuer die echte Anmeldung fehlt nur noch
  der MSAL-Login (`@azure/msal-browser`, `loginRedirect` +
  `acquireTokenSilent` mit den Scopes aus `environment.auth.entra`) und
  serverseitig die Token-Validierung mit Auslesen von `oid`/`upn`.
- **Tests**: Contract-Tests "OAuth oid claim maps to EXTNR with upn as
  fallback" und "admins maintain the Entra mapping and it takes effect
  immediately"; E2E `auth.spec.ts` prueft Nicht-gemappt-, Inaktiv- und
  Rollenfaelle.

Bei Zustimmung zu Option B bleibt SAP-seitig: DDIC-Erweiterung
`AAD_OID`/`AAD_UPN`, Token-Validierung im OData-Service, Pflegeprozess beim
Onboarding. Bei Entscheidung fuer Option A wird `aadOid` nicht gepflegt und
der UPN-Fallback traegt das Mapping; der Code aendert sich nicht.

## Offene Punkte fuer den Entscheidungstermin

- Bestaetigung durch IT: `oid`-Claim ist in den ausgestellten Tokens enthalten
  (Standard bei Entra ID, nur zu verifizieren).
- Prozess: Wer pflegt `AAD_OID`/`AAD_UPN` beim Onboarding eines Externen?
- Gilt ein Mapping-Verlust (AD-Konto geloescht) als Sperrgrund fuer offene
  Stundenerfassungen?
