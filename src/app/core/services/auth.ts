// core/services/auth.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Cookie } from './cookie';
import { Device } from './device';
import { TranslocoService } from '@ngneat/transloco';
import { APP_CONFIG } from '../config/app.config';

export interface LoginPayload {
  email: string;
  password: string;
  deviceId: string;
  platform: string;
  deviceName: string;
  appVersion: string;
  deviceToken: string | null;
}

export interface LoginResponse {
  message?: string;
  [key: string]: any;
}

export interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken?: string;
  };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http      = inject(HttpClient);
  private cookies   = inject(Cookie);
  private device    = inject(Device);
  private transloco = inject(TranslocoService);
  private config    = inject(APP_CONFIG);

  private readonly SESSION_MAP: Record<string, string> = {
    fxSBE5PtmD35dx82BIpDg:  'fxSBE5PtmD35dx82BIpDg',
    etHy0B87RlH9CXykEzclg:  'etHy0B87RlH9CXykEzclg',
    n9u0oCnjyyntd06AU5wrg:  'n9u0oCnjyyntd06AU5wrg',
    vLumDgQ0vJHJLCherb2w:   'vLumDgQ0vJHJLCherb2w',
    qJSPpdVT7imnSyny9bdHRT: 'qJSPpdVT7imnSyny9bdHRT',
    myoCG1fKkpwykXJYCk2IQ:  'myoCG1fKkpwykXJYCk2IQ',
    zJwZPFops4k8YpmBQJT:    'zJwZPFops4k8YpmBQJT',
    sOy8tzFDqSeCelBu16PcWw: 'sOy8tzFDqSeCelBu16PcWw',
  };

  async login(values: { email: string; password: string }): Promise<LoginResponse> {
    const deviceToken = await this.device.getFcmToken();
    const payload: LoginPayload = {
      email:       values.email,
      password:    values.password,
      deviceId:    this.device.getDeviceId(),
      platform:    'web',
      deviceName:  this.device.getDeviceName(),
      appVersion:  '1.0.0',
      deviceToken: deviceToken ?? null,
    };

    const lang = this.cookies.retrieveCookie('lang') || 'en';
    return firstValueFrom(
      this.http.post<LoginResponse>(
        `${this.config.baseUrl}/api/Auth/login-admin`,
        payload,
        { headers: { 'Content-Type': 'application/json', 'X-Language': lang } }
      )
    );
  }

  getUserId(): string | null {
    const encrypted = this.cookies.retrieveCookie('fxSBE5PtmD35dx82BIpDg');
    return encrypted ? this.cookies.decrypt(encrypted) : null;
  }

  refreshToken(refreshToken: string, accessToken: string): Promise<RefreshResponse> {
    return firstValueFrom(
      this.http.post<RefreshResponse>(
        `${this.config.baseUrl}/api/Auth/refresh-token`,
        { refreshToken, accessToken },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Language':   this.cookies.retrieveCookie('lang') || 'en',
            'X-App-Id':     this.device.getDeviceId(),
          },
        }
      )
    );
  }

  /**
   * Called after login — server values are already encrypted once,
   * so use setCookieFromServer (encrypts once more → double-decrypt works).
   */
  saveSession(data: LoginResponse): void {
    this.cookies.clearAllCookies();
    for (const [cookieKey, dataKey] of Object.entries(this.SESSION_MAP)) {
      if (data[dataKey]) {
        this.cookies.setCookieFromServer(cookieKey, String(data[dataKey]));
      }
    }
    this.device.saveDeviceCookies(data);
  }

  getRole(): string | null {
    const encrypted = this.cookies.retrieveCookie('zJwZPFops4k8YpmBQJT');
    return encrypted ? this.cookies.decrypt(encrypted) : null;
  }

  isAuthenticated(): boolean {
    return this.cookies.retrieveCookie('fxSBE5PtmD35dx82BIpDg') !== null;
  }

  logout(): void {
    this.cookies.clearAllCookies();
    localStorage.clear();
  }
}
