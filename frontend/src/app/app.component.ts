import { Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { filter } from "rxjs";

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
          <a routerLink="/orders" routerLinkActive="active">Beauftragung</a>
        }
        @if (isAdmin()) {
          <a routerLink="/admin" routerLinkActive="active">Verwaltung</a>
        }
      </nav>
      @if (auth.usesEntra) {
        <div class="persona" data-testid="entra-account">
          @if (auth.accountName(); as name) {
            <span>{{ name }}</span>
            <button
              type="button"
              class="topbar-button"
              (click)="auth.logout()"
              data-testid="auth-logout"
            >
              Abmelden
            </button>
          } @else {
            <span>Microsoft Entra ID</span>
          }
        </div>
      } @else {
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
      }
    </header>
    <main>
      @if (auth.accessNotice(); as notice) {
        <section
          class="auth-panel auth-notice"
          role="status"
          data-testid="access-denied"
        >
          <p>{{ notice }}</p>
          <button
            type="button"
            (click)="auth.accessNotice.set(null)"
            data-testid="dismiss-notice"
          >
            Schließen
          </button>
        </section>
      }
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
            <h2>Kein xTS-Zugang für {{ auth.loginIdentifier() }}</h2>
            <p>
              Ihr Benutzerkonto ist angemeldet, aber noch keinem xTS-Mitarbeiter
              (EXTNR) zugeordnet. Bitte wenden Sie sich an die
              xTS-Administration, damit das Mapping angelegt wird.
            </p>
            <p class="claims" data-testid="auth-claims">
              Entra OID: <code>{{ auth.claims().oid }}</code> · UPN:
              <code>{{ auth.claims().upn }}</code>
            </p>
          </section>
        }
        @case ("signed-out") {
          <section class="auth-panel" data-testid="auth-signed-out">
            <h2>Anmeldung erforderlich</h2>
            <p>
              Bitte melden Sie sich mit Ihrem Microsoft-Konto an. xTS ordnet Ihr
              Konto anschließend Ihrem Mitarbeiterstamm zu.
            </p>
            <button
              type="button"
              class="primary"
              (click)="auth.login()"
              data-testid="auth-login"
            >
              Mit Microsoft anmelden
            </button>
          </section>
        }
        @case ("not-configured") {
          <section
            class="auth-panel auth-error"
            data-testid="auth-not-configured"
          >
            <h2>Entra ID ist nicht konfiguriert</h2>
            <p>
              Der WebClient läuft im Modus „entra", aber Tenant-ID und Client-ID
              fehlen in der Umgebungskonfiguration (environment.entra.ts). Siehe
              docs/entra-anbindung.md.
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
  protected readonly isAdmin = computed(
    () => this.auth.profile()?.roles.includes("admin") ?? false,
  );

  constructor() {
    void this.auth.loadProfile();
    // Ein Rollenhinweis gilt bis zur naechsten Navigation.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe((event) =>
        this.auth.clearAccessNoticeAfter((event as NavigationStart).id),
      );
  }

  /**
   * Identitaetswechsel (Audit Nr. 12): erst Persona und "loading" setzen
   * (blendet den Outlet aus und zerstoert den aktiven Screen), dann zur
   * Startseite navigieren, dann das Profil laden. Der Screen entsteht erst
   * wieder im Zustand "ready" und laedt nur mit der neuen Identitaet.
   */
  protected async switchPersona(upn: string): Promise<void> {
    const profileLoaded = this.auth.switchPersona(upn);
    await this.router.navigateByUrl("/");
    await profileLoaded;
  }
}
