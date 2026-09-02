export type BudgetDetailLevel = "none" | "employee" | "day";

export type TrafficLight = "green" | "yellow" | "red";

export interface BudgetDayDetail {
  date: string;
  description: string;
  hours: number;
}

export interface BudgetEmployeeDetail {
  extNr: string;
  displayName: string;
  hours: number;
  days?: BudgetDayDetail[];
}

export interface BudgetRow {
  coIdent: string;
  description: string;
  budgetHours: number;
  consumedHours: number;
  consumedPercent: number;
  remainingHours: number;
  trafficLight: TrafficLight;
  byEmployee?: BudgetEmployeeDetail[];
}

export interface QuotaFilters {
  lastName: string;
  team: string;
  from: string;
  to: string;
  detail: "none" | "day";
}

export interface QuotaDayDetail extends BudgetDayDetail {
  status: string;
}

export interface QuotaRow {
  extNr: string;
  displayName: string;
  lastName: string;
  teamId: string | null;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  orderedHours: number;
  bookedHours: number;
  remainingHours: number;
  days?: QuotaDayDetail[];
}

export interface Team {
  id: string;
  name: string;
}

export interface LifecycleFilters {
  from: string;
  to: string;
  ebeln: string;
  ebelp: string;
}

export type OrderStatus = "created" | "banf" | "bestellt";

export interface LifecycleOrder {
  orderId: string;
  status: OrderStatus;
  hours: number;
  periodFrom: string;
  periodTo: string;
  banfNumber: string | null;
  banfItem: string | null;
  ebeln: string | null;
  ebelp: string | null;
}

export interface LifecycleGoodsReceipt {
  weDocument: string;
  date: string;
  hours: number;
}

export interface LifecycleRow {
  extNr: string;
  displayName: string;
  coIdent: string;
  description: string;
  plannedHours: number;
  orderedHours: number;
  orders: LifecycleOrder[];
  purchaseOrderHours: number;
  purchaseOrderPrice: number | null;
  recordedHours: number;
  approvedHours: number;
  goodsReceiptHours: number;
  pendingGoodsReceiptHours: number;
  goodsReceipts: LifecycleGoodsReceipt[];
  invoicedHours: number | null;
  invoiceNumber: string | null;
}
