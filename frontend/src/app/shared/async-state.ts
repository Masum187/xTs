import { computed, signal } from "@angular/core";

import { describeApiError } from "./api-error";

// Gemeinsamer Lade-/Fehlerzustand und Beschaeftigt-Schutz fuer alle Screens
// (Audit 2026-09-03 Nr. 10, 11): Listen zeigen laden/fehler/leer getrennt,
// Aktionen laufen nie doppelt, Buttons sind waehrend einer Anfrage gesperrt.

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface LoadStateValue {
  status: LoadStatus;
  error: string | null;
}

export class LoadState {
  readonly value = signal<LoadStateValue>({ status: "idle", error: null });
  readonly ready = computed(() => this.value().status === "ready");
  readonly loading = computed(() => this.value().status === "loading");
  private run = 0;

  /**
   * Fuehrt einen Ladevorgang aus. Bei einem Fehler bleibt der Zustand
   * "error" mit verstaendlicher Meldung; ein spaeterer Aufruf ueberschreibt
   * das Ergebnis eines aelteren, noch laufenden Aufrufs nicht.
   */
  async track<T>(
    work: () => Promise<T>,
    fallback: string,
  ): Promise<T | undefined> {
    const id = ++this.run;
    this.value.set({ status: "loading", error: null });
    try {
      const result = await work();
      if (id === this.run) this.value.set({ status: "ready", error: null });
      return result;
    } catch (error) {
      if (id === this.run) {
        this.value.set({
          status: "error",
          error: describeApiError(error, fallback),
        });
      }
      return undefined;
    }
  }
}

export class BusyState {
  readonly active = signal<boolean>(false);

  /** Fuehrt eine Aktion aus, solange keine andere laeuft; sonst `false`. */
  async guard(action: () => Promise<void>): Promise<boolean> {
    if (this.active()) return false;
    this.active.set(true);
    try {
      await action();
    } finally {
      this.active.set(false);
    }
    return true;
  }
}
