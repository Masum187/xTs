import { employees, purchaseOrders } from "./fixtures.js";

// Beauftragung (Epic 4) analog ZXTS_MABEAUF_T. Statusmodell:
// created = angelegt, banf = BANF vorhanden, bestellt = Bestellung vorhanden.

function displayNameFor(extNr) {
  return (
    employees.find((employee) => employee.extNr === extNr)?.displayName ?? extNr
  );
}

function isReferenced(orders, extNr, coIdent, month) {
  return orders.some(
    (order) =>
      order.extNr === extNr &&
      order.coIdent === coIdent &&
      order.planningRefs.includes(month),
  );
}

function releasedRows(planningEntries, orders) {
  return planningEntries.filter(
    (entry) =>
      entry.status === "F" &&
      !isReferenced(orders, entry.extNr, entry.coIdent, entry.month),
  );
}

/**
 * Kandidaten sind F-Planzeilen ohne Beauftragungsreferenz. Die vorgeschlagene
 * Zusammenfassung simuliert ZXTS_REGELN_T Infotyp 1: Aggregation je
 * Mitarbeiter und Kontierung, niemals ueber mehrere Mitarbeiter.
 */
export function buildOrderCandidates(planningEntries, orders, filters) {
  const { extNr, coIdent, from, to } = filters;
  const rows = releasedRows(planningEntries, orders)
    .filter((entry) => !extNr || entry.extNr === extNr)
    .filter((entry) => !coIdent || entry.coIdent === coIdent)
    .filter((entry) => !from || entry.month >= from)
    .filter((entry) => !to || entry.month <= to);

  const byCombo = new Map();
  for (const row of rows) {
    const key = `${row.extNr}|${row.coIdent}`;
    const proposal = byCombo.get(key) ?? {
      extNr: row.extNr,
      displayName: displayNameFor(row.extNr),
      coIdent: row.coIdent,
      months: [],
      totalHours: 0,
    };
    proposal.months.push(row.month);
    proposal.totalHours += row.hours;
    byCombo.set(key, proposal);
  }

  return [...byCombo.values()]
    .map((proposal) => {
      const months = [...proposal.months].sort();
      return {
        ...proposal,
        months,
        periodFrom: months[0],
        periodTo: months[months.length - 1],
      };
    })
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.coIdent.localeCompare(b.coIdent),
    );
}

export function createOrder(state, planningEntries, payload) {
  const { extNr, coIdent, months, text } = payload;
  if (!extNr || !coIdent || !Array.isArray(months) || months.length === 0) {
    return { error: { status: 400, code: "INVALID_ORDER" } };
  }
  const available = releasedRows(planningEntries, state.orders).filter(
    (entry) => entry.extNr === extNr && entry.coIdent === coIdent,
  );
  const rows = months.map((month) =>
    available.find((entry) => entry.month === month),
  );
  if (rows.some((row) => !row)) {
    return { error: { status: 409, code: "PLANNING_ROWS_NOT_AVAILABLE" } };
  }
  const sorted = [...months].sort();
  state.orderCounter += 1;
  const order = {
    orderId: `BEAUF-${String(state.orderCounter).padStart(6, "0")}`,
    extNr,
    displayName: displayNameFor(extNr),
    coIdent,
    text: text || `Beauftragung ${displayNameFor(extNr)} ${coIdent}`,
    periodFrom: sorted[0],
    periodTo: sorted[sorted.length - 1],
    hours: rows.reduce((sum, row) => sum + row.hours, 0),
    planningRefs: sorted,
    status: "created",
    banfNumber: null,
    banfItem: null,
    ebeln: null,
    ebelp: null,
  };
  state.orders.push(order);
  return { order: { ...order } };
}

export function updateOrderText(state, payload) {
  const order = state.orders.find(
    (candidate) => candidate.orderId === payload.orderId,
  );
  if (!order) {
    return { error: { status: 404, code: "ORDER_NOT_FOUND" } };
  }
  if (order.status !== "created") {
    return { error: { status: 409, code: "ORDER_TEXT_LOCKED" } };
  }
  if (!payload.text) {
    return { error: { status: 400, code: "INVALID_ORDER_TEXT" } };
  }
  order.text = payload.text;
  return { order: { ...order } };
}

function setPlanningStatus(planningEntries, order, status) {
  for (const month of order.planningRefs) {
    const entry = planningEntries.find(
      (candidate) =>
        candidate.extNr === order.extNr &&
        candidate.coIdent === order.coIdent &&
        candidate.month === month,
    );
    if (entry) entry.status = status;
  }
}

/** Simulierte MM-BANF-Anlage (XTS-032): Rueckschreibung + Planung auf P. */
export function createBanf(state, planningEntries, payload) {
  const order = state.orders.find(
    (candidate) => candidate.orderId === payload.orderId,
  );
  if (!order) {
    return { error: { status: 404, code: "ORDER_NOT_FOUND" } };
  }
  if (order.status !== "created") {
    state.protocol.push({
      source: "banf",
      orderId: order.orderId,
      message:
        `BANF-Anlage abgelehnt: Beauftragung ${order.orderId} hat bereits BANF ${order.banfNumber ?? ""}.`.trim(),
    });
    return { error: { status: 409, code: "BANF_ALREADY_EXISTS" } };
  }
  state.banfCounter += 1;
  order.banfNumber = String(10000000 + state.banfCounter);
  order.banfItem = "00010";
  order.status = "banf";
  setPlanningStatus(planningEntries, order, "P");
  return { order: { ...order } };
}

/**
 * Simulierter Bestelldaten-Job (XTS-033): liest Bestellungen zur BANF,
 * schreibt EBELN/EBELP zurueck und setzt Planung auf B. Nicht gefundene
 * Faelle landen im Fehlerprotokoll; Bestellungen werden nie aktiv angelegt.
 */
export function runPurchaseOrderSync(state, planningEntries) {
  let updated = 0;
  const errors = [];
  for (const order of state.orders) {
    if (order.status !== "banf") continue;
    const purchaseOrder = purchaseOrders[order.coIdent];
    if (!purchaseOrder) {
      const entry = {
        source: "po-sync",
        orderId: order.orderId,
        message: `Keine Bestellung zur BANF ${order.banfNumber} (Kontierung ${order.coIdent}) gefunden.`,
      };
      state.protocol.push(entry);
      errors.push(entry);
      continue;
    }
    order.ebeln = purchaseOrder.ebeln;
    order.ebelp = "00010";
    order.status = "bestellt";
    setPlanningStatus(planningEntries, order, "B");
    updated += 1;
  }
  return { updated, errors };
}
