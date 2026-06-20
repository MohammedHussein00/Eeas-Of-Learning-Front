// features/teacher/components/teacher-header/teacher-header.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { Auth } from '../../../core/services/auth';
import { Language } from '../../../core/services/language';
import { Notification, NotificationItem } from '../../../core/services/notification';
import { TeacherProfile } from '../../../core/services/teacher-profile';
import { Cookie } from '../../../core/services/cookie';
import { ClickOutsideDirective } from '../../../core/directives/click-outside.directive';
import {
  LucideAngularModule,
  Bell,
  LogOut,
  User,
  LayoutDashboard,
  BookOpen,
  DollarSign,
  BadgeCheck,
  Mail,
  Smartphone,
  MessageCircle,
  Clock,
  Users,
  Star,
  Menu,
  Globe,
  ChevronDown,
  CheckCircle,
} from 'lucide-angular';

@Component({
  selector: 'app-teacher-header',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    TranslocoModule, 
    LucideAngularModule, 
    ClickOutsideDirective,
    NzDropDownModule,
    NzIconModule,
    NzBadgeModule,
    NzAvatarModule,
    NzDividerModule,
    NzSpinModule,
    NzEmptyModule,
    NzButtonModule
  ],
  templateUrl: './teacher-header.html',
  styleUrls: ['./teacher-header.scss'],
})
export class TeacherHeader implements OnInit, OnDestroy {
  private auth                = inject(Auth);
  private router              = inject(Router);
  private language            = inject(Language);
  private notificationService = inject(Notification);
  private teacherProfile      = inject(TeacherProfile);
  private cookie              = inject(Cookie);

  // Lucide Icons
  readonly BellIcon            = Bell;
  readonly LogOutIcon          = LogOut;
  readonly UserIcon            = User;
  readonly LayoutDashboardIcon = LayoutDashboard;
  readonly BookOpenIcon        = BookOpen;
  readonly DollarSignIcon      = DollarSign;
  readonly BadgeCheckIcon      = BadgeCheck;
  readonly MailIcon            = Mail;
  readonly SmartphoneIcon      = Smartphone;
  readonly MessageCircleIcon   = MessageCircle;
  readonly ClockIcon           = Clock;
  readonly UsersIcon           = Users;
  readonly StarIcon            = Star;
  readonly MenuIcon            = Menu;
  readonly GlobeIcon           = Globe;
  readonly ChevronDownIcon     = ChevronDown;
  readonly CheckCircleIcon     = CheckCircle;

  // Signals from services
  notifications      = this.notificationService.notifications;
  unreadCount        = this.notificationService.unreadCount;
  totalCount         = this.notificationService.totalCount;
  notificationsLoading = this.notificationService.loading;
  profile            = this.teacherProfile.profile;
  isVerified         = this.teacherProfile.isVerified;
  currentLang        = this.language.currentLang;
  isRtl              = this.language.isRtl;

  // Local signals
  mobileMenuOpen  = signal(false);
  notifOpen       = signal(false);
  profileMenuOpen = signal(false);

  // Mobile menu items
  mobileMenuItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'dashboard',   path: '/teacher/dashboard' },
    { key: 'profile',   icon: User,            label: 'my_profile',  path: '/teacher/profile' },
    { key: 'courses',   icon: BookOpen,        label: 'my_courses',  path: '/teacher/courses' },
    { key: 'students',  icon: Users,           label: 'my_students', path: '/teacher/students' },
    { key: 'reviews',   icon: Star,            label: 'reviews',     path: '/teacher/reviews' },
    { key: 'earnings',  icon: DollarSign,      label: 'earnings',    path: '/teacher/earnings' },
  ];

  // Profile dropdown items
  profileMenuItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'dashboard', path: '/teacher/dashboard' },
    { key: 'profile', icon: User, label: 'my_profile', path: '/teacher/profile' },
    { key: 'courses', icon: BookOpen, label: 'my_courses', path: '/teacher/courses' },
    { key: 'students', icon: Users, label: 'my_students', path: '/teacher/students' },
    { key: 'reviews', icon: Star, label: 'reviews', path: '/teacher/reviews' },
    { key: 'earnings', icon: DollarSign, label: 'earnings', path: '/teacher/earnings' },
    { key: 'logout', icon: LogOut, label: 'logout', path: '/logout' },
  ];

  // Computed values
  avatarSrc = computed(() => {
    const img      = this.cookie.retrieveCookie('n9u0oCnjyyntd06AU5wrg');
    const userName = this.cookie.retrieveCookie('userName') || 'Teacher';
    if (!img) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=3d5af1&color=fff&bold=true`;
    }
    if (img.startsWith('http') || img.includes('googleusercontent')) return img;
    return `https://localhost:7091${img}`;
  });

  userName = computed(() => this.cookie.retrieveCookie('userName') || 'Teacher');

  ngOnInit(): void {
    this.teacherProfile.fetchProfile();
    this.notificationService.fetchSummary();

    // Re-fetch data whenever the user switches language so API responses
    // come back in the correct language.
    this.language.onLanguageChange(() => {
      this.teacherProfile.fetchProfile();
      this.notificationService.fetchSummary();
      if (this.notifOpen()) {
        this.notificationService.fetchUnreadNotifications();
      }
    });
  }

  ngOnDestroy(): void {}

  toggleLanguage(): void {
    this.language.toggleLanguage();
  }

  toggleNotifications(): void {
    this.notifOpen.update(open => !open);
    this.profileMenuOpen.set(false);
    if (this.notifOpen()) {
      this.notificationService.fetchUnreadNotifications();
    }
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update(open => !open);
    this.notifOpen.set(false);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  closeNotifications(): void {
    this.notifOpen.set(false);
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
    this.notifOpen.set(false);
  }

  async onNotificationClick(notification: NotificationItem): Promise<void> {
    if (!notification.isRead) {
      await this.notificationService.markAsRead(notification.id);
    }
    this.notifOpen.set(false);
    this.navigateTo('/teacher/notifications');
  }

  viewAllNotifications(): void {
    this.notifOpen.set(false);
    this.navigateTo('/teacher/notifications');
  }

  navigateTo(path: string): void {
    if (path === '/logout') {
      this.logout();
      return;
    }
    this.router.navigate([path]);
    this.mobileMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.notifOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openMobileMenu(): void {
    this.mobileMenuOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  getTimeAgo(date: string): string {
    return this.notificationService.getTimeAgo(date);
  }
}