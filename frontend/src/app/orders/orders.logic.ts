import { signal } from "@angular/core";

import type { Order, OrderCandidate } from "./orders.models";

/**
 * Textpuffer je Schluessel (Audit Nr. 31, vorher zwei Maps in der
 * Komponente): haelt eine Eingabe, bis der Server sie bestaetigt hat. Ein
 * Speicherfehler loescht nichts. Signalbasiert, damit eine OnPush-Ansicht
 * jede Aenderung ohne weiteren Klick sieht.
 */
export class TextBuffer {
  private readonly texts = signal<ReadonlyMap<string, string>>(new Map());

  /** Gepufferter Text oder der Vorgabewert, wenn nichts gepuffert ist. */
  get(key: string, fallback: string): string {
    return this.texts().get(key) ?? fallback;
  }

  has(key: string): boolean {
    return this.texts().has(key);
  }

  set(key: string, text: string): void {
    this.texts.update((texts) => new Map(texts).set(key, text));
  }

  /** Nach bestaetigtem Speichern: der Server fuehrt den Text jetzt. */
  clear(key: string): void {
    if (!this.has(key)) return;
    this.texts.update((texts) => {
      const next = new Map(texts);
      next.delete(key);
      return next;
    });
  }

  /** Behaelt nur Puffer zu den genannten Schluesseln (z. B. bearbeitbare Karten). */
  retainOnly(keys: Iterable<string>): void {
    const keep = new Set(keys);
    if ([...this.texts().keys()].every((key) => keep.has(key))) return;
    this.texts.update(
      (texts) => new Map([...texts].filter(([key]) => keep.has(key))),
    );
  }
}

export function candidateKey(candidate: OrderCandidate): string {
  return `${candidate.extNr}|${candidate.coIdent}`;
}

export function defaultCandidateText(candidate: OrderCandidate): string {
  return `Beauftragung ${candidate.displayName} ${candidate.coIdent}`;
}

/** Nur angelegte Beauftragungen haben einen bearbeitbaren BANF-Positionstext. */
export function editableOrderIds(orders: Order[]): string[] {
  return orders
    .filter((order) => order.status === "created")
    .map((order) => order.orderId);
}

/** Text auf der Karte weicht vom gespeicherten Servertext ab. */
export function hasUnsavedOrderText(order: Order, texts: TextBuffer): boolean {
  return texts.get(order.orderId, order.text) !== order.text;
}

/**
 * Die BANF nutzt den gespeicherten Text (XTS-153): mit ungespeichertem Text
 * auf der Karte ist sie gesperrt, sonst null.
 */
export function banfBlockedReason(
  order: Order,
  texts: TextBuffer,
): string | null {
  return hasUnsavedOrderText(order, texts)
    ? `Bitte den BANF-Positionstext für ${order.orderId} zuerst speichern, bevor die BANF angelegt wird.`
    : null;
}
