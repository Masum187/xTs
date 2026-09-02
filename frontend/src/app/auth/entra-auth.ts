import type {
  AccountInfo,
  IPublicClientApplication,
} from "@azure/msal-browser";

import { environment } from "../../environments/environment";
import { resolveAuthority } from "./auth.logic";

// Kapselt MSAL (Microsoft Entra ID) fuer XTS-050. Die Bibliothek wird nur im
// Modus "entra" dynamisch geladen, damit der Mock-Modus kein MSAL im Bundle
// traegt. Redirect-Flow (kein Popup), Konto im Session Storage.
export class EntraAuth {
  private app: IPublicClientApplication | null = null;
  private account: AccountInfo | null = null;
  private initialization: Promise<AccountInfo | null> | null = null;

  initialize(): Promise<AccountInfo | null> {
    this.initialization ??= this.doInitialize();
    return this.initialization;
  }

  currentAccount(): AccountInfo | null {
    return this.account;
  }

  async login(): Promise<void> {
    const app = await this.appOrThrow();
    await app.loginRedirect({ scopes: [...environment.auth.entra.scopes] });
  }

  async logout(): Promise<void> {
    const app = await this.appOrThrow();
    await app.logoutRedirect({ account: this.account ?? undefined });
  }

  /**
   * Liefert das Token fuer den Bearer-Header (ID- oder Access-Token gemaess
   * `tokenKind`). Ist eine Interaktion noetig, wird zum Login umgeleitet und
   * `null` zurueckgegeben.
   */
  async acquireToken(): Promise<string | null> {
    const app = await this.appOrThrow();
    if (!this.account) return null;
    const msal = await import("@azure/msal-browser");
    const request = {
      scopes: [...environment.auth.entra.scopes],
      account: this.account,
    };
    try {
      const result = await app.acquireTokenSilent(request);
      return environment.auth.entra.tokenKind === "access"
        ? result.accessToken
        : result.idToken;
    } catch (error) {
      if (error instanceof msal.InteractionRequiredAuthError) {
        await app.acquireTokenRedirect(request);
        return null;
      }
      throw error;
    }
  }

  private async doInitialize(): Promise<AccountInfo | null> {
    const msal = await import("@azure/msal-browser");
    const config = environment.auth.entra;
    this.app = await msal.createStandardPublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: resolveAuthority(config),
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: msal.BrowserCacheLocation.SessionStorage },
    });
    const result = await this.app.handleRedirectPromise();
    this.account =
      result?.account ??
      this.app.getActiveAccount() ??
      this.app.getAllAccounts()[0] ??
      null;
    if (this.account) this.app.setActiveAccount(this.account);
    return this.account;
  }

  private async appOrThrow(): Promise<IPublicClientApplication> {
    await this.initialize();
    if (!this.app) throw new Error("MSAL ist nicht initialisiert.");
    return this.app;
  }
}
