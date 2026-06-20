// shared/components/header/header.ts
import { Component, inject, signal, computed, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@ngneat/transloco';
import { filter } from 'rxjs/operators';
import { Language } from '../../../core/services/language';
import { Cookie } from '../../../core/services/cookie';
import { ClickOutsideDirective } from '../../../core/directives/click-outside.directive';
import { APP_CONFIG } from '../../../core/config/app.config';
import {
  LucideAngularModule,
  GraduationCap,
  LogIn,
  UserPlus,
  Menu,
  X,
  BookOpen,
  Home,
  Info,
  Phone,
  Bell,
  Globe,
  ChevronDown,
  LogOut,
  User,
  LayoutDashboard,
  BookMarked,
  Users,
  Star,
  DollarSign,
  CheckCircle,
  Clock,
  Mail,
  Smartphone,
  ArrowRight,
} from 'lucide-angular';

export type HeaderVariant = 'public' | 'teacher' | 'student' | 'admin';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  isPushSent: boolean;
  isEmailSent: boolean;
  isSmsSent: boolean;
  createdAt: string;
}

interface UserProfile {
  fullName?: string;
  headline?: string;
  isVerified?: boolean;
  profilePictureUrl?: string;
}

interface NavLink {
  label: string;
  href: string;
  icon: any;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, LucideAngularModule, ClickOutsideDirective],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
})
export class Header implements OnInit, OnDestroy {
  @Input() variant: HeaderVariant = 'public';

  private router   = inject(Router);
  private language = inject(Language);
  private cookie   = inject(Cookie);
  private http     = inject(HttpClient);
  private config     = inject(APP_CONFIG);

  // Lucide icons
  readonly GraduationCapIcon  = GraduationCap;
  readonly LogInIcon          = LogIn;
  readonly UserPlusIcon       = UserPlus;
  readonly MenuIcon           = Menu;
  readonly XIcon              = X;
  readonly BookOpenIcon       = BookOpen;
  readonly HomeIcon           = Home;
  readonly InfoIcon           = Info;
  readonly PhoneIcon          = Phone;
  readonly BellIcon           = Bell;
  readonly GlobeIcon          = Globe;
  readonly ChevronDownIcon    = ChevronDown;
  readonly LogOutIcon         = LogOut;
  readonly UserIcon           = User;
  readonly LayoutDashboardIcon = LayoutDashboard;
  readonly BookMarkedIcon     = BookMarked;
  readonly UsersIcon          = Users;
  readonly StarIcon           = Star;
  readonly DollarSignIcon     = DollarSign;
  readonly CheckCircleIcon    = CheckCircle;
  readonly ClockIcon          = Clock;
  readonly MailIcon           = Mail;
  readonly SmartphoneIcon     = Smartphone;
  readonly ArrowRightIcon     = ArrowRight;

  isRtl = this.language.isRtl;

  // Local state
  scrolled       = signal(false);
  mobileOpen     = signal(false);
  profileOpen    = signal(false);
  notifOpen      = signal(false);
  notifications  = signal<NotificationItem[]>([]);
  unreadCount    = signal(0);
  totalNotifs    = signal(0);
  notifLoading   = signal(false);
  profile        = signal<UserProfile | null>(null);
  profileLoading = signal(false);

  private routerSub: any;

  isAuthenticated = computed(() => {
    const accessToken = this.cookie.retrieveCookie('etHy0B87RlH9CXykEzclg');
    const userId      = this.cookie.retrieveCookie('fxSBE5PtmD35dx82BIpDg');
    if (this.variant !== 'public' && accessToken) return true;
    return !!(accessToken && userId);
  });

  private cookieName = computed(() => this.cookie.retrieveCookie('vLumDgQ0vJHJLCherb2w') || 'User');
  private cookieImg  = computed(() => this.cookie.retrieveCookie('n9u0oCnjyyntd06AU5wrg') || '');
  private cookieRole = computed(() => this.cookie.retrieveCookie('zJwZPFops4k8YpmBQJT') || '');

  avatarSrc = computed(() => {
    const p = this.profile();
    if (p?.profilePictureUrl) return p.profilePictureUrl;
    const img = this.cookieImg();
    if (img && img !== 'null' && img !== 'undefined') return img;
    return '';
  });

  displayName = computed(() => this.profile()?.fullName || this.cookieName() || 'User');

