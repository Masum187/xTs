import { costObjectDescription, displayNameFor } from "./masterdata.js";

// Ressourcen-Live-Circle (XTS-070) analog ZXRLM: je Mitarbeiter und Kontierung
// (Aggregationseinheit MA_KONT) die Kette Planung -> Beauftragung -> BANF ->
// Bestellung -> Ist-Stunden -> Wareneingang -> Rechnung. Daten, die der Mock
// nicht kennt (Bestellpreis, Rechnung), werden als null geliefert und nie
// berechnet; ein genehmigter Tag ohne WE-Beleg gilt als "WE ausstehend".

const RECORDED_STATUSES = ["E", "F", "G"];
const APPROVED_STATUS = "G";

function monthOf(date) {
  return date.slice(0, 7);
}

function inPeriod(month, from, to) {
  return (!from || month >= from) && (!to || month <= to);
}

function orderOverlapsPeriod(order, from, to) {
  return (!to || order.periodFrom <= to) && (!from || order.periodTo >= from);
}

function matchesPurchaseOrder(order, ebeln, ebelp) {
  return (!ebeln || order.ebeln === ebeln) && (!ebelp || order.ebelp === ebelp);
}

function descriptionFor(coIdent) {
  return costObjectDescription(coIdent).split(",")[0];
}

function emptyRow(extNr, coIdent) {
  return {
    extNr,
    displayName: displayNameFor(extNr),
    coIdent,
    description: descriptionFor(coIdent),
    plannedHours: 0,
    orderedHours: 0,
    orders: [],
    purchaseOrderHours: 0,
    purchaseOrderPrice: null,
    recordedHours: 0,
    approvedHours: 0,
    goodsReceiptHours: 0,
    pendingGoodsReceiptHours: 0,
    goodsReceipts: [],
    invoicedHours: null,
    invoiceNumber: null,
  };
}

function hoursFor(day, coIdent) {
  return day.lines
    .filter((line) => line.coIdent === coIdent)
    .reduce((sum, line) => sum + line.hours, 0);
}

export function buildResourceLifecycle(planningEntries, orders, days, filters) {
  const { from, to, ebeln, ebelp } = filters;
  const rows = new Map();
  const rowFor = (extNr, coIdent) => {
    const key = `${extNr}|${coIdent}`;
    if (!rows.has(key)) rows.set(key, emptyRow(extNr, coIdent));
    return rows.get(key);
  };

  for (const entry of planningEntries) {
    if (!inPeriod(entry.month, from, to)) continue;
    rowFor(entry.extNr, entry.coIdent).plannedHours += entry.hours;
  }

  for (const order of orders) {
    if (!orderOverlapsPeriod(order, from, to)) continue;
    const row = rowFor(order.extNr, order.coIdent);
    row.orderedHours += order.hours;
    if (order.ebeln) row.purchaseOrderHours += order.hours;
    row.orders.push({
      orderId: order.orderId,
      status: order.status,
      hours: order.hours,
      periodFrom: order.periodFrom,
      periodTo: order.periodTo,
      banfNumber: order.banfNumber,
      banfItem: order.banfItem,
      ebeln: order.ebeln,
      ebelp: order.ebelp,
    });
  }

  for (const day of days) {
    if (!RECORDED_STATUSES.includes(day.status)) continue;
    if (!inPeriod(monthOf(day.date), from, to)) continue;
    const coIdents = new Set(day.lines.map((line) => line.coIdent));
    for (const coIdent of coIdents) {
      const hours = hoursFor(day, coIdent);
      const row = rowFor(day.extNr, coIdent);
      row.recordedHours += hours;
      if (day.status !== APPROVED_STATUS) continue;
      row.approvedHours += hours;
      if (day.weDocument) {
        row.goodsReceiptHours += hours;
        row.goodsReceipts.push({
          weDocument: day.weDocument,
          date: day.date,
          hours,
        });
      } else {
        row.pendingGoodsReceiptHours += hours;
      }
    }
  }

  return [...rows.values()]
    .filter(
      (row) =>
        (!ebeln && !ebelp) ||
        row.orders.some((order) => matchesPurchaseOrder(order, ebeln, ebelp)),
    )
    .map((row) => ({
      ...row,
      orders: [...row.orders].sort((a, b) =>
        a.orderId.localeCompare(b.orderId),
      ),
      goodsReceipts: [...row.goodsReceipts].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }))
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.coIdent.localeCompare(b.coIdent),
    );
}
