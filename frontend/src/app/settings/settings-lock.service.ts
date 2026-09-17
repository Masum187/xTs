import { inject, Injectable, signal } from "@angular/core";
import type { CanDeactivateFn } from "@angular/router";

/**
 * Sperre waehrend einer Pflegeaktion in den Einstellungen (XTS-154): die
 * Unterseite sperrt ihre Eingaben, die Baumnavigation ihre Links, und der
 * Routen-Guard blockiert jeden Routenwechsel, auch Browser-Zurueck. Nach
 * Erfolg oder Fehler hebt die Unterseite die Sperre auf.
 */
@Injectable({ providedIn: "root" })
export class SettingsLockService {
  readonly active = signal(false);
}

export const settingsLockGuard: CanDeactivateFn<unknown> = () =>
  !inject(SettingsLockService).active();
