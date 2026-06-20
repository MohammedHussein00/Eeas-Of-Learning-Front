// transloco-loader.ts
import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@ngneat/transloco';
import { HttpClient } from '@angular/common/http';

/**
 * Supports two path formats that Transloco passes to getTranslation():
 *
 *   1. Root scope  → lang = "en" | "ar"
 *      Loads: /assets/i18n/en.json
 *
 *   2. Named scope → lang = "login/en" | "teacherDashboard/en" | etc.
 *      Loads: /assets/i18n/login/en.json
 *
 * The loader never needs to know which components exist — Transloco
 * builds the path string and passes it here automatically.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}