import { registerLocaleData } from "@angular/common";
import localeDe from "@angular/common/locales/de";
import { LOCALE_ID, provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

// Zahlen und Daten werden deutsch formatiert (Audit Nr. 27): 7,5 Std.,
// 13.04.2026. Eingabefelder bleiben typisiert (type=number/date/time).
registerLocaleData(localeDe);

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: "de" },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
