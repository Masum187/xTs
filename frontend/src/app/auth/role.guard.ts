import { inject } from "@angular/core";
import type { CanActivateFn } from "@angular/router";
import { Router } from "@angular/router";

import { accessDeniedMessage } from "./auth.logic";
import type { AuthRole } from "./auth.models";
import { AuthService } from "./auth.service";

/**
 * Zugang, wenn das Konto mindestens eine der Rollen hat. Gilt als
 * `canActivate` und `canActivateChild`, damit auch Direktaufrufe und
 * Reloads von Kindrouten den Schutz durchlaufen (XTS-154).
 */
export const roleGuard =
  (role: AuthRole | AuthRole[]): CanActivateFn =>
  async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    const roles = Array.isArray(role) ? role : [role];
    if (roles.some((item) => auth.hasRole(item))) return true;
    // Kein stilles Umleiten: der Grund wird in der Kopfzeile angezeigt.
    if (auth.state() === "ready") {
      auth.showAccessNotice(
        accessDeniedMessage(role, state.url),
        router.currentNavigation()?.id ?? 0,
      );
    }
    return router.parseUrl("/");
  };
