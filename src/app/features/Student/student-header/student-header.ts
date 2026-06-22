// features/Student/student-header/student-header.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { Auth } from '../../../core/services/auth';
import { Language } from '../../../core/services/language';
import { Cookie } from '../../../core/services/cookie';
import { StudentProfile, NotificationItem } from '../../../core/services/student-profile';
import { ClickOutsideDirective } from '../../../core/directives/click-outside.directive';
import {
  LucideAngularModule,
  Bell,
  LogOut,
  User,
  LayoutDashboard,
  BookOpen,
  Trophy,
  Clock,
  Globe,
  ChevronDown,
} from 'lucide-angular';

@Component({
  selector: 'app-student-header',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
    ClickOutsideDirective,
    NzBadgeModule,
    NzAvatarModule,
    NzSpinModule,
    NzEmptyModule,
  ],
  templateUrl: './student-header.html',
  styleUrls: ['./student-header.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentLayout' }],
})
export class StudentHeader implements OnInit {
  private auth           = inject(Auth);
  private router         = inject(Router);
  private language       = inject(Language);
  private cookie         = inject(Cookie);
  private studentProfile = inject(StudentProfile);

  // Icons
  readonly BellIcon            = Bell;
  readonly LogOutIcon          = LogOut;
  readonly UserIcon            = User;
  readonly LayoutDashboardIcon = LayoutDashboard;
  readonly BookOpenIcon        = BookOpen;
  readonly TrophyIcon          = Trophy;
  readonly ClockIcon           = Clock;
  readonly GlobeIcon           = Globe;
  readonly ChevronDownIcon     = ChevronDown;

  // Service signals
  notifications        = this.studentProfile.notifications;
  unreadCount          = this.studentProfile.unreadCount;
  totalCount           = this.studentProfile.totalCount;
  notificationsLoading = this.studentProfile.notificationsLoading;
  profile              = this.studentProfile.profile;
  isRtl                = this.language.isRtl;

  // Local UI state
  notifOpen       = signal(false);
  profileMenuOpen = signal(false);

  readonly profileMenuItems = [
    { key: 'dashboard',    icon: LayoutDashboard, label: 'dashboard',    path: '/student/dashboard' },
    { key: 'profile',      icon: User,            label: 'myProfile',    path: '/student/profile' },
    { key: 'courses',      icon: BookOpen,        label: 'myCourses',    path: '/student/courses' },
    { key: 'leaderboard',  icon: Trophy,          label: 'leaderboard',  path: '/student/leaderboard' },
    { key: 'logout',       icon: LogOut,          label: 'logout',       path: '/logout' },
  ];

  avatarSrc = computed(() => {
    const img = this.cookie.retrieveCookie('n9u0oCnjyyntd06AU5wrg');
    const userName = this.userName();
    if (!img) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=3d5af1&color=fff&bold=true`;
    }
    if (img.startsWith('http') || img.includes('googleusercontent')) return img;
    return `https://localhost:7091${img}`;
  });

  userName = computed(() =>
    this.profile()?.name || this.cookie.retrieveCookie('userName') || 'Student'
  );

  ngOnInit(): void {
    this.studentProfile.fetchProfile();
    this.studentProfile.fetchNotificationSummary();

    this.language.onLanguageChange(() => {
      this.studentProfile.fetchProfile();
      this.studentProfile.fetchNotificationSummary();
      if (this.notifOpen()) {
        this.studentProfile.fetchUnreadNotifications();
      }
    });
  }

  toggleLanguage(): void {
    this.language.toggleLanguage();
  }

  toggleNotifications(): void {
    this.notifOpen.update(open => !open);
    this.profileMenuOpen.set(false);
    if (this.notifOpen()) {
      this.studentProfile.fetchUnreadNotifications();
    }
  }

  closeNotifications(): void {
    this.notifOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update(open => !open);
    this.notifOpen.set(false);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  async markAllAsRead(): Promise<void> {
    await this.studentProfile.markAllAsRead();
  }

  async onNotificationClick(notification: NotificationItem): Promise<void> {
    if (!notification.isRead) {
      await this.studentProfile.markAsRead(notification.id);
    }
    this.notifOpen.set(false);
    this.router.navigate(['/student/notifications']);
  }

  viewAllNotifications(): void {
    this.notifOpen.set(false);
    this.router.navigate(['/student/notifications']);
  }

  navigateTo(path: string): void {
    if (path === '/logout') {
      this.logout();
      return;
    }
    this.router.navigate([path]);
    this.profileMenuOpen.set(false);
    this.notifOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getTimeAgo(date: string): string {
    return this.studentProfile.getTimeAgo(date);
  }
}
