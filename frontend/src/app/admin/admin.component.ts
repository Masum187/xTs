import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ApiError, describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import type {
  AuditEntry,
  CostObject,
  CostObjectAssignment,
  CostObjectAssignmentDraft,
  CostObjectDraft,
  Employee,
  EmployeeDraft,
  Rule,
  Team,
  TeamAssignment,
  TeamAssignmentDraft,
  TeamDraft,
} from "./admin.models";
import { COST_OBJECT_TYPES } from "./admin.models";
import { AdminService } from "./admin.service";

const INFOTYPE_LABELS: Record<number, string> = {
  1: "Aggregation Beauftragung",
  2: "Freischaltung Stundenschreibung",
  3: "Monatsabschluss Stundenerfassung",
};

const VALUE_OPTIONS: Record<number, { value: string; label: string }[]> = {
  1: [{ value: "MA_KONT", label: "Je Mitarbeiter und Kontierung" }],
  2: [
    { value: "P", label: "P – ab BANF vorhanden" },
    { value: "B", label: "B – ab Bestellung vorhanden" },
  ],
  // Entscheidung 18: Vormonat erfassbar bis einschliesslich diesem Tag.
  3: Array.from({ length: 28 }, (_item, index) => ({
    value: String(index + 1),
    label: `Vormonat bis zum ${index + 1}. des Folgemonats`,
  })),
};

const CATEGORY_LABELS: Record<string, string> = {
  status: "Statuswechsel",
  job: "Job",
  masterdata: "Stammdaten",
  rule: "Regelwerk",
  system: "System",
};

function emptyEmployee(): EmployeeDraft {
  return {
    extNr: "",
    firstName: "",
    lastName: "",
    company: "QualityTimes",
    sapAccount: "",
    aadOid: "",
    aadUpn: "",
    active: true,
    resourceManager: "",
  };
}

function emptyTeam(): TeamDraft {
  return { id: "", name: "", active: true };
}

function emptyTeamAssignment(): TeamAssignmentDraft {
  return { extNr: "", teamId: "", validFrom: "", validTo: "" };
}

function emptyCostObject(): CostObjectDraft {
  return { coIdent: "", type: "KS", description: "", active: true };
}

function emptyCostObjectAssignment(): CostObjectAssignmentDraft {
  return { extNr: "", coIdent: "", validFrom: "", validTo: "" };
}

@Component({
  selector: "xts-admin",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./admin.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./admin.component.css",
})
export class AdminComponent {
  private readonly adminService = inject(AdminService);

  protected readonly costObjectTypes = COST_OBJECT_TYPES;
  protected readonly loader = new LoadState();
  /** Eigener Zustand fuer das Protokoll, das auch per Filter neu laedt. */
  protected readonly auditLoader = new LoadState();
  protected readonly busy = new BusyState();

