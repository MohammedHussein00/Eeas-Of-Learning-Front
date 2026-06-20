// core/services/notification.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Language } from './language';
import { APP_CONFIG } from '../config/app.config';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  isPushSent: boolean;
  isEmailSent: boolean;
  isSmsSent: boolean;
  createdAt: string;
  type?: string;
  priority?: string;
}

export interface NotificationSummary {
  totalCount: number;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class Notification {
  private http            = inject(HttpClient);
  private languageService = inject(Language);
  private config          = inject(APP_CONFIG);    // ← global base URL

  // State signals
  private notificationsSignal = signal<NotificationItem[]>([]);
  private unreadCountSignal   = signal<number>(0);
  private totalCountSignal    = signal<number>(0);
  private loadingSignal       = signal<boolean>(false);
  private errorSignal         = signal<string | null>(null);

  // Public readonly signals
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount   = this.unreadCountSignal.asReadonly();
  readonly totalCount    = this.totalCountSignal.asReadonly();
  readonly loading       = this.loadingSignal.asReadonly();
  readonly error         = this.errorSignal.asReadonly();

  async fetchSummary(): Promise<void> {
    try {
      this.errorSignal.set(null);
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: NotificationSummary }>(
          `${this.config.baseUrl}/api/notifications/summary`
        )
      );
      if (res.success && res.data) {
        this.totalCountSignal.set(res.data.totalCount);
        this.unreadCountSignal.set(res.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notification summary:', error);
      this.errorSignal.set('Failed to load notification summary');
    }
  }

  async fetchUnreadNotifications(limit = 5): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const currentLang = this.languageService.getCurrentLanguage();
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: NotificationItem[] }>(
          `${this.config.baseUrl}/api/notifications/unread?limit=${limit}`,
          { headers: { 'X-Language': currentLang } }
        )
      );
      this.notificationsSignal.set(res.success && res.data ? res.data : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      this.notificationsSignal.set([]);
      this.errorSignal.set('Failed to load notifications');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async markAsRead(id: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          `${this.config.baseUrl}/api/notifications/${id}/mark-read`, {}
        )
      );
      if (res.success) {
        this.notificationsSignal.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        this.unreadCountSignal.update(prev => Math.max(0, prev - 1));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      this.errorSignal.set('Failed to mark notification as read');
      return false;
    }
  }

  async markAllAsRead(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          `${this.config.baseUrl}/api/notifications/mark-all-read`, {}
        )
      );
      if (res.success) {
        this.notificationsSignal.update(list => list.map(n => ({ ...n, isRead: true })));
        this.unreadCountSignal.set(0);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      this.errorSignal.set('Failed to mark all notifications as read');
      return false;
    }
  }

  getTimeAgo(date: string): string {
    const diffInMinutes = Math.floor(
      (Date.now() - new Date(date).getTime()) / 60000
    );
    if (diffInMinutes < 1)    return 'Just now';
    if (diffInMinutes < 60)   return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
    }
    return new Date(date).toLocaleDateString();
  }
}