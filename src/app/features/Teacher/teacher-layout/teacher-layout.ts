// features/teacher/teacher-layout/teacher-layout.ts
import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { TeacherHeader } from '../teacher-header/teacher-header';
import { Language } from '../../../core/services/language';
import {
  trigger,
  state,
  style,
  animate,
  transition,
} from '@angular/animations';
import {
  LucideAngularModule,
  Gauge,
  BookOpen,
  List,
  Plus,
  Users,
  DollarSign,
  Megaphone,
  Bell,
  Mail,
  Menu as MenuIcon,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  BarChart3,
  Users2,
  ChevronDown,
} from 'lucide-angular';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-teacher-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    TeacherHeader,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './teacher-layout.html',
  styleUrls: ['./teacher-layout.scss'],
  animations: [
    trigger('submenuAnimation', [
      state('closed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0',
      })),
      state('open', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden',
      })),
      transition('closed => open', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)'),
      ]),
      transition('open => closed', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)'),
      ]),
    ]),
  ],
})
export class TeacherLayout implements OnInit, OnDestroy {
  private language   = inject(Language);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private transloco  = inject(TranslocoService);

  // Lucide Icons
  readonly GaugeIcon         = Gauge;
  readonly BookOpenIcon      = BookOpen;
  readonly ListIcon          = List;
  readonly PlusIcon          = Plus;
  readonly UsersIcon         = Users;
  readonly DollarSignIcon    = DollarSign;
  readonly MegaphoneIcon     = Megaphone;
  readonly BellIcon          = Bell;
  readonly MailIcon          = Mail;
  readonly MenuIcon          = MenuIcon;
  readonly CreditCardIcon    = CreditCard;
  readonly PanelLeftCloseIcon = PanelLeftClose;
  readonly PanelLeftOpenIcon  = PanelLeftOpen;
  readonly UserIcon          = User;
  readonly BarChart3Icon     = BarChart3;
  readonly Users2Icon        = Users2;
  readonly ChevronDownIcon   = ChevronDown;

  // Signals
  isMobile    = signal(false);
  isCollapsed = signal(false);
  drawerOpen  = signal(false);

  // Submenu states
  coursesOpen      = signal(false);
  mobileCoursesOpen = signal(false);

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
      this.resizeListener = () => {
        this.isMobile.set(window.innerWidth < 768);
      };
      window.addEventListener('resize', this.resizeListener);
    }

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
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
    this.coursesOpen.set(
      url.includes('/teacher/courses') || url.includes('/teacher/add-course'),
    );
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
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

  toggleCourses(): void {
    if (!this.isCollapsed()) this.coursesOpen.update(v => !v);
  }

  toggleMobileCourses(): void {
    this.mobileCoursesOpen.update(v => !v);
  }
}