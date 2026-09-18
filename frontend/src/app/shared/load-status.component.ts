import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from "@angular/core";

import type { LoadStateValue } from "./async-state";

/** Zeigt Laden bzw. Fehler mit "Erneut versuchen"; bei "ready" nichts. */
@Component({
  selector: "xts-load-status",
  standalone: true,
  template: `
    @if (state().status === "loading") {
      <p class="load-status loading" role="status" data-testid="loading">
        {{ loadingText() }}
      </p>
    } @else if (state().status === "error") {
      <div class="load-status error" role="alert" data-testid="load-error">
        <p>{{ state().error }}</p>
        <button type="button" (click)="retry.emit()" data-testid="retry">
          Erneut versuchen
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .load-status {
      border-radius: 8px;
      font-size: 14px;
      margin: 12px 0;
      padding: 12px 16px;
    }
    .loading {
      background: #eef2f8;
      color: #465873;
    }
    .error {
      align-items: center;
      background: #fdf3f2;
      border: 1px solid #e6b8b2;
      color: #7c2d24;
      display: flex;
      gap: 16px;
      justify-content: space-between;
    }
    .error p {
      margin: 0;
    }
    .error button {
      background: #ffffff;
      border: 1px solid #c98d86;
      border-radius: 6px;
      color: #7c2d24;
      cursor: pointer;
      min-height: 34px;
      padding: 0 12px;
      white-space: nowrap;
    }
  `,
})
export class LoadStatusComponent {
  readonly state = input.required<LoadStateValue>();
  readonly loadingText = input<string>("Wird geladen …");
  readonly retry = output<void>();
}
