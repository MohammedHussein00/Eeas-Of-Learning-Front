// features/Student/student-notifications/student-notifications.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Bell, CheckCheck, Trash2, Clock } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Language } from '../../../core/services/language';
import { StudentProfile, NotificationItem } from '../../../core/services/student-profile';

@Component({
  selector: 'app-student-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-notifications.html',
  styleUrls: ['./student-notifications.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentNotifications' }],
})
export class StudentNotifications implements OnInit {
  private http     = inject(HttpClient);
  private config   = inject(APP_CONFIG);
  private language = inject(Language);
  private service  = inject(StudentProfile);

  readonly BellIcon  = Bell;
  readonly CheckIcon = CheckCheck;
  readonly TrashIcon = Trash2;
  readonly ClockIcon = Clock;

  loading = signal(true);
  items   = signal<NotificationItem[]>([]);

  ngOnInit(): void {
    this.load();
    this.language.onLanguageChange(() => this.load());
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const lang = this.language.getCurrentLanguage();
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: NotificationItem[] }>(
          `${this.config.baseUrl}/api/notifications?page=1&pageSize=30`,
          { headers: { 'X-Language': lang } }
        )
      );
      this.items.set(res.success && res.data ? res.data : []);
    } catch {
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async markRead(item: NotificationItem): Promise<void> {
    if (item.isRead) return;
    const ok = await this.service.markAsRead(item.id);
    if (ok) this.items.update(list => list.map(n => n.id === item.id ? { ...n, isRead: true } : n));
  }

  async markAllRead(): Promise<void> {
    const ok = await this.service.markAllAsRead();
    if (ok) this.items.update(list => list.map(n => ({ ...n, isRead: true })));
  }

  async remove(item: NotificationItem): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.delete<{ success: boolean }>(`${this.config.baseUrl}/api/notifications/${item.id}`)
      );
      if (res.success) this.items.update(list => list.filter(n => n.id !== item.id));
    } catch { /* ignore */ }
  }

  getTimeAgo(date: string): string {
    return this.service.getTimeAgo(date);
  }
}
