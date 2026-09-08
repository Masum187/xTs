import { Injectable, inject } from "@angular/core";

import { ODataClient } from "../shared/odata";
import {
  order,
  orderCandidate,
  protocolEntry,
  syncResult,
} from "./orders.decoders";
import type {
  CandidateFilters,
  Order,
  OrderCandidate,
  ProtocolEntry,
  SyncResult,
} from "./orders.models";

@Injectable({
  providedIn: "root",
})
export class OrdersService {
  private readonly odata = inject(ODataClient);

  getCandidates(filters: CandidateFilters): Promise<OrderCandidate[]> {
    return this.odata.list("OrderCandidates", orderCandidate, {
      extNr: filters.extNr,
      coIdent: filters.coIdent,
      from: filters.from,
      to: filters.to,
    });
  }

  getOrders(): Promise<Order[]> {
    return this.odata.list("Orders", order);
  }

  getProtocol(): Promise<ProtocolEntry[]> {
    return this.odata.list("OrderProtocol", protocolEntry);
  }

  createOrder(candidate: OrderCandidate, text: string): Promise<Order> {
    return this.odata.post(
      "Orders",
      {
        extNr: candidate.extNr,
        coIdent: candidate.coIdent,
        months: candidate.months,
        text,
      },
      order,
    );
  }

  updateOrderText(orderId: string, text: string): Promise<Order> {
    return this.odata.post("Orders", { orderId, text }, order);
  }

  createBanf(orderId: string): Promise<Order> {
    return this.odata.post("OrderBanfs", { orderId }, order);
  }

  runPurchaseOrderSync(): Promise<SyncResult> {
    return this.odata.post("PurchaseOrderSyncRuns", {}, syncResult);
  }
}
