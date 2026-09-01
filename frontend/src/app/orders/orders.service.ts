import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import type {
  CandidateFilters,
  Order,
  OrderCandidate,
  ProtocolEntry,
  SyncResult,
} from "./orders.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class OrdersService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getCandidates(filters: CandidateFilters): Promise<OrderCandidate[]> {
    const params = new URLSearchParams();
    if (filters.extNr) params.set("extNr", filters.extNr);
    if (filters.coIdent) params.set("coIdent", filters.coIdent);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.readValues<OrderCandidate>(
      `${this.baseUrl}/OrderCandidates${query}`,
    );
  }

  async getOrders(): Promise<Order[]> {
    return this.readValues<Order>(`${this.baseUrl}/Orders`);
  }

  async getProtocol(): Promise<ProtocolEntry[]> {
    return this.readValues<ProtocolEntry>(`${this.baseUrl}/OrderProtocol`);
  }

  async createOrder(candidate: OrderCandidate, text: string): Promise<Order> {
    return this.post<Order>(`${this.baseUrl}/Orders`, {
      extNr: candidate.extNr,
      coIdent: candidate.coIdent,
      months: candidate.months,
      text,
    });
  }

  async createBanf(orderId: string): Promise<Order> {
    return this.post<Order>(`${this.baseUrl}/OrderBanfs`, { orderId });
  }

  async runPurchaseOrderSync(): Promise<SyncResult> {
    return this.post<SyncResult>(`${this.baseUrl}/PurchaseOrderSyncRuns`, {});
  }

  private async post<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.auth.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    return this.readJson<T>(response);
  }

  private async readValues<T>(url: string): Promise<T[]> {
    const response = await fetch(url, { headers: this.auth.authHeaders() });
    const body = await this.readJson<ODataResponse<T>>(response);
    return body.value;
  }

  private async readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`Request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