  protected readonly employees = signal<Employee[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly teamAssignments = signal<TeamAssignment[]>([]);
  protected readonly costObjects = signal<CostObject[]>([]);
  protected readonly assignments = signal<CostObjectAssignment[]>([]);
  protected readonly rules = signal<Rule[]>([]);

  protected readonly auditEntries = signal<AuditEntry[]>([]);
  protected readonly auditCategory = signal<string>("");
  protected readonly auditSeverity = signal<string>("");
  protected readonly auditSearch = signal<string>("");

  protected newEmployee = emptyEmployee();
  protected newTeam = emptyTeam();
  protected newTeamAssignment = emptyTeamAssignment();
  protected newCostObject = emptyCostObject();
  protected newAssignment = emptyCostObjectAssignment();

  protected readonly message = signal<string>("");
  protected readonly messageKind = signal<"ok" | "error">("ok");

  constructor() {
    void this.loadAll();
  }

  protected infotypeLabel(rule: Rule): string {
    return INFOTYPE_LABELS[rule.infotype];
  }

  protected valueOptions(rule: Rule): { value: string; label: string }[] {
    return VALUE_OPTIONS[rule.infotype];
  }

  protected categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  protected formatTime(iso: string): string {
    return iso.replace("T", " ").slice(0, 19);
  }

  protected async updateAuditFilter(
    patch: Partial<{ category: string; severity: string; q: string }>,
  ): Promise<void> {
    if (patch.category !== undefined) this.auditCategory.set(patch.category);
    if (patch.severity !== undefined) this.auditSeverity.set(patch.severity);
    if (patch.q !== undefined) this.auditSearch.set(patch.q);
    await this.loadAuditLog();
  }

  protected async reloadAuditLog(): Promise<void> {
    await this.loadAuditLog();
  }

  protected activeEmployees(): Employee[] {
    return this.employees().filter((employee) => !employee.deleted);
  }

  protected activeTeams(): Team[] {
    return this.teams().filter((team) => team.active && !team.deleted);
  }

  protected availableCostObjects(): CostObject[] {
    return this.costObjects().filter((item) => !item.deleted);
  }

  protected updateRule(rule: Rule, patch: Partial<Rule>): void {
    this.rules.update((rules) =>
      rules.map((candidate) =>
        candidate.infotype === rule.infotype
          ? { ...candidate, ...patch }
          : candidate,
      ),
    );
  }

  protected async saveRule(rule: Rule): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveRule(rule);
      this.rules.set(await this.adminService.getRules());
      return `Regel „${this.infotypeLabel(saved)}" gespeichert (${saved.value}, ${
        saved.active ? "aktiv" : "inaktiv"
      }). Die Freischaltungen werden sofort neu abgeleitet.`;
    });
  }

  protected async saveEmployee(employee: EmployeeDraft): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveEmployee(employee);
      await this.loadEmployees();
      if (employee === this.newEmployee) this.newEmployee = emptyEmployee();
      return `Mitarbeiter ${saved.extNr} (${saved.displayName}) gespeichert.`;
    });
  }

  protected async deleteEmployee(employee: Employee): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveEmployee({ ...employee, deleted: true });
      await this.loadEmployees();
      return `Mitarbeiter ${employee.extNr} logisch gelöscht.`;
    });
  }

  protected async saveTeam(team: TeamDraft): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveTeam(team);
      await this.loadTeams();
      if (team === this.newTeam) this.newTeam = emptyTeam();
      return `Team ${saved.id} gespeichert (${saved.active ? "aktiv" : "inaktiv"}).`;
    });
  }

  protected async deleteTeam(team: Team): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveTeam({ ...team, deleted: true });
      await this.loadTeams();
      return `Team ${team.id} logisch gelöscht.`;
    });
  }

  protected async saveTeamAssignment(
    assignment: TeamAssignmentDraft,
  ): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveTeamAssignment(assignment);
      await this.loadTeamAssignments();
      if (assignment === this.newTeamAssignment) {
        this.newTeamAssignment = emptyTeamAssignment();
      }
      return `Teamzuordnung ${saved.id} gespeichert (${saved.extNr} → ${saved.teamId}, ${saved.validFrom} – ${saved.validTo}).`;
    });
  }

  protected async deleteTeamAssignment(
    assignment: TeamAssignment,
  ): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveTeamAssignment({
        ...assignment,
        deleted: true,
      });
      await this.loadTeamAssignments();
      return `Teamzuordnung ${assignment.id} logisch gelöscht.`;
    });
  }

  protected async saveCostObject(costObject: CostObjectDraft): Promise<void> {
    await this.run(async () => {
      const saved = await this.adminService.saveCostObject(costObject);
      await this.loadCostObjects();
      if (costObject === this.newCostObject) {
        this.newCostObject = emptyCostObject();
      }
      return `Kontierung ${saved.coIdent} (${saved.type}) gespeichert.`;
    });
  }

  protected async deleteCostObject(costObject: CostObject): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveCostObject({ ...costObject, deleted: true });
      await this.loadCostObjects();
      await this.loadAssignments();
      return `Kontierung ${costObject.coIdent} logisch gelöscht. Sie wird in Planung und Stundenschreibung nicht mehr angeboten.`;
    });
  }

  protected async checkCostObject(costObject: CostObjectDraft): Promise<void> {
    await this.run(async () => {
      const result = await this.adminService.checkCostObject(costObject);
      if (!result.valid) {
        throw new ApiError(200, "CO_CHECK_FAILED", result.message);
      }
      return `SAP-CO-Prüfung (${result.source}): ${result.message}`;
    });
  }

  protected async saveAssignment(
    assignment: CostObjectAssignmentDraft,
  ): Promise<void> {
    await this.run(async () => {
      const saved =
        await this.adminService.saveCostObjectAssignment(assignment);
      await this.loadAssignments();
      if (assignment === this.newAssignment) {
        this.newAssignment = emptyCostObjectAssignment();
      }
      return `Zuordnung ${saved.id} gespeichert (${saved.description}, ${saved.validFrom} – ${saved.validTo}).`;
    });
  }

  protected async deleteAssignment(
    assignment: CostObjectAssignment,
  ): Promise<void> {
    await this.run(async () => {
      await this.adminService.saveCostObjectAssignment({
        ...assignment,
        deleted: true,
      });
      await this.loadAssignments();
      return `Zuordnung ${assignment.id} logisch gelöscht.`;
    });
  }

  protected async resetTestData(): Promise<void> {
    await this.run(async () => {
      const result = await this.adminService.resetTestData();
      await this.loadAll();
      return `Testdatenpaket ${result.package} zurückgesetzt (${result.counts["timesheetDays"]} Stundenzettel-Tage, ${result.counts["orders"]} Beauftragungen, ${result.counts["planningEntries"]} Planzeilen).`;
    });
  }

  protected reload(): void {
    void this.loadAll();
  }

  private async run(action: () => Promise<string>): Promise<void> {
    await this.busy.guard(async () => {
      try {
        this.message.set(await action());
        this.messageKind.set("ok");
      } catch (error) {
        this.messageKind.set("error");
        this.message.set(this.describeError(error));
      }
      await this.loadAuditLog();
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof ApiError && error.code === "CO_CHECK_FAILED") {
      return `SAP-CO-Prüfung nicht bestanden: ${error.message}`;
    }
    return describeApiError(error, "Speichern fehlgeschlagen.");
  }

  private async loadAll(): Promise<void> {
    await this.loader.track(
      () =>
        Promise.all([
          this.adminService.getEmployees(),
          this.adminService.getTeams(),
          this.adminService.getTeamAssignments(),
          this.adminService.getCostObjects(),
          this.adminService.getCostObjectAssignments(),
          this.adminService.getRules(),
        ]),
      "Verwaltungsdaten konnten nicht geladen werden.",
      ([
        employees,
        teams,
        teamAssignments,
        costObjects,
        assignments,
        rules,
      ]) => {
        this.employees.set(employees);
        this.teams.set(teams);
        this.teamAssignments.set(teamAssignments);
        this.costObjects.set(costObjects);
        this.assignments.set(assignments);
        this.rules.set(rules);
      },
    );
    await this.loadAuditLog();
  }

  private async loadAuditLog(): Promise<void> {
    await this.auditLoader.track(
      () =>
        this.adminService.getAuditLog({
          category: this.auditCategory(),
          severity: this.auditSeverity(),
          q: this.auditSearch().trim(),
        }),
      "Protokoll konnte nicht geladen werden.",
      (entries) => this.auditEntries.set(entries),
    );
  }

  private async loadEmployees(): Promise<void> {
    this.employees.set(await this.adminService.getEmployees());
  }

  private async loadTeams(): Promise<void> {
    this.teams.set(await this.adminService.getTeams());
  }

  private async loadTeamAssignments(): Promise<void> {
    this.teamAssignments.set(await this.adminService.getTeamAssignments());
  }

  private async loadCostObjects(): Promise<void> {
    this.costObjects.set(await this.adminService.getCostObjects());
  }

  private async loadAssignments(): Promise<void> {
    this.assignments.set(await this.adminService.getCostObjectAssignments());
  }
}
