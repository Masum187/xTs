import { DecimalPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import { formatHours } from "../shared/hours";

import { formatMonthLabel, parseStartMonth } from "../planning/planning.logic";
import type {
  Order,
  OrderCandidate,
  OrderStatus,
  ProtocolEntry,
} from "./orders.models";
import { OrdersService } from "./orders.service";

const STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Angelegt",
  banf: "BANF vorhanden",
  bestellt: "Bestellung vorhanden",
};

@Component({
  selector: "xts-orders",
  standalone: true,
  imports: [DecimalPipe, FormsModule, LoadStatusComponent],
  templateUrl: "./orders.component.html",
  styleUrl: "./orders.component.css",
})
export class OrdersComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly candidateTexts = new Map<string, string>();
  private readonly orderTexts = new Map<string, string>();

  protected readonly loader = new LoadState();
  protected readonly busy = new BusyState();
  protected readonly candidates = signal<OrderCandidate[]>([]);
  protected readonly orders = signal<Order[]>([]);
  protected readonly protocol = signal<ProtocolEntry[]>([]);
  protected readonly message = signal<string>("");

  protected readonly filterExtNr = signal<string>("");
  protected readonly filterCoIdent = signal<string>("");
  protected readonly filterFrom = signal<string>("");
  protected readonly filterTo = signal<string>("");

  constructor() {
    void this.load();
  }

  protected candidateKey(candidate: OrderCandidate): string {
    return `${candidate.extNr}|${candidate.coIdent}`;
  }

  protected statusLabel(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  protected periodLabel(from: string, to: string): string {
    const fromLabel = formatMonthLabel(from);
    const toLabel = formatMonthLabel(to);
    return fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
  }

  protected textFor(candidate: OrderCandidate): string {
    return (
      this.candidateTexts.get(this.candidateKey(candidate)) ??
      `Beauftragung ${candidate.displayName} ${candidate.coIdent}`
    );
  }

  protected setText(candidate: OrderCandidate, text: string): void {
    this.candidateTexts.set(this.candidateKey(candidate), text);
  }

  protected orderTextFor(order: Order): string {
    return this.orderTexts.get(order.orderId) ?? order.text;
  }

  protected setOrderText(order: Order, text: string): void {
    this.orderTexts.set(order.orderId, text);
  }

  protected async updateFilter(
    patch: Partial<{
      extNr: string;
      coIdent: string;
      from: string;
      to: string;
    }>,
  ): Promise<void> {
    if (patch.extNr !== undefined) this.filterExtNr.set(patch.extNr);
    if (patch.coIdent !== undefined) this.filterCoIdent.set(patch.coIdent);
    if (patch.from !== undefined) this.filterFrom.set(patch.from);
    if (patch.to !== undefined) this.filterTo.set(patch.to);
    await this.loadCandidates();
  }

  protected async createOrder(candidate: OrderCandidate): Promise<void> {
    await this.guarded(
      "Beauftragung konnte nicht angelegt werden.",
      async () => {
        const order = await this.ordersService.createOrder(
          candidate,
          this.textFor(candidate),
        );
        this.candidateTexts.delete(this.candidateKey(candidate));
        this.message.set(
          `Beauftragung ${order.orderId} für ${order.displayName} angelegt (${formatHours(order.hours)} Std.).`,
        );
      },
    );
  }

  protected async saveOrderText(order: Order): Promise<void> {
    await this.guarded(
      "BANF-Positionstext konnte nicht gespeichert werden.",
      async () => {
        const updated = await this.ordersService.updateOrderText(
          order.orderId,
          this.orderTextFor(order),
        );
        this.orderTexts.delete(order.orderId);
        this.message.set(
          `BANF-Positionstext für ${updated.orderId} gespeichert.`,
        );
      },
    );
  }

  protected async createBanf(order: Order): Promise<void> {
    await this.guarded("BANF konnte nicht angelegt werden.", async () => {
      const updated = await this.ordersService.createBanf(order.orderId);
      this.message.set(
        `BANF ${updated.banfNumber}/${updated.banfItem} zu ${updated.orderId} angelegt, Planung auf P gesetzt.`,
      );
    });
  }

  protected async runSync(): Promise<void> {
    await this.guarded(
      "Bestelldaten-Job konnte nicht ausgeführt werden.",
      async () => {
        const result = await this.ordersService.runPurchaseOrderSync();
        this.message.set(
          `Bestelldaten-Job: ${result.updated} Beauftragung(en) aktualisiert, ${result.errors.length} Fehler.`,
        );
      },
    );
  }

  protected reload(): void {
    void this.load();
  }

  private async guarded(
    fallback: string,
    action: () => Promise<void>,
  ): Promise<void> {
    await this.busy.guard(async () => {
      try {
        await action();
      } catch (error) {
        this.message.set(describeApiError(error, fallback));
      }
      await this.load();
    });
  }

  private async loadCandidates(): Promise<void> {
    this.candidates.set(
      await this.ordersService.getCandidates({
        extNr: this.filterExtNr(),
        coIdent: this.filterCoIdent(),
        from: parseStartMonth(this.filterFrom()) ?? "",
        to: parseStartMonth(this.filterTo()) ?? "",
      }),
    );
  }

  private async load(): Promise<void> {
    await this.loader.track(async () => {
      await this.loadCandidates();
      const [orders, protocol] = await Promise.all([
        this.ordersService.getOrders(),
        this.ordersService.getProtocol(),
      ]);
      this.pruneOrderTexts(orders);
      this.orders.set(orders);
      this.protocol.set(protocol);
    }, "Beauftragungen konnten nicht geladen werden.");
  }

  private pruneOrderTexts(orders: Order[]): void {
    const editableOrderIds = new Set(
      orders
        .filter((order) => order.status === "created")
        .map((order) => order.orderId),
    );
    for (const orderId of this.orderTexts.keys()) {
      if (!editableOrderIds.has(orderId)) this.orderTexts.delete(orderId);
    }
  }
}
