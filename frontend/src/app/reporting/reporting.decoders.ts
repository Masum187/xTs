import { D, type Decoder } from "../shared/decode";
import type {
  BudgetDayDetail,
  BudgetEmployeeDetail,
  BudgetRow,
  LifecycleGoodsReceipt,
  LifecycleOrder,
  LifecycleRow,
  QuotaDayDetail,
  QuotaRow,
  Team,
} from "./reporting.models";

export const budgetDayDetail: Decoder<BudgetDayDetail> =
  D.object<BudgetDayDetail>({
    date: D.date,
    description: D.text,
    hours: D.number,
  });

export const budgetEmployeeDetail: Decoder<BudgetEmployeeDetail> =
  D.object<BudgetEmployeeDetail>({
    extNr: D.string,
    displayName: D.string,
    hours: D.number,
    days: D.optional(D.array(budgetDayDetail)),
  });

export const budgetRow: Decoder<BudgetRow> = D.object<BudgetRow>({
  coIdent: D.string,
  description: D.text,
  budgetHours: D.number,
  consumedHours: D.number,
  consumedPercent: D.number,
  remainingHours: D.number,
  trafficLight: D.literal("green", "yellow", "red"),
  byEmployee: D.optional(D.array(budgetEmployeeDetail)),
});

export const quotaDayDetail: Decoder<QuotaDayDetail> = D.object<QuotaDayDetail>(
  {
    date: D.date,
    description: D.text,
    hours: D.number,
    status: D.string,
  },
);

export const quotaRow: Decoder<QuotaRow> = D.object<QuotaRow>({
  extNr: D.string,
  displayName: D.string,
  lastName: D.string,
  teamId: D.nullable(D.string),
  coIdent: D.string,
  description: D.text,
  validFrom: D.date,
  validTo: D.date,
  orderedHours: D.number,
  bookedHours: D.number,
  remainingHours: D.number,
  days: D.optional(D.array(quotaDayDetail)),
});

export const team: Decoder<Team> = D.object<Team>({
  id: D.string,
  name: D.string,
});

export const lifecycleOrder: Decoder<LifecycleOrder> = D.object<LifecycleOrder>(
  {
    orderId: D.string,
    status: D.literal("created", "banf", "bestellt"),
    hours: D.number,
    periodFrom: D.string,
    periodTo: D.string,
    banfNumber: D.nullable(D.string),
    banfItem: D.nullable(D.string),
    ebeln: D.nullable(D.string),
    ebelp: D.nullable(D.string),
  },
);

export const lifecycleGoodsReceipt: Decoder<LifecycleGoodsReceipt> =
  D.object<LifecycleGoodsReceipt>({
    weDocument: D.string,
    date: D.date,
    hours: D.number,
  });

export const lifecycleRow: Decoder<LifecycleRow> = D.object<LifecycleRow>({
  extNr: D.string,
  displayName: D.string,
  coIdent: D.string,
  description: D.text,
  plannedHours: D.number,
  orderedHours: D.number,
  orders: D.array(lifecycleOrder),
  purchaseOrderHours: D.number,
  purchaseOrderPrice: D.nullable(D.number),
  recordedHours: D.number,
  approvedHours: D.number,
  goodsReceiptHours: D.number,
  pendingGoodsReceiptHours: D.number,
  goodsReceipts: D.array(lifecycleGoodsReceipt),
  invoicedHours: D.nullable(D.number),
  invoiceNumber: D.nullable(D.string),
});
