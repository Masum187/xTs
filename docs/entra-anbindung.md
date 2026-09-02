# Entra-ID-Anbindung des WebClients (XTS-050)

Stand: 2026-09-02  
Entscheidung: Option B (Entra `oid` als `AAD_OID`, `AAD_UPN` als Fallback), siehe [entscheidungsvorlage-extnr-mapping.md](entscheidungsvorlage-extnr-mapping.md).

Der WebClient meldet ueber Microsoft Entra ID (MSAL, `@azure/msal-browser`) an und schickt das Token als `Authorization: Bearer` an den OData-Service. Der Service liest `oid` (fuehrend) und `preferred_username`/`upn` (Fallback) aus dem Token und mappt auf `ZXTS_WIW_T-EXTNR`.

## 1. Modi

| Modus   | Aktivierung                                    | Auth-Header                                           | Zweck                                  |
| ------- | ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| `mock`  | Default (`environment.ts`)                     | `x-mock-oauth-oid`, `x-mock-oauth-upn` (Dev-Personas) | Entwicklung, Tests, UAT gegen Mock-API |
| `entra` | `npm run start:entra` (`environment.entra.ts`) | `Authorization: Bearer <ID- oder Access-Token>`       | Echte Anmeldung, Pilot, Produktion     |

MSAL wird nur im Modus `entra` dynamisch geladen; das Bundle des Mock-Modus bleibt unveraendert.

## 2. App-Registrierung in Entra ID (einmalig, IT)

1. Entra ID -> App-Registrierungen -> Neue Registrierung, Name `xTS WebClient`, Kontotyp "Nur dieses Organisationsverzeichnis".
2. Plattform **Single-Page-Anwendung (SPA)**, Redirect-URIs: `http://127.0.0.1:4200` (lokal) und die Ziel-URL des WebClients. Implicit Flow bleibt aus (MSAL nutzt Authorization Code + PKCE).
3. API-Berechtigungen: `openid`, `profile`, `email` (Microsoft Graph, delegiert). Admin-Zustimmung erteilen.
4. Token-Konfiguration: der Claim `oid` ist im ID-Token immer enthalten, `preferred_username` ebenfalls. Keine optionalen Claims noetig.
5. Werte notieren: **Verzeichnis-ID (Tenant)** und **Anwendungs-ID (Client)**.

Spaeter, wenn der SAP-OData-Service als API registriert ist: eigene App-Registrierung `xTS API` mit Scope (z. B. `api://<api-client-id>/xts.access`), dem WebClient diese Berechtigung geben und im Frontend `scopes` um den Scope erweitern sowie `tokenKind: "access"` setzen.

## 3. Frontend konfigurieren

`frontend/src/environments/environment.entra.ts`:

```ts
auth: {
  mode: "entra",
  entra: {
    tenantId: "<Verzeichnis-ID>",
    clientId: "<Anwendungs-ID>",
    authority: "https://login.microsoftonline.com/<tenantId>",
    scopes: ["openid", "profile", "email"],
    tokenKind: "id",
  },
},
```

Start: `npm run start:entra` (entspricht `ng serve --configuration entra`, Angular ersetzt `environment.ts` durch `environment.entra.ts`). Tenant- und Client-ID sind keine Geheimnisse (Public Client mit PKCE).

## 4. Ablauf im WebClient

1. `AuthService.loadProfile()` initialisiert MSAL (`createStandardPublicClientApplication`, Redirect-Flow, Session Storage) und verarbeitet einen ggf. laufenden Redirect.
2. Ohne Konto: Zustand `signed-out`, Panel "Anmeldung erforderlich" mit Button **Mit Microsoft anmelden** (`loginRedirect`).
3. Mit Konto: `acquireTokenSilent`; bei noetiger Interaktion `acquireTokenRedirect`. Das Token (ID-Token bei `tokenKind: "id"`) geht als Bearer-Header an `GET /odata/MyProfile` und alle weiteren Aufrufe.
4. Antworten wie im Mock-Modus: `200` Profil inkl. `mappedBy`, `404 NO_EXTNR_MAPPING` (Panel zeigt Meldung), `403 EMPLOYEE_INACTIVE`, `401 INVALID_TOKEN`.
5. Kopfzeile zeigt den Kontonamen und **Abmelden** (`logoutRedirect`).
6. Fehlt die Konfiguration (Tenant/Client leer), zeigt der WebClient "Entra ID ist nicht konfiguriert" statt eines stillen Fehlers.

## 5. Serverseite

- **Mock-API** (`mock-api/src/routes.js`): liest bei `Authorization: Bearer` den JWT-Payload und mappt `oid` bzw. `preferred_username`/`upn`/`email`. **Keine Signatur-, Aussteller- oder Ablaufpruefung** – der Mock ist kein Sicherheitsbaustein. Bearer hat Vorrang vor den Pseudo-Headern. Nicht lesbare Tokens: `401 INVALID_TOKEN`.
- **SAP-OData-Service** (offen, Epic 14/XTS-080): Token gegen die Entra-Metadaten validieren (`iss`, `aud` = Client-/API-ID, `exp`, Signatur ueber JWKS), `oid` gegen `ZXTS_WIW_T-AAD_OID` und Fallback `preferred_username` gegen `AAD_UPN` mappen, Rollen aus xTS-Stammdaten (spaeter AD-Gruppen).
- **DDIC**: `ZXTS_WIW_T` um `AAD_OID` (CHAR36) und `AAD_UPN` (CHAR241) erweitern; Pflege in der xTS-Verwaltung ist im WebClient bereits vorhanden.

## 6. Pruefen ohne echten Tenant

- Contract-Test "bearer tokens are mapped via their oid or preferred_username claims" baut ein unsigniertes JWT und prueft Mapping, Vorrang und Fehlerfall.
- Manuell: `curl -H "Authorization: Bearer <JWT>" http://127.0.0.1:4010/odata/MyProfile` mit einem JWT, dessen Payload `{"oid":"7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42"}` enthaelt, liefert das Profil von ROEPER.

## 7. Offene Punkte

- Bestaetigung durch IT, dass `oid` und `preferred_username` in den ausgestellten Tokens enthalten sind (Standard bei Entra ID).
- Pflegeprozess: Wer traegt `AAD_OID`/`AAD_UPN` beim Onboarding ein? Vorschlag: xTS-Administration anhand des Nicht-gemappt-Screens, der beide Claims anzeigt.
- Sperrregel bei Mapping-Verlust (AD-Konto geloescht) fuer offene Stundenerfassungen.
- Rollen aus AD-Gruppen (XTS-080).
