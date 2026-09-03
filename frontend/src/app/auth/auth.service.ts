import { Injectable, signal } from "@angular/core";

import { environment } from "../../environments/environment";
import {
  authIdentifier,
  claimsFromErrorPayload,
  entraConfigured,
  hasRole,
  stateFromStatus,
} from "./auth.logic";
import type {
  AuthClaims,
  AuthProfile,
  AuthRole,
  AuthState,
} from "./auth.models";
import { MOCK_PERSONAS } from "./auth.models";
import { EntraAuth } from "./entra-auth";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly baseUrl = environment.apiBaseUrl;
  private pending: Promise<AuthState> | null = null;
  private entra: EntraAuth | null = null;

  /** Modus "entra": echte Anmeldung ueber Microsoft Entra ID (XTS-050). */
  readonly usesEntra = environment.auth.mode === "entra";

  readonly personaUpn = signal<string>(MOCK_PERSONAS[0].upn);
  readonly state = signal<AuthState>("loading");
  readonly profile = signal<AuthProfile | null>(null);

  /** Angezeigter Name des Entra-Kontos (Modus "entra"). */
  readonly accountName = signal<string | null>(null);

  /** Token der echten Anmeldung (Modus "entra"); im Modus "mock" ungenutzt. */
  readonly accessToken = signal<string | null>(null);
  private readonly entraClaims = signal<AuthClaims>({ oid: "", upn: "" });

  /**
   * Auth-Header fuer alle OData-Aufrufe (XTS-050). Modus "mock": die
   * Token-Claims `oid` und `upn` der gewaehlten Persona gehen als
   * Pseudo-Header an die Mock-API. Modus "entra": Bearer Token, die Claims
   * liest dann der Server aus dem Token.
   */
  authHeaders(): Record<string, string> {
    if (this.usesEntra) {
      const token = this.accessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    }
    const claims = this.claims();
    return { "x-mock-oauth-oid": claims.oid, "x-mock-oauth-upn": claims.upn };
  }

  claims(): AuthClaims {
    if (this.usesEntra) return this.entraClaims();
    const persona = MOCK_PERSONAS.find(
      (item) => item.upn === this.personaUpn(),
    );
    return { oid: persona?.oid ?? "", upn: this.personaUpn() };
  }

  loginIdentifier(): string {
    return authIdentifier(
      this.usesEntra,
      this.personaUpn(),
      this.accountName(),
      this.claims(),
    );
  }

  hasRole(role: AuthRole): boolean {
    return hasRole(this.profile(), role);
  }

  async switchPersona(upn: string): Promise<void> {
    this.personaUpn.set(upn);
    await this.loadProfile();
  }

  async login(): Promise<void> {
    await this.entraAuth().login();
  }

  async logout(): Promise<void> {
    this.accessToken.set(null);
    this.profile.set(null);
    this.accountName.set(null);
    this.state.set("signed-out");
    await this.entraAuth().logout();
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
    this.pending = this.usesEntra
      ? this.fetchProfileViaEntra()
      : this.fetchProfile();
    const state = await this.pending;
    this.pending = null;
    return state;
  }

  private entraAuth(): EntraAuth {
    this.entra ??= new EntraAuth();
    return this.entra;
  }

  private async fetchProfileViaEntra(): Promise<AuthState> {
    if (!entraConfigured(environment.auth.entra)) {
      this.state.set("not-configured");
      return "not-configured";
    }
    try {
      const account = await this.entraAuth().initialize();
      if (!account) {
        this.state.set("signed-out");
        return "signed-out";
      }
      this.accountName.set(account.name ?? account.username);
      this.entraClaims.set({ oid: "", upn: account.username ?? "" });
      const token = await this.entraAuth().acquireToken();
      if (!token) {
        // Interaktive Anmeldung laeuft per Redirect.
        this.state.set("signed-out");
        return "signed-out";
      }
      this.accessToken.set(token);
    } catch (error) {
      console.error("Entra-Anmeldung fehlgeschlagen", error);
      this.state.set("error");
      return "error";
    }
    return this.fetchProfile();
  }

  private async fetchProfile(): Promise<AuthState> {
    try {
      const response = await fetch(`${this.baseUrl}/MyProfile`, {
        headers: this.authHeaders(),
      });
      const state = stateFromStatus(response.status);
      const body = await response.json();
      if (state === "ready") {
        this.profile.set(body as AuthProfile);
      } else if (this.usesEntra) {
        this.entraClaims.set(claimsFromErrorPayload(body));
      }
      this.state.set(state);
      return state;
    } catch {
      this.state.set("error");
      return "error";
    }
  }
}
