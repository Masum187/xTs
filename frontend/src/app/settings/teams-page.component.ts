import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type { Team, TeamDraft } from "../admin/admin.models";
import { LoadStatusComponent } from "../shared/load-status.component";
import { SettingsPage } from "./settings-page";

function emptyTeam(): TeamDraft {
  return { id: "", name: "", active: true };
}

@Component({
  selector: "xts-teams-page",
  imports: [FormsModule, LoadStatusComponent],
  templateUrl: "./teams-page.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./settings-page.css",
})
export class TeamsPageComponent extends SettingsPage {
  protected readonly teams = signal<Team[]>([]);
  protected newTeam = emptyTeam();

  constructor() {
    super();
    void this.load();
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

  protected async load(): Promise<void> {
    await this.loader.track(
      () => this.adminService.getTeams(),
      "Teams konnten nicht geladen werden.",
      (teams) => this.teams.set(teams),
    );
  }

  private async loadTeams(): Promise<void> {
    this.teams.set(await this.adminService.getTeams());
  }
}
