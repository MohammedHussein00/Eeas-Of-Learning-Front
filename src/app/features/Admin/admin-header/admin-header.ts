// features/admin/components/admin-header/admin-header.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { Auth } from '../../../core/services/auth';
import { Language } from '../../../core/services/language';
import { Notification, NotificationItem } from '../../../core/services/notification';
import { AdminProfile } from '../../../core/services/admin-profile';
import { Cookie } from '../../../core/services/cookie';
import { ClickOutsideDirective } from '../../../core/directives/click-outside.directive';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { LucideAngularModule,
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
  CheckCircle
} from 'lucide-angular';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, LucideAngularModule, ClickOutsideDirective, NzDropDownModule, NzMenuModule],
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.scss']
})
export class AdminHeader implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private router = inject(Router);
  private language = inject(Language);
  private notificationService = inject(Notification);
  private adminProfile = inject(AdminProfile);
  private cookie = inject(Cookie);

  // Lucide Icons
  readonly BellIcon = Bell;
  readonly LogOutIcon = LogOut;
  readonly UserIcon = User;
  readonly LayoutDashboardIcon = LayoutDashboard;
  readonly BookOpenIcon = BookOpen;
  readonly DollarSignIcon = DollarSign;
  readonly BadgeCheckIcon = BadgeCheck;
  readonly MailIcon = Mail;
  readonly SmartphoneIcon = Smartphone;
  readonly MessageCircleIcon = MessageCircle;
  readonly ClockIcon = Clock;
  readonly UsersIcon = Users;
  readonly StarIcon = Star;
  readonly MenuIcon = Menu;
  readonly GlobeIcon = Globe;
  readonly ChevronDownIcon = ChevronDown;
  readonly CheckCircleIcon = CheckCircle;

  // Signals from services
  notifications = this.notificationService.notifications;
  unreadCount = this.notificationService.unreadCount;
  totalCount = this.notificationService.totalCount;
  notificationsLoading = this.notificationService.loading;
  profile = this.adminProfile.profile;
  isVerified = this.adminProfile.isVerified;
  currentLang = this.language.currentLang;
  isRtl = this.language.isRtl;

  // Local signals
  mobileMenuOpen = signal(false);
  notifOpen = signal(false);

  // Mobile menu items
  mobileMenuItems = [
    { key: 'dashboard',  icon: LayoutDashboard, label: 'dashboard',   path: '/dash/dashboard' },
    { key: 'profile',    icon: User,            label: 'my_profile',  path: '/dash/profile' },
    { key: 'courses',    icon: BookOpen,        label: 'my_courses',  path: '/dash/courses' },
    { key: 'teachers',   icon: Users,           label: 'teachers',    path: '/dash/teachers' },
    { key: 'reviews',    icon: Star,            label: 'reviews',     path: '/dash/reviews' },
    { key: 'earnings',   icon: DollarSign,      label: 'earnings',    path: '/dash/earning' },
  ];

  // Computed values
  avatarSrc = computed(() => {
    const img = this.cookie.retrieveCookie('n9u0oCnjyyntd06AU5wrg');
    const userName = this.cookie.retrieveCookie('userName') || 'Admin';
    if (!img) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=3d5af1&color=fff&bold=true`;
    }
    if (img.startsWith('http') || img.includes('googleusercontent')) return img;
    return `https://localhost:7091/${img}`;
  });

  userName = computed(() => this.cookie.retrieveCookie('userName') || 'Admin');

  ngOnInit(): void {
    this.adminProfile.fetchProfile();
    this.notificationService.fetchSummary();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  toggleLanguage(): void {
    this.language.toggleLanguage();
  }

  toggleNotifications(): void {
    this.notifOpen.update(open => !open);
    if (this.notifOpen()) {
      this.notificationService.fetchUnreadNotifications();
    }
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
    this.navigateTo('/dash/notifications');
  }

  viewAllNotifications(): void {
    this.notifOpen.set(false);
    this.navigateTo('/dash/notifications');
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.mobileMenuOpen.set(false);
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