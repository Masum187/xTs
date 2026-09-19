import { DecimalPipe, NgTemplateOutlet } from "@angular/common";
import {
  Component,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import { formatHours } from "../shared/hours";

import { formatMonthLabel, parseStartMonth } from "../planning/planning.logic";
import {
  TextBuffer,
  banfBlockedReason,
  candidateKey,
  defaultCandidateText,
  editableOrderIds,
  hasUnsavedOrderText,
} from "./orders.logic";
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
  imports: [DecimalPipe, FormsModule, LoadStatusComponent, NgTemplateOutlet],
  templateUrl: "./orders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./orders.component.css",
})
export class OrdersComponent {
  private readonly ordersService = inject(OrdersService);
  /** Textpuffer (Audit Nr. 31): Eingaben ueberleben Speicherfehler. */
  private readonly candidateTexts = new TextBuffer();
  private readonly orderTexts = new TextBuffer();

  protected readonly loader = new LoadState();
  /** Eigener Zustand fuer die Kandidatenliste, die auch per Filter neu laedt. */
  protected readonly candidatesLoader = new LoadState();
  protected readonly busy = new BusyState();
  protected readonly candidates = signal<OrderCandidate[]>([]);
  protected readonly orders = signal<Order[]>([]);
  protected readonly protocol = signal<ProtocolEntry[]>([]);
  protected readonly message = signal<string>("");

  protected readonly filterExtNr = signal<string>("");
  protected readonly filterCoIdent = signal<string>("");
  protected readonly filterFrom = signal<string>("");
  protected readonly filterTo = signal<string>("");

  // XTS-153: Spalten des Boards aus dem Serverstand, kein optimistischer
  // Wechsel; Zaehler entsprechen den dargestellten Karten.
  protected readonly openOrders = computed(() =>
    this.orders().filter((order) => order.status !== "bestellt"),
  );
  protected readonly purchasedOrders = computed(() =>
    this.orders().filter((order) => order.status === "bestellt"),
  );

  constructor() {
    void this.load();
  }

  /** Stabiler Schluessel fuer `track` in der Kandidatenliste. */
  protected candidateKey(candidate: OrderCandidate): string {
    return candidateKey(candidate);
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
    return this.candidateTexts.get(
      candidateKey(candidate),
      defaultCandidateText(candidate),
    );
  }

  protected setText(candidate: OrderCandidate, text: string): void {
    this.candidateTexts.set(candidateKey(candidate), text);
  }

  protected orderTextFor(order: Order): string {
    return this.orderTexts.get(order.orderId, order.text);
  }

  protected setOrderText(order: Order, text: string): void {
    this.orderTexts.set(order.orderId, text);
  }

  /** Karte zeigt einen Text, der nicht dem gespeicherten Servertext entspricht. */
  protected hasUnsavedOrderText(order: Order): boolean {
    return hasUnsavedOrderText(order, this.orderTexts);
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
        this.candidateTexts.clear(candidateKey(candidate));
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
        this.orderTexts.clear(order.orderId);
        this.message.set(
          `BANF-Positionstext für ${updated.orderId} gespeichert.`,
        );
      },
    );
  }

  protected async createBanf(order: Order): Promise<void> {
    // Die BANF nutzt den gespeicherten Text: ein ungespeicherter Text auf der
    // Karte muss zuerst gespeichert werden (XTS-153).
    const blocked = banfBlockedReason(order, this.orderTexts);
    if (blocked !== null) {
      this.message.set(blocked);
      return;
    }
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

  protected reloadCandidates(): void {
    void this.loadCandidates();
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
    await this.candidatesLoader.track(
      () =>
        this.ordersService.getCandidates({
          extNr: this.filterExtNr(),
          coIdent: this.filterCoIdent(),
          from: parseStartMonth(this.filterFrom()) ?? "",
          to: parseStartMonth(this.filterTo()) ?? "",
        }),
      "Beauftragungskandidaten konnten nicht geladen werden.",
      (candidates) => this.candidates.set(candidates),
    );
  }

  private async load(): Promise<void> {
    await Promise.all([
      this.loadCandidates(),
      this.loader.track(
        () =>
          Promise.all([
            this.ordersService.getOrders(),
            this.ordersService.getProtocol(),
          ]),
        "Beauftragungen konnten nicht geladen werden.",
        ([orders, protocol]) => {
          this.orderTexts.retainOnly(editableOrderIds(orders));
          this.orders.set(orders);
          this.protocol.set(protocol);
        },
      ),
    ]);
  }
}
