// features/admin/admin-layout/admin-layout.ts
import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { AdminHeader } from '../admin-header/admin-header';
import { Language } from '../../../core/services/language';
import {
  trigger,
  state,
  style,
  animate,
  transition
} from '@angular/animations';
import { LucideAngularModule,
  Gauge,
  BookOpen,
  List,
  Plus,
  Users,
  DollarSign,
  Megaphone,
  Bell,
  Menu as MenuIcon,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  HelpCircle,
  UserCheck,
  School,
  Trophy,
  Zap,
  Users2,
  Receipt,
  ChevronDown,
  Gift
} from 'lucide-angular';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    AdminHeader,
    TranslocoModule,
    LucideAngularModule
  ],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.scss'],
  animations: [
    trigger('submenuAnimation', [
      state('closed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('open', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden'
      })),
      transition('closed => open', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition('open => closed', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ])
  ]
})
export class AdminLayout implements OnInit, OnDestroy {
  private language = inject(Language);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private transloco = inject(TranslocoService);

  // Lucide Icons
  readonly GaugeIcon = Gauge;
  readonly BookOpenIcon = BookOpen;
  readonly ListIcon = List;
  readonly PlusIcon = Plus;
  readonly UsersIcon = Users;
  readonly DollarSignIcon = DollarSign;
  readonly MegaphoneIcon = Megaphone;
  readonly BellIcon = Bell;
  readonly MenuIcon = MenuIcon;
  readonly CreditCardIcon = CreditCard;
  readonly PanelLeftCloseIcon = PanelLeftClose;
  readonly PanelLeftOpenIcon = PanelLeftOpen;
  readonly GraduationCapIcon = GraduationCap;
  readonly HelpCircleIcon = HelpCircle;
  readonly UserCheckIcon = UserCheck;
  readonly SchoolIcon = School;
  readonly TrophyIcon = Trophy;
  readonly ZapIcon = Zap;
  readonly Users2Icon = Users2;
  readonly ReceiptIcon = Receipt;
  readonly ChevronDownIcon = ChevronDown;
  readonly GiftIcon = Gift;

  // Signals
  isMobile = signal(false);
  isCollapsed = signal(false);
  drawerOpen = signal(false);

  // Desktop submenu open states
  academicsOpen = signal(false);
  referralsOpen = signal(false);
  questionsOpen = signal(false);
  subjectsOpen = signal(false);
  coursesOpen = signal(false);
  plansOpen = signal(false);
  xpOpen = signal(false);

  // Mobile submenu
  mobileCoursesOpen = signal(false);

  isRtl = this.language.isRtl;

  sidebarWidth = computed(() => this.isCollapsed() ? 72 : 256);

  private routerSubscription: any;
  private resizeListener: any;

  constructor() {
    // Add effect to re-render when language changes
    effect(() => {
      // This will trigger whenever language changes
      const currentLang = this.language.currentLang();
      console.log('Language changed to:', currentLang);

      // Force reload translations if needed
      if (isPlatformBrowser(this.platformId)) {
        // Re-apply any language-specific logic
        this.transloco.setActiveLang(currentLang);
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile.set(window.innerWidth < 768);

      this.resizeListener = () => {
        this.isMobile.set(window.innerWidth < 768);
      };
      window.addEventListener('resize', this.resizeListener);
    }

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.isMobile()) {
        this.drawerOpen.set(false);
      }
      this.syncOpenSubmenus();
    });

    this.syncOpenSubmenus();
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (isPlatformBrowser(this.platformId) && this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private syncOpenSubmenus(): void {
    const url = this.router.url;
    this.academicsOpen.set(url.includes('/dash/academics') || url.includes('/dash/add-stage') || url.includes('/dash/add-year') || url.includes('/dash/add-section'));
    this.referralsOpen.set(url.includes('/dash/referrals'));
    this.questionsOpen.set(url.includes('/dash/questions') || url.includes('/dash/add-question'));
    this.subjectsOpen.set(url.includes('/dash/subjects') || url.includes('/dash/add-subject'));
    this.coursesOpen.set(url.includes('/dash/courses') || url.includes('/dash/add-course'));
    this.plansOpen.set(url.includes('/dash/plans') || url.includes('/dash/add-plan'));
    this.xpOpen.set(url.includes('/dash/xp-rank') || url.includes('/dash/rank-management'));
  }

  /**
   * Check if a given path is active.
   * Strips query params and fragments before comparing so that
   * /dash/referrals?tab=pending matches /dash/referrals.
   */
  isActive(path: string): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === path || url.startsWith(path + '/');
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    if (this.isMobile()) {
      this.drawerOpen.set(false);
    }
  }

  toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
  }

  toggleDrawer(): void {
    this.drawerOpen.update(v => !v);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleAcademics(): void {
    if (!this.isCollapsed()) this.academicsOpen.update(v => !v);
  }

  toggleReferrals(): void {
    if (!this.isCollapsed()) this.referralsOpen.update(v => !v);
  }

  toggleQuestions(): void {
    if (!this.isCollapsed()) this.questionsOpen.update(v => !v);
  }

  toggleSubjects(): void {
    if (!this.isCollapsed()) this.subjectsOpen.update(v => !v);
  }

  toggleCourses(): void {
    if (!this.isCollapsed()) this.coursesOpen.update(v => !v);
  }

  togglePlans(): void {
    if (!this.isCollapsed()) this.plansOpen.update(v => !v);
  }

  toggleXp(): void {
    if (!this.isCollapsed()) this.xpOpen.update(v => !v);
  }

  toggleMobileCourses(): void {
    this.mobileCoursesOpen.update(v => !v);
  }
}