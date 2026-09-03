export const environment = {
  apiBaseUrl: "http://127.0.0.1:4010/odata",
  // XTS-050: "mock" sendet die Token-Claims als Pseudo-Header an die Mock-API.
  // "entra" meldet ueber Microsoft Entra ID (MSAL) an und sendet das Token als
  // Bearer-Header; das Mapping auf EXTNR laeuft ueber den `oid`-Claim.
  // Fuer "entra" `ng serve --configuration entra` (environment.entra.ts).
  auth: {
    mode: "mock" as "mock" | "entra",
    entra: {
      tenantId: "",
      clientId: "",
      authority: "https://login.microsoftonline.com/<tenantId>",
      scopes: ["openid", "profile", "email"] as readonly string[],
      // "id": ID-Token (reicht fuer die Mock-API, traegt oid + UPN).
      // "access": Access Token fuer eine registrierte API (Scope in `scopes`).
      tokenKind: "id" as "id" | "access",
    },
  },
} as const;
