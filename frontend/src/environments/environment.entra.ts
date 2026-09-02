// Konfiguration fuer die echte Anmeldung ueber Microsoft Entra ID (XTS-050).
// Aktiv mit `ng serve --configuration entra` bzw. `npm run start:entra`.
// tenantId und clientId aus der App-Registrierung eintragen, siehe
// docs/entra-anbindung.md. Werte sind keine Geheimnisse (Public Client).
export const environment = {
  apiBaseUrl: "http://127.0.0.1:4010/odata",
  auth: {
    mode: "entra" as "mock" | "entra",
    entra: {
      tenantId: "",
      clientId: "",
      authority: "https://login.microsoftonline.com/<tenantId>",
      scopes: ["openid", "profile", "email"] as readonly string[],
      tokenKind: "id" as "id" | "access",
    },
  },
} as const;
