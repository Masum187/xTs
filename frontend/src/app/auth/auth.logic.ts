import type { AuthProfile, AuthRole, AuthState } from "./auth.models";

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

export function hasRole(profile: AuthProfile | null, role: AuthRole): boolean {
  return profile?.roles.includes(role) ?? false;
}
