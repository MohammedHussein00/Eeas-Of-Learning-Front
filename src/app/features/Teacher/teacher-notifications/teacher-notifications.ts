import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, RefreshCw, Bell, Check, Eye, Clock,
  Trash2, CheckCircle, AlertCircle, Globe, Mail,
  Smartphone, MessageCircle, BookOpen
} from 'lucide-angular';

import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzEmptyModule } from 'ng-zorro-antd/empty';

import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  body: string;
  type?: string;
  priority?: string;
  iconName?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  isPushSent: boolean;
  isEmailSent: boolean;
  isSmsSent: boolean;
  pushSentAt?: string | null;
  emailSentAt?: string | null;
  smsSentAt?: string | null;
  redirectData?: string | Record<string, string>;
  data?: string | Record<string, unknown>;
}

interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

interface TotalCounts {
  total: number;
  unread: number;
  read: number;
}

@Component({
  selector: 'app-teacher-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTagModule,
    NzTooltipModule,
    NzModalModule,
    NzPaginationModule,
    NzBadgeModule,
    NzButtonModule,
    NzEmptyModule,
  ],
  templateUrl: './teacher-notifications.html',
  styleUrls: ['./teacher-notifications.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherNotifications' },
  ],
})
export class TeacherNotifications implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private config = inject(APP_CONFIG);
  private notify = inject(NzNotificationService);
  private msg = inject(NzMessageService);
  private transloco = inject(TranslocoService);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon = ArrowLeft;
  readonly RefreshIcon = RefreshCw;
  readonly BellIcon = Bell;
  readonly CheckIcon = Check;
  readonly EyeIcon = Eye;
  readonly ClockIcon = Clock;
  readonly DeleteIcon = Trash2;
  readonly CheckCircleIcon = CheckCircle;
  readonly AlertCircleIcon = AlertCircle;
  readonly GlobeIcon = Globe;
  readonly MailIcon = Mail;
  readonly PhoneIcon = Smartphone;
  readonly MessageIcon = MessageCircle;
  readonly ReadIcon = BookOpen;

  // ── State ──────────────────────────────────────────────────────────
  loading = signal(true);
  notifications = signal<Notification[]>([]);
  pagination = signal<PaginationState>({ current: 1, pageSize: 20, total: 0 });
  totalCounts = signal<TotalCounts>({ total: 0, unread: 0, read: 0 });
  filter = signal<'all' | 'unread' | 'read'>('all');

  // Modals
  detailModalVisible = signal(false);
  selectedNotification = signal<Notification | null>(null);
  deleteModalVisible = signal(false);
  deleteNotifId = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────
  filteredNotifications = computed(() => {
    const f = this.filter();
    const notifs = this.notifications();
    if (f === 'unread') return notifs.filter(n => !n.isRead);
    if (f === 'read') return notifs.filter(n => n.isRead);
    return notifs;
  });

  stats = computed(() => {
    const counts = this.totalCounts();
    return [
      {
        label: this.t('total_notifications'),
        value: counts.total,
        color: '#1890ff',
        bg: '#e6f7ff',
        icon: this.BellIcon,
      },
      {
        label: this.t('unread'),
        value: counts.unread,
        color: '#fa8c16',
        bg: '#fff7e6',
        icon: this.AlertCircleIcon,
      },
      {
        label: this.t('read'),
        value: counts.read,
        color: '#52c41a',
        bg: '#f6ffed',
        icon: this.CheckCircleIcon,
      },
    ];
  });

  hasUnread = computed(() => this.totalCounts().unread > 0);
  hasRead = computed(() => this.totalCounts().read > 0);

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fetchNotifications(1, 20);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Fetching ──────────────────────────────────────────────────
  async fetchNotifications(page: number = 1, pageSize: number = 20): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(
          `${this.config.baseUrl}/api/notifications?page=${page}&pageSize=${pageSize}`
        )
      );
      if (res?.success) {
        const data = res.data || [];
        this.notifications.set(data);
        this.pagination.set({
          current: res.pagination?.currentPage || page,
          pageSize: res.pagination?.pageSize || pageSize,
          total: res.pagination?.totalCount || 0,
        });
        this.totalCounts.set({
          total: res.pagination?.totalCount ?? data.length,
          unread: res.pagination?.unreadCount ?? data.filter((n: Notification) => !n.isRead).length,
          read: res.pagination?.readCount ?? data.filter((n: Notification) => n.isRead).length,
        });
      }
    } catch {
      this.msg.error(this.t('failed_to_load_notifications'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────
  async markAsRead(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/notifications/${id}/mark-read`, {})
      );
      if (res?.success) {
        this.notifications.update(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
        );
        this.totalCounts.update(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1),
          read: prev.read + 1,
        }));
        this.msg.success(this.t('marked_as_read'));
      }
    } catch {
      this.msg.error(this.t('failed_to_mark_read'));
    }
  }

  async markAllRead(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/notifications/mark-all-read`, {})
      );
      if (res?.success) {
        this.notifications.update(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        this.totalCounts.update(prev => ({ ...prev, read: prev.total, unread: 0 }));
        this.msg.success(this.t('all_marked_read'));
      }
    } catch {
      this.msg.error(this.t('failed_to_mark_all_read'));
    }
  }

  async deleteNotification(): Promise<void> {
    const id = this.deleteNotifId();
    if (!id) return;

    try {
      const res = await firstValueFrom(
        this.http.delete<any>(`${this.config.baseUrl}/api/notifications/${id}`)
      );
      if (res?.success) {
        const deleted = this.notifications().find(n => n.id === id);
        this.notifications.update(prev => prev.filter(n => n.id !== id));
        this.totalCounts.update(prev => ({
          total: prev.total - 1,
          unread: deleted && !deleted.isRead ? prev.unread - 1 : prev.unread,
          read: deleted && deleted.isRead ? prev.read - 1 : prev.read,
        }));
        this.msg.success(this.t('notification_deleted'));
        this.deleteModalVisible.set(false);
        this.deleteNotifId.set(null);
      }
    } catch {
      this.msg.error(this.t('failed_to_delete'));
    }
  }

  async deleteAllRead(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.delete<any>(`${this.config.baseUrl}/api/notifications/read`)
      );
      if (res?.success) {
        this.notifications.update(prev => prev.filter(n => !n.isRead));
        const unread = this.totalCounts().unread;
        this.totalCounts.update(() => ({ total: unread, unread, read: 0 }));
        this.msg.success(this.t('read_notifications_deleted'));
      }
    } catch {
      this.msg.error(this.t('failed_to_delete_read'));
    }
  }

  onRefresh(): void {
    const p = this.pagination();
    this.fetchNotifications(p.current, p.pageSize);
  }

  onPageChange(page: number): void {
    const p = this.pagination();
    this.fetchNotifications(page, p.pageSize);
  }

  onPageSizeChange(pageSize: number): void {
    this.fetchNotifications(1, pageSize);
  }

  openDetail(notification: Notification): void {
    this.selectedNotification.set(notification);
    this.detailModalVisible.set(true);
  }

  closeDetail(): void {
    this.detailModalVisible.set(false);
    this.selectedNotification.set(null);
  }

  openDeleteModal(id: string): void {
    this.deleteNotifId.set(id);
    this.deleteModalVisible.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalVisible.set(false);
    this.deleteNotifId.set(null);
  }

  handleMarkReadInDetail(id: string): void {
    this.markAsRead(id);
    this.closeDetail();
  }

  handleDeleteInDetail(id: string): void {
    this.closeDetail();
    this.openDeleteModal(id);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  getRedirectPath(notification: Notification): string | null {
    try {
      const redirect = typeof notification.redirectData === 'string'
        ? JSON.parse(notification.redirectData)
        : notification.redirectData;
      return redirect?.web || redirect?.url || redirect?.link || null;
    } catch {
      return null;
    }
  }

  navigateToRedirect(notification: Notification): void {
    const path = this.getRedirectPath(notification);
    if (path) {
      this.router.navigate([path]);
      this.closeDetail();
    }
  }

  priorityColor(priority?: string): string {
    switch (priority?.toLowerCase()) {
      case 'urgent': case 'critical': case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'blue';
    }
  }

  formatTime(date: string): string {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return this.t('just_now');
    if (minutes < 60) return `${minutes} ${this.t('minutes_ago')}`;
    if (hours < 24) return `${hours} ${this.t('hours_ago')}`;
    if (days < 7) return `${days} ${this.t('days_ago')}`;

    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateTime(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  goBack(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  t(key: string, fallback = key): string {
    const result = this.transloco.translate(`teacherNotifications.${key}`);
    return result && result !== `teacherNotifications.${key}` ? result : fallback;
  }
}