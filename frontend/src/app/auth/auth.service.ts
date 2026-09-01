import { Injectable, signal } from "@angular/core";

import { environment } from "../../environments/environment";
import { hasRole, stateFromStatus } from "./auth.logic";
import type { AuthProfile, AuthRole, AuthState } from "./auth.models";
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

  /** Simuliert den OAuth-Token-Claim, bis XTS-050 real angebunden ist. */
  authHeaders(): Record<string, string> {
    return { "x-mock-oauth-upn": this.personaUpn() };
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
