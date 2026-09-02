import { Injectable, signal } from "@angular/core";

import { environment } from "../../environments/environment";
import { hasRole, stateFromStatus } from "./auth.logic";
import type {
  AuthClaims,
  AuthProfile,
  AuthRole,
  AuthState,
} from "./auth.models";
import { MOCK_PERSONAS } from "./auth.models";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly baseUrl = environment.apiBaseUrl;
  private pending: Promise<AuthState> | null = null;

  readonly personaUpn = signal<string>(MOCK_PERSONAS[0].upn);
  readonly state = signal<AuthState>("loading");
  readonly profile = signal<AuthProfile | null>(null);

  /** Access Token der echten Anmeldung (Modus "entra"); wird vom kuenftigen
   * MSAL-Login gesetzt. Im Modus "mock" ungenutzt. */
  readonly accessToken = signal<string | null>(null);

  /**
   * Auth-Header fuer alle OData-Aufrufe (XTS-050). Modus "mock": die
   * Token-Claims `oid` und `upn` der gewaehlten Persona gehen als
   * Pseudo-Header an die Mock-API. Modus "entra": Bearer Token, die Claims
   * liest dann der Server aus dem Token.
   */
  authHeaders(): Record<string, string> {
    if (environment.auth.mode === "entra") {
      const token = this.accessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    }
    const claims = this.claims();
    return { "x-mock-oauth-oid": claims.oid, "x-mock-oauth-upn": claims.upn };
  }

  claims(): AuthClaims {
    const persona = MOCK_PERSONAS.find(
      (item) => item.upn === this.personaUpn(),
    );
    return { oid: persona?.oid ?? "", upn: this.personaUpn() };
  }

  hasRole(role: AuthRole): boolean {
    return hasRole(this.profile(), role);
  }

  async switchPersona(upn: string): Promise<void> {
    this.personaUpn.set(upn);
    await this.loadProfile();
  }

  async ensureLoaded(): Promise<AuthState> {
    if (this.state() === "loading") {
      return this.pending ?? this.loadProfile();
    }
    return this.state();
  }

  async loadProfile(): Promise<AuthState> {
    this.state.set("loading");
    this.profile.set(null);
    this.pending = this.fetchProfile();
    const state = await this.pending;
    this.pending = null;
    return state;
  }

  private async fetchProfile(): Promise<AuthState> {
    try {
      const response = await fetch(`${this.baseUrl}/MyProfile`, {
        headers: this.authHeaders(),
      });
      const state = stateFromStatus(response.status);
      if (state === "ready") {
        this.profile.set((await response.json()) as AuthProfile);
      }
      this.state.set(state);
      return state;
    } catch {
      this.state.set("error");
      return "error";
    }
  }
}
