import { describe, expect, it } from "vitest";

import {
  TextBuffer,
  banfBlockedReason,
  candidateKey,
  defaultCandidateText,
  editableOrderIds,
  hasUnsavedOrderText,
} from "./orders.logic";
import type { Order, OrderCandidate } from "./orders.models";

function order(orderId: string, status: Order["status"], text: string): Order {
  return {
    orderId,
    extNr: "SCHILZ",
    displayName: "Stephan Schilz",
    coIdent: "700000000001",
    text,
    periodFrom: "2026-04",
    periodTo: "2026-06",
    hours: 120,
    planningRefs: [],
    status,
    banfNumber: null,
    banfItem: null,
    ebeln: null,
    ebelp: null,
  };
}

const candidate: OrderCandidate = {
  extNr: "SCHILZ",
  displayName: "Stephan Schilz",
  coIdent: "700000000001",
  months: ["2026-04", "2026-05", "2026-06"],
  totalHours: 120,
  periodFrom: "2026-04",
  periodTo: "2026-06",
};

describe("TextBuffer", () => {
  it("returns the fallback until something is typed", () => {
    const texts = new TextBuffer();
    expect(texts.get("a", "Vorgabe")).toBe("Vorgabe");
    texts.set("a", "Eigener Text");
    expect(texts.get("a", "Vorgabe")).toBe("Eigener Text");
    expect(texts.get("b", "Andere Vorgabe")).toBe("Andere Vorgabe");
  });

  it("keeps the input when saving fails and clears it only after success", async () => {
    const texts = new TextBuffer();
    texts.set("BEAUF-000001", "Neuer Text");
    const failingSave = async () => {
      throw new Error("500");
    };
    await expect(failingSave()).rejects.toThrow();
    // Der Fehlerpfad ruft clear nie auf: die Eingabe steht noch.
    expect(texts.get("BEAUF-000001", "Servertext")).toBe("Neuer Text");
    texts.clear("BEAUF-000001");
    expect(texts.get("BEAUF-000001", "Servertext")).toBe("Servertext");
    expect(texts.has("BEAUF-000001")).toBe(false);
  });

  it("retains only the buffers of editable keys", () => {
    const texts = new TextBuffer();
    texts.set("BEAUF-000001", "bleibt");
    texts.set("BEAUF-000002", "faellt weg");
    texts.retainOnly(["BEAUF-000001"]);
    expect(texts.has("BEAUF-000001")).toBe(true);
    expect(texts.has("BEAUF-000002")).toBe(false);
  });
});

describe("order text rules", () => {
  it("derives candidate keys and default texts", () => {
    expect(candidateKey(candidate)).toBe("SCHILZ|700000000001");
    expect(defaultCandidateText(candidate)).toBe(
      "Beauftragung Stephan Schilz 700000000001",
    );
  });

  it("only created orders keep an editable text", () => {
    expect(
      editableOrderIds([
        order("BEAUF-000001", "created", "a"),
        order("BEAUF-000002", "banf", "b"),
        order("BEAUF-000003", "bestellt", "c"),
      ]),
    ).toEqual(["BEAUF-000001"]);
  });

  it("blocks the BANF while the card text differs from the saved text", () => {
    const texts = new TextBuffer();
    const saved = order("BEAUF-000001", "created", "Servertext");
    expect(hasUnsavedOrderText(saved, texts)).toBe(false);
    expect(banfBlockedReason(saved, texts)).toBeNull();

    texts.set("BEAUF-000001", "Servertext geaendert");
    expect(hasUnsavedOrderText(saved, texts)).toBe(true);
    expect(banfBlockedReason(saved, texts)).toBe(
      "Bitte den BANF-Positionstext für BEAUF-000001 zuerst speichern, bevor die BANF angelegt wird.",
    );

    // Gleicher Text wie auf dem Server zaehlt nicht als ungespeichert.
    texts.set("BEAUF-000001", "Servertext");
    expect(hasUnsavedOrderText(saved, texts)).toBe(false);
    expect(banfBlockedReason(saved, texts)).toBeNull();
  });
});
