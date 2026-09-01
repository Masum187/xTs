import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
  selector: "xts-root",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="topbar">
      <div>
        <strong>xTS</strong>
        <span>TimeSheet</span>
      </div>
      <nav>
        <a
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          Stundenschreibung
        </a>
        <a routerLink="/approvals" routerLinkActive="active">Genehmigung</a>
      </nav>
      <span class="environment">MVP Foundation</span>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styleUrl: "./app.component.css",
})
export class AppComponent {}
