import type { AuthProfile, AuthRole, AuthState } from "./auth.models";

export function stateFromStatus(status: number): AuthState {
  if (status === 200) return "ready";
  if (status === 404) return "not-mapped";
  if (status === 403) return "inactive";
  return "error";
}

export function hasRole(profile: AuthProfile | null, role: AuthRole): boolean {
  return profile?.roles.includes(role) ?? false;
}
