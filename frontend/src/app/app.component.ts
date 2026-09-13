import type { ElementRef } from "@angular/core";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { filter } from "rxjs";

import { MOCK_PERSONAS } from "./auth/auth.models";
import { AuthService } from "./auth/auth.service";
import { ApprovalBadgeService } from "./shared/approval-badge.service";
import { UnsavedChangesService } from "./shared/unsaved-changes.service";

/** Unterhalb dieser Breite ist die Navigation ein modales Menue (Entscheidung 21). */
const NARROW_QUERY = "(max-width: 1023px)";

const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: "xts-root",
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell" [class.shell-narrow]="narrow()">
      @if (narrow()) {
        <header class="topbar xts-font" [attr.inert]="menuOpen() ? '' : null">
          <span class="brand"><strong>xTS</strong> TimeSheet</span>
          <button
            #menuToggle
            type="button"
            class="menu-toggle"
            data-testid="menu-toggle"
            aria-controls="app-nav"
            [attr.aria-expanded]="menuOpen()"
            (click)="openMenu()"
          >
            Menü
          </button>
        </header>
      }

      @if (!narrow() || menuOpen()) {
        @if (narrow()) {
          <div class="backdrop" (click)="closeMenu()"></div>
        }
        <aside
          #menu
          id="app-nav"
          class="sidebar xts-font"
          data-testid="sidebar"
          [class.sidebar-modal]="narrow()"
          [attr.role]="narrow() ? 'dialog' : null"
          [attr.aria-modal]="narrow() ? 'true' : null"
          aria-label="Navigation"
          (keydown)="onMenuKeydown($event)"
        >
          <div class="sidebar-head">
            <span class="brand"><strong>xTS</strong> TimeSheet</span>
            @if (narrow()) {
              <button
                type="button"
                class="menu-close"
                data-testid="menu-close"
                (click)="closeMenu()"
              >
                Schließen
              </button>
            }
          </div>
          <nav data-testid="main-nav">
            <a
              routerLink="/"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              Stundenschreibung
            </a>
            @if (isApprover()) {
              <a routerLink="/approvals" routerLinkActive="active">
                Genehmigung
                @if (badge.count(); as count) {
                  <span
                    class="nav-badge"
                    data-testid="nav-badge-approvals"
                    aria-label="{{ count }} offen"
                  >
                    {{ count }}
                  </span>
                }
              </a>
            }
            @if (canReport()) {
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
          <div class="persona-block">
            @if (auth.profile(); as profile) {
              <strong data-testid="nav-persona-name">{{
                profile.displayName
              }}</strong>
              <span class="persona-roles">{{ roleLabel() }}</span>
            }
            @if (auth.usesEntra) {
              <div class="persona" data-testid="entra-account">
                @if (auth.accountName(); as name) {
                  <span>{{ name }}</span>
                  <button
                    type="button"
                    class="menu-toggle"
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
                  #personaSelect
                  aria-label="Dev-Persona"
                  data-testid="persona-select"
                  [ngModel]="auth.personaUpn()"
                  (ngModelChange)="switchPersona($event, personaSelect)"
                >
                  @for (persona of personas; track persona.upn) {
                    <option [value]="persona.upn">{{ persona.label }}</option>
                  }
                </select>
              </label>
            }
          </div>
        </aside>
      }

      <main [attr.inert]="narrow() && menuOpen() ? '' : null">
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
            <section
              class="auth-panel auth-error"
              data-testid="auth-not-mapped"
            >
              <h2>Kein xTS-Zugang für {{ auth.loginIdentifier() }}</h2>
              <p>
                Ihr Benutzerkonto ist angemeldet, aber noch keinem
                xTS-Mitarbeiter (EXTNR) zugeordnet. Bitte wenden Sie sich an die
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
                Bitte melden Sie sich mit Ihrem Microsoft-Konto an. xTS ordnet
                Ihr Konto anschließend Ihrem Mitarbeiterstamm zu.
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
                Der WebClient läuft im Modus „entra", aber Tenant-ID und
                Client-ID fehlen in der Umgebungskonfiguration
                (environment.entra.ts). Siehe docs/entra-anbindung.md.
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
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly badge = inject(ApprovalBadgeService);
  private readonly router = inject(Router);
  private readonly unsaved = inject(UnsavedChangesService);

  private readonly menu = viewChild<ElementRef<HTMLElement>>("menu");
  private readonly menuToggle =
    viewChild<ElementRef<HTMLButtonElement>>("menuToggle");

  protected readonly personas = MOCK_PERSONAS;
  /** Schmale Breite: Navigation als ueberlagerndes modales Menue (Entscheidung 21). */
  protected readonly narrow = signal(window.matchMedia(NARROW_QUERY).matches);
  protected readonly menuOpen = signal(false);

  protected readonly isApprover = computed(
    () => this.auth.profile()?.roles.includes("approver") ?? false,
  );
  protected readonly isPlanner = computed(
    () => this.auth.profile()?.roles.includes("planner") ?? false,
  );
  protected readonly isAdmin = computed(
    () => this.auth.profile()?.roles.includes("admin") ?? false,
  );
  /** Reporting wie die Route: approver (geschnitten), controller und admin. */
  protected readonly canReport = computed(
    () =>
      this.isApprover() || this.auth.hasRole("controller") || this.isAdmin(),
  );
  protected readonly roleLabel = computed(() => {
    const roles = this.auth.profile()?.roles ?? [];
    const labels: Record<string, string> = {
      approver: "PL",
      planner: "RM",
      admin: "Admin",
      controller: "Controlling",
    };
    const named = roles.filter((role) => role in labels).map((r) => labels[r]);
    return named.length > 0 ? named.join(" · ") : "Mitarbeiter";
  });

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
    // Nach erfolgreicher Navigation schliesst das modale Menue; eine durch den
    // Datenverlust-Schutz abgebrochene Navigation (NavigationCancel) laesst
    // es offen.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.narrow() && this.menuOpen()) this.closeMenu();
      });

    // Breite beobachten: beim Wechsel auf Desktop bei offenem Menue entfallen
    // inert und Fokusfalle; der Fokus landet auf einem sichtbaren Element.
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      this.narrow.set(event.matches);
    query.addEventListener("change", onChange);
    inject(DestroyRef).onDestroy(() =>
      query.removeEventListener("change", onChange),
    );
    effect(() => {
      if (!this.narrow() && this.menuOpen()) {
        this.menuOpen.set(false);
        setTimeout(() => this.focusFirstNavLink());
      }
    });

    // Badge (XTS-142): nur aus berechtigten Serverdaten der aktuellen
    // Identitaet; beim Identitaetswechsel (state "loading") sofort leer.
    effect(() => {
      const state = this.auth.state();
      const profile = this.auth.profile();
      if (state === "ready" && profile) {
        void this.badge.refresh(profile);
      } else {
        this.badge.clear();
      }
    });
  }

  protected openMenu(): void {
    this.menuOpen.set(true);
    setTimeout(() => this.focusFirstInMenu());
  }

  /** Schliesst das Menue und gibt den Fokus an die Schaltflaeche zurueck. */
  protected closeMenu(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    setTimeout(() => this.menuToggle()?.nativeElement.focus());
  }

  /** Fokusfalle und Escape im modalen Menue. */
  protected onMenuKeydown(event: KeyboardEvent): void {
    if (!this.narrow() || !this.menuOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = this.menuFocusables();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private menuFocusables(): HTMLElement[] {
    const root = this.menu()?.nativeElement;
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null,
    );
  }

  private focusFirstInMenu(): void {
    this.menuFocusables()[0]?.focus();
  }

  private focusFirstNavLink(): void {
    const link = this.menu()?.nativeElement.querySelector<HTMLElement>("nav a");
    (link ?? this.menuFocusables()[0])?.focus();
  }

  /**
   * Identitaetswechsel (Audit Nr. 12): erst Persona und "loading" setzen
   * (blendet den Outlet aus und zerstoert den aktiven Screen), dann zur
   * Startseite navigieren, dann das Profil laden. Der Screen entsteht erst
   * wieder im Zustand "ready" und laedt nur mit der neuen Identitaet.
   */
  protected async switchPersona(
    upn: string,
    select: HTMLSelectElement,
  ): Promise<void> {
    // Datenverlust-Schutz (Audit Nr. 19): der Wechsel zerstoert den Screen.
    if (!this.unsaved.confirmDiscard()) {
      select.value = this.auth.personaUpn();
      return;
    }
    // Das modale Menue schliesst mit dem Wechsel; eine Navigation auf die
    // bereits aktive Startseite loest kein NavigationEnd aus.
    this.closeMenu();
    const profileLoaded = this.auth.switchPersona(upn);
    await this.router.navigateByUrl("/");
    await profileLoaded;
  }

  /** Reload oder Schliessen mit ungespeicherten Aenderungen fragt nach. */
  @HostListener("window:beforeunload", ["$event"])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.unsaved.dirty()) return;
    event.preventDefault();
    // Aeltere Browser verlangen returnValue fuer den Dialog.
    event.returnValue = "";
  }
}
