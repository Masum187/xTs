import { Component, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";

import { MOCK_PERSONAS } from "./auth/auth.models";
import { AuthService } from "./auth/auth.service";

@Component({
  selector: "xts-root",
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
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
        @if (isApprover()) {
          <a routerLink="/approvals" routerLinkActive="active">Genehmigung</a>
          <a routerLink="/reports" routerLinkActive="active">Reporting</a>
        }
        @if (isPlanner()) {
          <a routerLink="/planning" routerLinkActive="active">Planung</a>
        }
      </nav>
      <label class="persona">
        Dev-Persona
        <select
          aria-label="Dev-Persona"
          data-testid="persona-select"
          [ngModel]="auth.personaUpn()"
          (ngModelChange)="switchPersona($event)"
        >
          @for (persona of personas; track persona.upn) {
            <option [value]="persona.upn">{{ persona.label }}</option>
          }
        </select>
      </label>
    </header>
    <main>
      @switch (auth.state()) {
        @case ("ready") {
          <router-outlet />
        }
        @case ("loading") {
          <section class="auth-panel" data-testid="auth-loading">
            <p>Profil wird geladen …</p>
          </section>
        }
        @case ("not-mapped") {
          <section class="auth-panel auth-error" data-testid="auth-not-mapped">
            <h2>Kein xTS-Zugang für {{ auth.personaUpn() }}</h2>
            <p>
              Ihr Benutzerkonto ist angemeldet, aber noch keinem xTS-Mitarbeiter
              (EXTNR) zugeordnet. Bitte wenden Sie sich an die
              xTS-Administration, damit das Mapping angelegt wird.
            </p>
          </section>
        }
        @case ("inactive") {
          <section class="auth-panel auth-error" data-testid="auth-inactive">
            <h2>Zugang gesperrt</h2>
            <p>
              Ihr Mitarbeiterstamm ist in xTS inaktiv gesetzt. Eine
              Stundenerfassung ist nicht möglich. Bitte wenden Sie sich an die
              xTS-Administration.
            </p>
          </section>
        }
        @default {
          <section class="auth-panel auth-error" data-testid="auth-failed">
            <h2>Anmeldung fehlgeschlagen</h2>
            <p>
              Das Profil konnte nicht geladen werden. Bitte versuchen Sie es
              erneut.
            </p>
          </section>
        }
      }
    </main>
  `,
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly personas = MOCK_PERSONAS;
  protected readonly isApprover = computed(
    () => this.auth.profile()?.roles.includes("approver") ?? false,
  );
  protected readonly isPlanner = computed(
    () => this.auth.profile()?.roles.includes("planner") ?? false,
  );

  constructor() {
    void this.auth.loadProfile();
  }

  protected async switchPersona(upn: string): Promise<void> {
    await this.router.navigateByUrl("/");
    await this.auth.switchPersona(upn);
  }
}
