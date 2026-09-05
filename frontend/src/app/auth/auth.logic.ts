import type {
  AuthClaims,
  AuthProfile,
  AuthRole,
  AuthState,
} from "./auth.models";

export function stateFromStatus(status: number): AuthState {
  if (status === 200) return "ready";
  if (status === 404) return "not-mapped";
  if (status === 403) return "inactive";
  return "error";
}

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  authority: string;
  scopes: readonly string[];
  tokenKind: "id" | "access";
}

/** Entra ist nutzbar, sobald Tenant und Client-ID eingetragen sind. */
export function entraConfigured(config: EntraConfig): boolean {
  return config.tenantId.trim() !== "" && config.clientId.trim() !== "";
}

export function resolveAuthority(config: EntraConfig): string {
  return config.authority.replace("<tenantId>", config.tenantId.trim());
}

function nonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function claimsFromErrorPayload(payload: unknown): AuthClaims {
  if (!payload || typeof payload !== "object") return { oid: "", upn: "" };
  const body = payload as { oid?: unknown; upn?: unknown };
  return { oid: nonEmptyString(body.oid), upn: nonEmptyString(body.upn) };
}

export function authIdentifier(
  usesEntra: boolean,
  personaUpn: string,
  accountName: string | null,
  claims: AuthClaims,
): string {
  return usesEntra
    ? claims.upn || accountName || "Microsoft-Konto"
    : personaUpn;
}

const ROLE_LABELS: Record<AuthRole, string> = {
  user: "xTS User",
  approver: "Projektleiter (Genehmigung)",
  planner: "Ressourcenmanager (Planung/Beauftragung)",
  admin: "xTS Administrator",
};

/** Meldung, wenn eine Route mangels Rolle nicht geoeffnet werden kann (Audit Nr. 25). */
export function accessDeniedMessage(role: AuthRole, path: string): string {
  return `Für ${path} fehlt Ihrem Konto die Rolle „${ROLE_LABELS[role]}". Sie wurden zur Stundenschreibung geleitet.`;
}

export function hasRole(profile: AuthProfile | null, role: AuthRole): boolean {
  return profile?.roles.includes(role) ?? false;
}
