export const environment = {
  apiBaseUrl: "http://127.0.0.1:4010/odata",
  // XTS-050: "mock" sendet die Token-Claims als Pseudo-Header an die Mock-API.
  // "entra" ist der vorbereitete Integrationspunkt fuer Microsoft Entra ID
  // (MSAL): Access Token als Bearer-Header, Mapping ueber den `oid`-Claim.
  auth: {
    mode: "mock" as "mock" | "entra",
    entra: {
      tenantId: "",
      clientId: "",
      authority: "https://login.microsoftonline.com/<tenantId>",
      scopes: ["openid", "profile", "api://xts/.default"],
    },
  },
} as const;
