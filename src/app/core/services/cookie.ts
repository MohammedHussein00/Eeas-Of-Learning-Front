import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as CryptoJS from 'crypto-js';

@Injectable({ providedIn: 'root' })
export class Cookie {
  private readonly key = CryptoJS.enc.Utf8.parse('encrypt!135790'.padEnd(32, ' '));
  private readonly iv  = CryptoJS.enc.Utf8.parse('1234567890123456');
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private encrypt(plaintext: string): string {
    return CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(plaintext),
      this.key,
      { iv: this.iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString();
  }

  decrypt(ciphertext: string): string {
    try {
      const d = CryptoJS.AES.decrypt(ciphertext, this.key, {
        iv: this.iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
      });
      return d.toString(CryptoJS.enc.Utf8);
    } catch {
      return '';
    }
  }

  /**
   * Stores a PLAIN value. Encrypts twice so retrieveCookie (double-decrypt) returns
   * the original plain value correctly.
   */
  setCookie(name: string, value: string, days = 7): void {
    if (!this.isBrowser) return;
    // Double-encrypt so the double-decrypt in retrieveCookie cancels out correctly
    const enc = this.encrypt(this.encrypt(value));
    const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(enc)}; path=/; expires=${expires}; secure; SameSite=Strict`;
  }

  /**
   * Stores a value that is ALREADY encrypted once by the server (e.g. login response).
   * Encrypts only once more so retrieveCookie (double-decrypt) returns the server's
   * original encrypted value → decrypt gives the plain value.
   *
   * Use this in saveSession() where data comes directly from the API.
   */
  setCookieFromServer(name: string, serverEncryptedValue: string, days = 7): void {
    if (!this.isBrowser) return;
    const enc = this.encrypt(serverEncryptedValue);
    const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(enc)}; path=/; expires=${expires}; secure; SameSite=Strict`;
  }

  private getRawCookie(name: string): string | null {
    if (!this.isBrowser) return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  /**
   * Always double-decrypts. Works with both setCookie and setCookieFromServer.
   * Returns null if the result is an empty string (decrypt failure).
   */
  retrieveCookie(name: string): string | null {
    const enc = this.getRawCookie(name);
    if (!enc) return null;
    const result = this.decrypt(this.decrypt(enc));
    return result || null;
  }

  clearCookie(name: string): void {
    if (!this.isBrowser) return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict`;
  }

  clearAllCookies(): void {
    if (!this.isBrowser) return;
    document.cookie.split(';').forEach(c => {
      const [name] = c.split('=');
      if (name?.trim()) this.clearCookie(name.trim());
    });
  }
}