  displayRole = computed(() => {
    const p = this.profile();
    if (p?.headline) return p.headline;
    const role = this.cookieRole() ? decodeURIComponent(this.cookieRole()) : '';
    switch (role.toLowerCase()) {
      case 'admin':
      case 'superadmin': return this.isRtl() ? 'مدير' : 'Admin';
      case 'teacher':    return this.isRtl() ? 'معلم' : 'Teacher';
      case 'student':    return this.isRtl() ? 'طالب' : 'Student';
      default:
        if (this.variant === 'teacher') return this.isRtl() ? 'معلم' : 'Teacher';
        if (this.variant === 'student') return this.isRtl() ? 'طالب' : 'Student';
        if (this.variant === 'admin')   return this.isRtl() ? 'مدير' : 'Admin';
        return '';
    }
  });

  isVerified = computed(() => this.profile()?.isVerified ?? false);

  navLinks = computed<NavLink[]>(() => {
    const ar = this.isRtl();
    switch (this.variant) {
      case 'teacher':
        return [
          { label: ar ? 'لوحة التحكم' : 'Dashboard', href: '/teacher/dashboard', icon: this.LayoutDashboardIcon },
          { label: ar ? 'الدورات' : 'Courses', href: '/teacher/courses', icon: this.BookMarkedIcon },
          { label: ar ? 'الطلاب' : 'Students', href: '/teacher/students', icon: this.UsersIcon },
        ];
      case 'student':
        return [
          { label: ar ? 'الرئيسية' : 'Home', href: '/', icon: this.HomeIcon },
          { label: ar ? 'دوراتي' : 'My Courses', href: '/my-courses', icon: this.BookOpenIcon },
        ];
      case 'admin':
        return [
          { label: ar ? 'لوحة التحكم' : 'Dashboard', href: '/admin/dashboard', icon: this.LayoutDashboardIcon },
          { label: ar ? 'الدورات' : 'Courses', href: '/admin/courses', icon: this.BookMarkedIcon },
          { label: ar ? 'المستخدمين' : 'Users', href: '/admin/users', icon: this.UsersIcon },
        ];
      default:
        return [
          { label: ar ? 'الرئيسية' : 'Home', href: '/', icon: this.HomeIcon },
          { label: ar ? 'الدورات' : 'Courses', href: '/courses', icon: this.BookOpenIcon },
          { label: ar ? 'عن المنصة' : 'About', href: '/about', icon: this.InfoIcon },
          { label: ar ? 'تواصل' : 'Contact', href: '/contact', icon: this.PhoneIcon },
        ];
    }
  });

  menuItems = computed<MenuItem[]>(() => {
    const ar = this.isRtl();
    switch (this.variant) {
      case 'teacher':
        return [
          { icon: this.LayoutDashboardIcon, label: ar ? 'لوحة التحكم' : 'Dashboard', path: '/teacher/dashboard' },
          { icon: this.UserIcon, label: ar ? 'ملفي' : 'My Profile', path: '/teacher/profile' },
          { icon: this.BookMarkedIcon, label: ar ? 'دوراتي' : 'My Courses', path: '/teacher/courses' },
          { icon: this.UsersIcon, label: ar ? 'الطلاب' : 'Students', path: '/teacher/students' },
          { icon: this.StarIcon, label: ar ? 'التقييمات' : 'Reviews', path: '/teacher/reviews' },
          { icon: this.DollarSignIcon, label: ar ? 'الأرباح' : 'Earnings', path: '/teacher/earnings' },
        ];
      case 'student':
        return [
          { icon: this.UserIcon, label: ar ? 'ملفي' : 'My Profile', path: '/profile' },
          { icon: this.BookOpenIcon, label: ar ? 'دوراتي' : 'My Courses', path: '/my-courses' },
        ];
      case 'admin':
        return [
          { icon: this.LayoutDashboardIcon, label: ar ? 'لوحة التحكم' : 'Dashboard', path: '/admin/dashboard' },
          { icon: this.UserIcon, label: ar ? 'ملفي' : 'My Profile', path: '/admin/profile' },
          { icon: this.BookMarkedIcon, label: ar ? 'الدورات' : 'Courses', path: '/admin/courses' },
          { icon: this.UsersIcon, label: ar ? 'المستخدمين' : 'Users', path: '/admin/users' },
        ];
      default:
        return [];
    }
  });

  ngOnInit(): void {
    this.onScroll();
    this.fetchProfileAndSummary();

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
    ).subscribe(() => {
      this.mobileOpen.set(false);
      this.profileOpen.set(false);
      this.notifOpen.set(false);
    });

