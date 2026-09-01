export type OrderStatus = "created" | "banf" | "bestellt";

export interface OrderCandidate {
  extNr: string;
  displayName: string;
  coIdent: string;
  months: string[];
  totalHours: number;
  periodFrom: string;
  periodTo: string;
}

export interface Order {
  orderId: string;
  extNr: string;
  displayName: string;
  coIdent: string;
  text: string;
  periodFrom: string;
  periodTo: string;
  hours: number;
  planningRefs: string[];
  status: OrderStatus;
  banfNumber: string | null;
  banfItem: string | null;
  ebeln: string | null;
  ebelp: string | null;
}

export interface ProtocolEntry {
  source: string;
  orderId: string;
  message: string;
}

export interface SyncResult {
  updated: number;
  errors: ProtocolEntry[];
}

export interface CandidateFilters {
  extNr: string;
  coIdent: string;
  from: string;
  to: string;
}
