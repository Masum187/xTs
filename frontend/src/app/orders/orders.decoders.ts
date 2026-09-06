import { D, type Decoder } from "../shared/decode";
import type {
  Order,
  OrderCandidate,
  ProtocolEntry,
  SyncResult,
} from "./orders.models";

export const orderCandidate: Decoder<OrderCandidate> = D.object<OrderCandidate>(
  {
    extNr: D.string,
    displayName: D.string,
    coIdent: D.string,
    months: D.array(D.string),
    totalHours: D.number,
    periodFrom: D.string,
    periodTo: D.string,
  },
);

export const order: Decoder<Order> = D.object<Order>({
  orderId: D.string,
  extNr: D.string,
  displayName: D.string,
  coIdent: D.string,
  text: D.text,
  periodFrom: D.string,
  periodTo: D.string,
  hours: D.number,
  planningRefs: D.array(D.string),
  status: D.literal("created", "banf", "bestellt"),
  banfNumber: D.nullable(D.string),
  banfItem: D.nullable(D.string),
  ebeln: D.nullable(D.string),
  ebelp: D.nullable(D.string),
});

export const protocolEntry: Decoder<ProtocolEntry> = D.object<ProtocolEntry>({
  source: D.string,
  orderId: D.text,
  message: D.text,
});

export const syncResult: Decoder<SyncResult> = D.object<SyncResult>({
  updated: D.integer,
  errors: D.array(protocolEntry),
});