    this.language.onLanguageChange(() => {
      this.fetchProfileAndSummary();
      if (this.notifOpen()) this.fetchNotifs();
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  private profileEndpoint(): string {
    switch (this.variant) {
      case 'teacher': return `${this.config.baseUrl}/api/Teacher/profile`;
      case 'admin':   return `${this.config.baseUrl}/api/Admin/profile`;
      default:        return `${this.config.baseUrl}/api/Student/profile`;
    }
  }

  private fetchProfileAndSummary(): void {
    if (!this.isAuthenticated()) return;
    this.profileLoading.set(true);

    this.http.get<any>(this.profileEndpoint(), {
      headers: { 'x-language': this.language.currentLang() },
    }).subscribe({
      next: (res) => {
        if (res?.success) {
          const d = res.data;
          this.profile.set({
            fullName: d.fullName || d.name,
            headline: d.headline,
            isVerified: d.isVerified,
            profilePictureUrl: d.profilePictureUrl || d.avatar || d.profilePicture,
          });
        }
      },
      error: (err) => console.error('Error fetching profile:', err),
      complete: () => this.profileLoading.set(false),
    });

    this.http.get<any>(`${this.config.baseUrl}/api/notifications/summary`, {
      headers: { 'x-language': this.language.currentLang() },
    }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.unreadCount.set(res.data.unreadCount || 0);
          this.totalNotifs.set(res.data.totalCount || 0);
        }
      },
      error: (err) => console.error('Error fetching notification summary:', err),
    });
  }

  fetchNotifs(): void {
    this.notifLoading.set(true);
    this.http.get<any>(`${this.config.baseUrl}/api/notifications/unread?limit=5`, {
      headers: { 'x-language': this.language.currentLang() },
    }).subscribe({
      next: (res) => {
        if (res?.success) this.notifications.set(res.data || []);
      },
      error: (err) => console.error('Error fetching notifications:', err),
      complete: () => this.notifLoading.set(false),
    });
  }

  markRead(id: string): void {
    this.http.post(`${this.config.baseUrl}/api/notifications/${id}/mark-read`, {}).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => n.id === id ? { ...n, isRead: true } : n));
        this.unreadCount.update(c => Math.max(0, c - 1));
      },
      error: (err) => console.error('Error marking notification as read:', err),
    });
  }

  markAllRead(): void {
    this.http.post(`${this.config.baseUrl}/api/notifications/mark-all-read`, {}).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
        this.notifOpen.set(false);
      },
      error: (err) => console.error('Error marking all as read:', err),
    });
  }

  toggleLanguage(): void {
    this.language.toggleLanguage();
  }

  toggleNotif(): void {
    const next = !this.notifOpen();
    this.notifOpen.set(next);
    this.profileOpen.set(false);
    if (next) this.fetchNotifs();
  }

  closeNotif(): void {
    this.notifOpen.set(false);
  }

  toggleProfile(): void {
    this.profileOpen.update(v => !v);
    this.notifOpen.set(false);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  isActive(href: string): boolean {
    if (href === '/') return this.router.url === '/';
    return this.router.url.startsWith(href);
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.mobileOpen.set(false);
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  onNotificationClick(n: NotificationItem): void {
    if (!n.isRead) this.markRead(n.id);
    this.notifOpen.set(false);
    this.navigateTo(`/${this.variant}/notifications`);
  }

  viewAllNotifications(): void {
    this.notifOpen.set(false);
    this.navigateTo(`/${this.variant}/notifications`);
  }

  logout(): void {
    this.cookie.clearAllCookies?.();
    this.router.navigate(['/login']);
  }

  openMobileMenu(): void {
    this.mobileOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeMobileMenu(): void {
    this.mobileOpen.set(false);
    document.body.style.overflow = '';
  }

  getTimeAgo(date: string): string {
    const now = Date.now();
    const target = new Date(date).getTime();
    const diff = Math.floor((now - target) / 1000);
    const ar = this.isRtl();

    if (diff < 60) return ar ? 'الآن' : 'Just now';
    if (diff < 3600) {
      const m = Math.floor(diff / 60);
      return ar ? `منذ ${m} دقيقة` : `${m}m ago`;
    }
    if (diff < 86400) {
      const h = Math.floor(diff / 3600);
      return ar ? `منذ ${h} ساعة` : `${h}h ago`;
    }
    if (diff < 604800) {
      const d = Math.floor(diff / 86400);
      return ar ? `منذ ${d} يوم` : `${d}d ago`;
    }
    return new Date(date).toLocaleDateString(ar ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
  }
}