import { Injectable, signal } from "@angular/core";

export const DISCARD_CHANGES_MESSAGE =
  "Es gibt ungespeicherte Änderungen in der Stundenschreibung. Änderungen verwerfen?";

/**
 * Schutz vor Datenverlust (Audit Nr. 19): der Stundenschreibungs-Screen
 * meldet ungespeicherte Aenderungen; Routen-Guard, Persona-Wechsel und
 * `beforeunload` fragen nach, bevor sie verloren gehen.
 */
@Injectable({
  providedIn: "root",
})
export class UnsavedChangesService {
  readonly dirty = signal(false);

  /** true, wenn keine Aenderungen offen sind oder der Anwender sie verwirft. */
  confirmDiscard(): boolean {
    return !this.dirty() || window.confirm(DISCARD_CHANGES_MESSAGE);
  }
}
