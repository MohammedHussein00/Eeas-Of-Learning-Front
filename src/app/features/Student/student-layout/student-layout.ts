// features/Student/student-layout/student-layout.ts
import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { StudentHeader } from '../student-header/student-header';
import { Language } from '../../../core/services/language';
import {
  LucideAngularModule,
  Gauge,
  BookOpen,
  GraduationCap,
  Star,
  Trophy,
  Bell,
  Mail,
  MessageSquare,
  CreditCard,
  Gift,
  User,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-angular';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  icon: any;
  path: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

@Component({
  selector: 'app-student-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    StudentHeader,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './student-layout.html',
  styleUrls: ['./student-layout.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentLayout' }],
})
export class StudentLayout implements OnInit, OnDestroy {
  private language   = inject(Language);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private transloco  = inject(TranslocoService);

  // Icons (also used in header button)
  readonly MenuIcon           = MenuIcon;
  readonly PanelLeftCloseIcon = PanelLeftClose;
  readonly PanelLeftOpenIcon  = PanelLeftOpen;

  // Navigation model — drives both desktop sidebar and mobile drawer
  readonly nav: NavSection[] = [
    {
      section: 'sectionLearn',
      items: [
        { label: 'dashboard',   icon: Gauge,         path: '/student/dashboard' },
        { label: 'myCourses',   icon: BookOpen,      path: '/student/courses' },
      ],
    },
    {
      section: 'sectionProgress',
      items: [
        { label: 'leaderboard', icon: Trophy,        path: '/student/leaderboard' },
        { label: 'myReviews',   icon: Star,          path: '/student/reviews' },
      ],
    },
    {
      section: 'sectionMessages',
      items: [
        { label: 'notifications', icon: Bell,          path: '/student/notifications' },
        { label: 'messages',      icon: Mail,          path: '/student/chat' },
      ],
    },
    {
      section: 'sectionAccount',
      items: [
        { label: 'subscription', icon: CreditCard,    path: '/student/subscription' },
        { label: 'referral',     icon: Gift,          path: '/student/referral' },
        { label: 'myProfile',    icon: User,          path: '/student/profile' },
      ],
    },
  ];

  // Layout state
  isMobile    = signal(false);
  isCollapsed = signal(false);
  drawerOpen  = signal(false);

  isRtl = this.language.isRtl;
  sidebarWidth = computed(() => this.isCollapsed() ? 72 : 256);

  private routerSubscription: any;
  private resizeListener: any;

  constructor() {
    effect(() => {
      const currentLang = this.language.currentLang();
      if (isPlatformBrowser(this.platformId)) {
        this.transloco.setActiveLang(currentLang);
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile.set(window.innerWidth < 768);
      this.resizeListener = () => this.isMobile.set(window.innerWidth < 768);
      window.addEventListener('resize', this.resizeListener);
    }

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      if (this.isMobile()) this.drawerOpen.set(false);
    });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) this.routerSubscription.unsubscribe();
    if (isPlatformBrowser(this.platformId) && this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    if (this.isMobile()) this.drawerOpen.set(false);
  }

  toggleCollapse(): void { this.isCollapsed.update(v => !v); }
  toggleDrawer(): void { this.drawerOpen.update(v => !v); }
  closeDrawer(): void { this.drawerOpen.set(false); }
}
