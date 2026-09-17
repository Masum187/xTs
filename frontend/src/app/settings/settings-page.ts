import { inject, signal } from "@angular/core";

import { AdminService } from "../admin/admin.service";
import { ApiError, describeApiError } from "../shared/api-error";
import { LoadState } from "../shared/async-state";
import { SettingsLockService } from "./settings-lock.service";

/**
 * Gemeinsamer Rahmen der Einstellungs-Unterseiten (XTS-154): eigener
 * Ladezustand mit Retry, Meldung `admin-message` je Seite und die
 * Sperre waehrend einer Pflegeaktion ueber `SettingsLockService`.
 */
export abstract class SettingsPage {
  protected readonly adminService = inject(AdminService);
  protected readonly lock = inject(SettingsLockService);
  protected readonly loader = new LoadState();
  protected readonly message = signal<string>("");
  protected readonly messageKind = signal<"ok" | "error">("ok");

  protected reload(): void {
    void this.load();
  }

  protected abstract load(): Promise<void>;

  /** Fuehrt eine Pflegeaktion unter der Sperre aus; die Sperre endet immer. */
  protected async run(action: () => Promise<string>): Promise<void> {
    if (this.lock.active()) return;
    this.lock.active.set(true);
    try {
      this.message.set(await action());
      this.messageKind.set("ok");
    } catch (error) {
      this.messageKind.set("error");
      this.message.set(describeSettingsError(error));
    } finally {
      this.lock.active.set(false);
    }
  }
}

export function describeSettingsError(error: unknown): string {
  if (error instanceof ApiError && error.code === "CO_CHECK_FAILED") {
    return `SAP-CO-Prüfung nicht bestanden: ${error.message}`;
  }
  return describeApiError(error, "Speichern fehlgeschlagen.");
}
