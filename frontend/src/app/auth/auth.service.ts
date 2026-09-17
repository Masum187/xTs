import { Injectable, signal } from "@angular/core";

import { environment } from "../../environments/environment";
import { parseErrorBody } from "../shared/api-error";
import { decode } from "../shared/decode";
import { unwrapEntity } from "../shared/odata-http";
import { authProfile } from "./auth.decoders";
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
  /** Laufnummer des Profil-Loads: nur der neueste darf Zustand und Profil setzen. */
  private profileRun = 0;
  private entra: EntraAuth | null = null;

  /** Modus "entra": echte Anmeldung ueber Microsoft Entra ID (XTS-050). */
  readonly usesEntra = environment.auth.mode === "entra";

  readonly personaUpn = signal<string>(MOCK_PERSONAS[0].upn);
  /**
   * Sperre fuer Identitaetswechsel (XTS-154): waehrend einer laufenden
   * Pflegeaktion in den Einstellungen sind Persona-Wechsel und Abmeldung
   * blockiert, damit kein Screen unter einer fremden Identitaet stehen
   * bleibt. Die Einstellungen setzen und loesen die Sperre.
   */
  readonly identityLock = signal(false);
  readonly state = signal<AuthState>("loading");
  readonly profile = signal<AuthProfile | null>(null);

  /** Hinweis, wenn eine Route mangels Rolle abgewiesen wurde (Audit Nr. 25). */
  readonly accessNotice = signal<string | null>(null);
  private noticeNavigationId = 0;

  /** Zeigt den Rollenhinweis; die Umleitung des Guards (id + 1) loescht ihn nicht. */
  showAccessNotice(message: string, navigationId: number): void {
    this.noticeNavigationId = navigationId;
    this.accessNotice.set(message);
  }

  /** Loescht den Hinweis bei der naechsten Navigation nach der Guard-Umleitung. */
  clearAccessNoticeAfter(navigationId: number): void {
    if (navigationId > this.noticeNavigationId + 1) {
      this.accessNotice.set(null);
    }
  }

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

  /**
   * Identitaetswechsel (Audit Nr. 12): Persona und Zustand "loading" werden
   * synchron gesetzt, bevor irgendetwas navigiert oder laedt. Damit ist der
   * Router-Outlet ausgeblendet, laufende Screens werden zerstoert und kein
   * Datenaufruf laeuft mehr mit der alten Identitaet.
   */
  async switchPersona(upn: string): Promise<void> {
    if (this.identityLock()) return;
    this.personaUpn.set(upn);
    this.state.set("loading");
    this.profile.set(null);
    this.accessNotice.set(null);
    await this.loadProfile();
  }

  async login(): Promise<void> {
    await this.entraAuth().login();
  }

  async logout(): Promise<void> {
    if (this.identityLock()) return;
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
    const run = ++this.profileRun;
    this.state.set("loading");
    this.profile.set(null);
    const load = this.usesEntra
      ? this.fetchProfileViaEntra(run)
      : this.fetchProfile(run);
    this.pending = load;
    const state = await load;
    if (run === this.profileRun) this.pending = null;
    return state;
  }

  /**
   * Profil im Hintergrund neu laden, ohne den Zustand auf "loading" zu
   * setzen (XTS-154, nach dem Testdaten-Reset): die Screens bleiben stehen,
   * Rollen und Anzeige werden aus dem Serverstand aktualisiert. Ein neuerer
   * Profil-Load gewinnt wie bei `loadProfile`.
   */
  async refreshProfile(): Promise<AuthState> {
    if (this.state() !== "ready") return this.loadProfile();
    const run = ++this.profileRun;
    return this.usesEntra
      ? this.fetchProfileViaEntra(run)
      : this.fetchProfile(run);
  }

  /** Wendet ein Ladeergebnis nur an, wenn kein neuerer Profil-Load laeuft. */
  private applyProfile(
    run: number,
    state: AuthState,
    profile: AuthProfile | null = null,
  ): AuthState {
    if (run !== this.profileRun) return this.state();
    this.profile.set(profile);
    this.state.set(state);
    return state;
  }

  private entraAuth(): EntraAuth {
    this.entra ??= new EntraAuth();
    return this.entra;
  }

  private async fetchProfileViaEntra(run: number): Promise<AuthState> {
    if (!entraConfigured(environment.auth.entra)) {
      return this.applyProfile(run, "not-configured");
    }
    try {
      const account = await this.entraAuth().initialize();
      if (!account) {
        return this.applyProfile(run, "signed-out");
      }
      if (run !== this.profileRun) return this.state();
      this.accountName.set(account.name ?? account.username);
      this.entraClaims.set({ oid: "", upn: account.username ?? "" });
      const token = await this.entraAuth().acquireToken();
      if (!token) {
        // Interaktive Anmeldung laeuft per Redirect.
        return this.applyProfile(run, "signed-out");
      }
      if (run !== this.profileRun) return this.state();
      this.accessToken.set(token);
    } catch (error) {
      console.error("Entra-Anmeldung fehlgeschlagen", error);
      return this.applyProfile(run, "error");
    }
    return this.fetchProfile(run);
  }

  private async fetchProfile(run: number): Promise<AuthState> {
    try {
      const response = await fetch(`${this.baseUrl}/MyProfile`, {
        headers: { accept: "application/json", ...this.authHeaders() },
      });
      const state = stateFromStatus(response.status);
      const body: unknown = await response.json();
      if (run !== this.profileRun) return this.state();
      if (state === "ready") {
        // Profil wird geprueft (Audit Nr. 13); unerwartete Form -> "error".
        const profile = decode(authProfile, unwrapEntity(body));
        return this.applyProfile(run, state, profile);
      }
      if (this.usesEntra) {
        const { details } = parseErrorBody(body, response.status);
        this.entraClaims.set(claimsFromErrorPayload(details));
      }
      return this.applyProfile(run, state);
    } catch {
      return this.applyProfile(run, "error");
    }
  }
}
