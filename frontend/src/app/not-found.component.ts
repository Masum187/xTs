import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "xts-not-found",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="auth-panel" data-testid="not-found">
      <h2>Seite nicht gefunden</h2>
      <p>Die aufgerufene Adresse gibt es in xTS nicht.</p>
      <p><a routerLink="/">Zur Stundenschreibung</a></p>
    </section>
  `,
  styles: `
    .auth-panel {
      background: #ffffff;
      border: 1px solid #d9e1ee;
      border-radius: 8px;
      padding: 24px;
    }
    h2 {
      margin: 0 0 8px;
    }
    p {
      color: #465873;
      margin: 0 0 8px;
    }
  `,
})
export class NotFoundComponent {}
