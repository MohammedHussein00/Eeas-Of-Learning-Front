// core/services/student-profile.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app.config';
import { Language } from './language';

export interface StudentProfileData {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  bio?: string;
  profileImagePath?: string;
  emailConfirmed?: boolean;
  isActive?: boolean;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  isPushSent?: boolean;
  isEmailSent?: boolean;
  isSmsSent?: boolean;
  createdAt: string;
  type?: string;
  priority?: string;
}

export interface NotificationSummary {
  totalCount: number;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class StudentProfile {
  private http = inject(HttpClient);
  private config = inject(APP_CONFIG);
  private languageService = inject(Language);

  // Profile state
  private profileSignal = signal<StudentProfileData | null>(null);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Notification state
  private notificationsSignal = signal<NotificationItem[]>([]);
  private unreadCountSignal = signal<number>(0);
  private totalCountSignal = signal<number>(0);
  private notificationsLoadingSignal = signal<boolean>(false);
  private notificationErrorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly profile = this.profileSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly totalCount = this.totalCountSignal.asReadonly();
  readonly notificationsLoading = this.notificationsLoadingSignal.asReadonly();
  readonly notificationError = this.notificationErrorSignal.asReadonly();

  async fetchProfile(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: StudentProfileData }>(
          `${this.config.baseUrl}/api/student/profile`
        )
      );
      if (res.success && res.data) {
        this.profileSignal.set(res.data);
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
      this.errorSignal.set('Failed to load profile');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  setProfile(data: StudentProfileData): void {
    this.profileSignal.set(data);
  }

  async fetchNotificationSummary(): Promise<void> {
    try {
      this.notificationErrorSignal.set(null);
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
      this.notificationErrorSignal.set('Failed to load notification summary');
    }
  }

  async fetchUnreadCount(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: { unreadCount: number } }>(
          `${this.config.baseUrl}/api/notifications/unread-count`
        )
      );
      if (res.success && res.data) {
        this.unreadCountSignal.set(res.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }

  async fetchUnreadNotifications(limit = 5): Promise<void> {
    this.notificationsLoadingSignal.set(true);
    this.notificationErrorSignal.set(null);
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
      this.notificationErrorSignal.set('Failed to load notifications');
    } finally {
      this.notificationsLoadingSignal.set(false);
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
      this.notificationErrorSignal.set('Failed to mark notification as read');
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
      this.notificationErrorSignal.set('Failed to mark all notifications as read');
      return false;
    }
  }

  clearProfile(): void {
    this.profileSignal.set(null);
    this.errorSignal.set(null);
  }

  getTimeAgo(date: string): string {
    const diffInMinutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
    }
    return new Date(date).toLocaleDateString();
  }
}
