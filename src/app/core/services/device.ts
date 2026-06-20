import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Cookie } from './cookie';

@Injectable({ providedIn: 'root' })
export class Device {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private cookie: Cookie
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  getDeviceId(): string {
    if (!this.isBrowser) return 'ssr_device';
    const key = 'eol_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  getDeviceName(): string {
    if (!this.isBrowser) return 'SSR Bot';
    return /mobile|android|iphone|ipad/i.test(navigator.userAgent)
      ? 'Mobile Browser'
      : 'Desktop Browser';
  }

  async getFcmToken(): Promise<string | null> {
    if (!this.isBrowser) return null;

    try {
      // Object destructuring — NOT array destructuring
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');

      // Get or initialize app
      const apps = getApps();
      const app = apps.length > 0 ? apps[0] : initializeApp({
        apiKey: (window as any).__env?.NG_APP_FIREBASE_API_KEY ?? '',
        projectId: (window as any).__env?.NG_APP_FIREBASE_PROJECT_ID ?? '',
        messagingSenderId: (window as any).__env?.NG_APP_FIREBASE_MESSAGING_SENDER_ID ?? '',
        appId: (window as any).__env?.NG_APP_FIREBASE_APP_ID ?? '',
      });

      const messaging = getMessaging(app);
      return await getToken(messaging, {
        vapidKey: (window as any).__env?.VITE_FIREBASE_VAPID_KEY ?? ''
      });
    } catch {
      return null;
    }
  }

  saveDeviceCookies(data: Record<string, string>): void {
    const MAP = {
      deviceId:   'xD3vId8kPqR2mNwT',
      platform:   'xD3vPl7sKjM9nBvW',
      deviceName: 'xD3vNm4wQtY6cLpX',
    };
    if (data[MAP.deviceId]) {
      this.cookie.setCookie(MAP.deviceId, data[MAP.deviceId]);
      this.cookie.setCookie(MAP.platform, data[MAP.platform] ?? '');
      this.cookie.setCookie(MAP.deviceName, data[MAP.deviceName] ?? '');
    }
  }
}