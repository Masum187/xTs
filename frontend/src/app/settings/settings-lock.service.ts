import { inject, Injectable } from "@angular/core";
import type { CanDeactivateFn } from "@angular/router";

import { AuthService } from "../auth/auth.service";

/**
 * Sperre waehrend einer Pflegeaktion in den Einstellungen (XTS-154): die
 * Unterseite sperrt ihre Eingaben, die Baumnavigation ihre Links, der
 * Routen-Guard blockiert jeden Routenwechsel (auch Browser-Zurueck) und
 * dieselbe Sperre blockiert im AuthService Persona-Wechsel und Abmeldung.
 * Nach Erfolg oder Fehler hebt die Unterseite die Sperre auf.
 */
@Injectable({ providedIn: "root" })
export class SettingsLockService {
  readonly active = inject(AuthService).identityLock;
}

export const settingsLockGuard: CanDeactivateFn<unknown> = () =>
  !inject(SettingsLockService).active();
