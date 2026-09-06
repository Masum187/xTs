// Angular-Anbindung des OData-Adapters; die Transportschicht und die
// Antwortformen liegen ohne Angular-Abhaengigkeit in `odata-http.ts`, damit
// `auth.service.ts` sie ohne Importzyklus nutzen kann.

import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import { ODataHttp } from "./odata-http";

export { unwrapCollection, unwrapEntity, buildQuery } from "./odata-http";

@Injectable({
  providedIn: "root",
})
export class ODataClient extends ODataHttp {
  constructor() {
    const auth = inject(AuthService);
    super(environment.apiBaseUrl, () => auth.authHeaders());
  }
}
