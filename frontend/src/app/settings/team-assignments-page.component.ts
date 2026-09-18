import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type {
  Employee,
  Team,
  TeamAssignment,
  TeamAssignmentDraft,
} from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyTeamAssignment(): TeamAssignmentDraft {
  return { extNr: "", teamId: "", validFrom: "", validTo: "" };
}

@Component({
  selector: "xts-team-assignments-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./team-assignments-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./settings-page.css",
})
export class TeamAssignmentsPageComponent extends SettingsPage {
  protected readonly teamAssignments = signal<TeamAssignment[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected newTeamAssignment = emptyTeamAssignment();

  constructor() {
    super();
    void this.load();
  }

  protected activeEmployees(): Employee[] {
    return this.employees().filter((employee) => !employee.deleted);
  }

  protected activeTeams(): Team[] {
    return this.teams().filter((team) => team.active && !team.deleted);
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

  /** Auswahllisten und Zuordnungen laden gemeinsam: kein Fehler als leere Auswahl. */
  protected async load(): Promise<void> {
    await this.loader.track(
      () =>
        Promise.all([
          this.adminService.getTeamAssignments(),
          this.adminService.getEmployees(),
          this.adminService.getTeams(),
        ]),
      "Teamzuordnungen konnten nicht geladen werden.",
      ([teamAssignments, employees, teams]) => {
        this.teamAssignments.set(teamAssignments);
        this.employees.set(employees);
        this.teams.set(teams);
      },
    );
  }

  private async loadTeamAssignments(): Promise<void> {
    this.teamAssignments.set(await this.adminService.getTeamAssignments());
  }
}
