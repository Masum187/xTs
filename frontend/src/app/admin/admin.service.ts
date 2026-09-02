import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import type { Rule } from "./admin.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class AdminService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getRules(): Promise<Rule[]> {
    const response = await fetch(`${this.baseUrl}/Rules`, {
      headers: this.auth.authHeaders(),
    });
    const body = await this.readJson<ODataResponse<Rule>>(response);
    return body.value;
  }

  async saveRule(rule: Rule): Promise<Rule> {
    const response = await fetch(`${this.baseUrl}/Rules`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.auth.authHeaders(),
      },
      body: JSON.stringify(rule),
    });
    return this.readJson<Rule>(response);
  }

  private async readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`Request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
