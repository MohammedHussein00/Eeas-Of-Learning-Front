// core/services/language.service.ts
import {
  Injectable,
  Inject,
  PLATFORM_ID,
  signal,
  computed,
  effect,
} from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TranslocoService } from '@ngneat/transloco';
import { Cookie } from './cookie';

export type SupportedLanguage = 'en' | 'ar';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  dir: 'ltr' | 'rtl';
  flag: string;
}

@Injectable({ providedIn: 'root' })
export class Language {
  readonly languages: LanguageConfig[] = [
    { code: 'en', name: 'English', dir: 'ltr', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  ];

  private currentLangSignal = signal<SupportedLanguage>('en');
  readonly currentLang          = this.currentLangSignal.asReadonly();
  readonly isRtl                = computed(() => this.currentLangSignal() === 'ar');
  readonly currentLanguageConfig = computed(
    () => this.languages.find(l => l.code === this.currentLangSignal())!
  );

  // ---------------------------------------------------------------------------
  // Callbacks registered by components/services that must re-fetch on lang change
  // ---------------------------------------------------------------------------
  private onChangeCbs: Array<(lang: SupportedLanguage) => void> = [];

  /** Register a callback that fires whenever the active language changes. */
  onLanguageChange(cb: (lang: SupportedLanguage) => void): void {
    this.onChangeCbs.push(cb);
  }

  // ---------------------------------------------------------------------------
  // Constructor — use @Inject so PLATFORM_ID is resolved via DI properly
  // ---------------------------------------------------------------------------
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private transloco: TranslocoService,
    private cookie: Cookie,
  ) {
    this.initializeLanguage();

    // React to every signal change
    effect(() => {
      const lang = this.currentLangSignal();
      if (isPlatformBrowser(this.platformId)) {
        this.applyLanguageToDocument(lang);
        this.transloco.setActiveLang(lang);
        // Notify registered consumers (e.g. services that need to re-fetch)
        this.onChangeCbs.forEach(cb => cb(lang));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  private initializeLanguage(): void {
    if (isPlatformServer(this.platformId)) return;

    // Read the raw 'lang' cookie directly — it is stored as plain text
    // (not through Cookie.setCookie which double-encrypts) so we read it
    // with a simple document.cookie parse to avoid the encryption mismatch.
    const raw = this.getRawLangCookie();
    if (raw && this.isValidLanguage(raw as SupportedLanguage)) {
      this.currentLangSignal.set(raw as SupportedLanguage);
      return;
    }

    const browserLang = navigator.language.split('-')[0].toLowerCase();
    if (this.isValidLanguage(browserLang as SupportedLanguage)) {
      this.currentLangSignal.set(browserLang as SupportedLanguage);
      return;
    }

    this.currentLangSignal.set('en');
  }

  /**
   * Read the 'lang' cookie as a plain, un-encrypted value.
   *
   * We store the language cookie as plain text so that:
   *  1. The auth-interceptor can read it without going through Cookie service.
   *  2. The <html dir> inline script (see index.html fix) can read it without
   *     any crypto dependency.
   */
  private getRawLangCookie(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private isValidLanguage(lang: string): lang is SupportedLanguage {
    return this.languages.some(l => l.code === lang);
  }

  private applyLanguageToDocument(lang: SupportedLanguage): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const config = this.languages.find(l => l.code === lang);
    if (!config) return;

    document.documentElement.setAttribute('dir', config.dir);
    document.documentElement.setAttribute('lang', lang);

    if (config.dir === 'rtl') {
      document.body.classList.add('rtl');
      document.body.classList.remove('ltr');
    } else {
      document.body.classList.add('ltr');
      document.body.classList.remove('rtl');
    }

    // Store as plain text so the inline script in index.html and the
    // auth-interceptor can both read it without the Cookie encryption layer.
    this.saveLangCookiePlain(lang);
  }

  /**
   * Write the language as a plain-text cookie (no encryption).
   * This deliberately bypasses Cookie.setCookie which double-encrypts.
   */
  private saveLangCookiePlain(lang: string, days = 365): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie =
      `lang=${encodeURIComponent(lang)}; path=/; expires=${expires}; SameSite=Lax`;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  setLanguage(lang: SupportedLanguage): void {
    if (!this.isValidLanguage(lang)) {
      console.warn(`Invalid language: ${lang}`);
      return;
    }
    this.currentLangSignal.set(lang);
  }

  toggleLanguage(): void {
    const newLang = this.currentLangSignal() === 'en' ? 'ar' : 'en';
    this.setLanguage(newLang);
  }

  translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLangSignal();
  }
}