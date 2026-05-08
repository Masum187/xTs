import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "xts-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <header class="topbar">
      <div>
        <strong>xTS</strong>
        <span>TimeSheet</span>
      </div>
      <span class="environment">MVP Foundation</span>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styleUrl: "./app.component.css",
})
export class AppComponent {}
