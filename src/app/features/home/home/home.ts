import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { Subject, forkJoin, catchError, of, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  BookOpen, Play, Users, Award, Star,
  ArrowRight, GraduationCap, Zap, Globe, Shield,
  Monitor, Clock, Trophy, Heart, MessageSquare,
  ChevronDown, Sparkles, Flame, BadgeCheck,
  BarChart3, ChevronLeft, ChevronRight, ExternalLink,
  TrendingUp, Layers, Check, X, CreditCard,
  Infinity as InfinityIcon, Bolt
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

// ─── DTOs — exactly matching controller response shapes ──────────────────────

/** GET /api/Courses  →  { success, data: { data: CourseDto[], totalCount } } */
export interface CourseDto {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  price: number;
  discountPrice?: number;
  isFree: boolean;
  language: string;
  level: string;
  rating: number;
  ratingCount: number;
  studentCount: number;
  totalHours: number;
  totalLectures: number;
  instructorName: string;
  categoryName: string;
  createdAt: string;
  discountPercentage: number;
  currentPrice: string;
  hasDiscount: boolean;
  imageUrl?: string;
  isNew: boolean;
  isPublished: boolean;
  isPlatformCourse: boolean;
}

/** GET /api/Subjects  →  { success, data: SubjectDto[], totalCount } */
export interface SubjectDto {
  id: string;
  name: string;
  nameInAr?: string;
  description?: string;
  descriptionInAr?: string;
  color?: string;
  questionCount: number;
  isActive: boolean;
  language?: string;
  academicStageName?: string;
  academicYearName?: string;
  academicSectionName?: string;
}

/** GET /api/Teacher/public  →  { success, data: { teachers: TeacherPublicDto[], totalCount } } */
export interface TeacherPublicDto {
  userId: string;
  name: string;
  specialization?: string;
  bio?: string;
  profileImageUrl?: string;
  rating: number;
  totalStudents: number;
  totalCourses: number;
  isVerified: boolean;
}

/** GET /api/AdvertisementDisplay/display  →  { success, data: AdDto[] } */
export interface AdDto {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  placement?: string;
  adType?: string;   // 'Banner' | 'Sidebar' | 'Reel'
  isActive: boolean;
}

/** GET /api/Xp/me  →  { success, data: XpSummaryDto } */
export interface XpSummaryDto {
  userId: string;
  displayName?: string;
  totalXp: number;
  weeklyXp: number;
  level: number;
  rank?: number;
  nextLevelXp?: number;
  currentLevelXp?: number;
  percentToNextLevel?: number;
  allTimeRank?: number;
}

/** GET /api/UserSubscription/current  →  UserSubscriptionDto */
export interface UserSubscriptionDto {
  id: number;
  planId: number;
  planName: string;
  planNameAr?: string;
  status: string;       // 'Active' | 'Expired' | 'Cancelled'
  startDate: string;
  endDate?: string;
  billingPeriod: string; // 'Monthly' | 'Yearly'
  autoRenew: boolean;
  remainingDays?: number;
}

/**
 * GET /api/SubscriptionPlans/student
 * Returns SubscriptionPlanDto[] (array, not wrapped)
 */
export interface PlanFeatureDto {
  id: number;
  description: string;
  descriptionInAr?: string;
  isPositive: boolean;
  isAvailable: boolean;
  icon?: string;
  displayOrder: number;
}

export interface SubscriptionPlanDto {
  id: number;
  name: string;
  nameInAr?: string;
  description?: string;
  descriptionInAr?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  forStudent: boolean;
  features: PlanFeatureDto[];
  yearlyDiscountPercentage?: number;
  trialDays?: number;
  maxCourses?: number;
  isUnlimited?: boolean;
  displayOrder?: number;
  badge?: string;          // e.g. "Most Popular"
  badgeInAr?: string;
  color?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'home' }],
})
export class Home implements OnInit, OnDestroy {

  // ── DI ───────────────────────────────────────────────────────────────────
  private readonly http       = inject(HttpClient);
  private readonly router     = inject(Router);
  readonly config             = inject(APP_CONFIG);
  readonly transloco          = inject(TranslocoService);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroy$   = new Subject<void>();

  // ── Icons ─────────────────────────────────────────────────────────────────
  readonly BookOpenIcon      = BookOpen;
  readonly PlayIcon          = Play;
  readonly UsersIcon         = Users;
  readonly AwardIcon         = Award;
  readonly StarIcon          = Star;
  readonly ArrowRightIcon    = ArrowRight;
  readonly GraduationCapIcon = GraduationCap;
  readonly ZapIcon           = Zap;
  readonly GlobeIcon         = Globe;
  readonly ShieldIcon        = Shield;
  readonly MonitorIcon       = Monitor;
  readonly ClockIcon         = Clock;
  readonly TrophyIcon        = Trophy;
  readonly HeartIcon         = Heart;
  readonly MessageSquareIcon = MessageSquare;
  readonly ChevronDownIcon   = ChevronDown;
  readonly SparklesIcon      = Sparkles;
  readonly FlameIcon         = Flame;
  readonly BadgeCheckIcon    = BadgeCheck;
  readonly BarChart3Icon     = BarChart3;
  readonly ChevronLeftIcon   = ChevronLeft;
  readonly ChevronRightIcon  = ChevronRight;
  readonly ExternalLinkIcon  = ExternalLink;
  readonly TrendingUpIcon    = TrendingUp;
  readonly LayersIcon        = Layers;
  readonly CheckIcon         = Check;
  readonly XIcon             = X;
  readonly CreditCardIcon    = CreditCard;
  readonly InfinityIcon      = InfinityIcon;
  readonly BoltIcon          = Bolt;

  // ── Loading states ────────────────────────────────────────────────────────
  loadingPublic   = signal(true);   // ads + courses + subjects + teachers + plans
  heroAnimated    = signal(false);

  // ── API data signals ──────────────────────────────────────────────────────
  bannerAds       = signal<AdDto[]>([]);
  courses         = signal<CourseDto[]>([]);
  subjects        = signal<SubjectDto[]>([]);
  teachers        = signal<TeacherPublicDto[]>([]);
  plans           = signal<SubscriptionPlanDto[]>([]);   // student plans
  xpSummary       = signal<XpSummaryDto | null>(null);
  activeSub       = signal<UserSubscriptionDto | null>(null);
  isLoggedIn      = signal(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  currentAdIndex  = signal(0);
  activeCategory  = signal('all');
  billingYearly   = signal(false);   // toggle monthly / yearly pricing
  processingPlan  = signal<number | null>(null);  // planId being subscribed

  // ── Derived ──────────────────────────────────────────────────────────────
  get isRTL(): boolean { return this.transloco.getActiveLang() === 'ar'; }

  get filteredCourses(): CourseDto[] {
    const cat = this.activeCategory();
    if (cat === 'all') return this.courses();
    return this.courses().filter(c =>
      c.categoryName?.toLowerCase().includes(cat.toLowerCase())
    );
  }

  get xpPercent(): number {
    const xp = this.xpSummary();
    if (!xp) return 0;
    if (xp.percentToNextLevel != null) return Math.round(xp.percentToNextLevel);
    const range = (xp.nextLevelXp ?? 1000) - (xp.currentLevelXp ?? 0);
    if (range <= 0) return 100;
    return Math.min(100, Math.round(((xp.totalXp - (xp.currentLevelXp ?? 0)) / range) * 100));
  }

  /** Sorted plans: default (free) first, then by displayOrder / monthlyPrice */
  get sortedPlans(): SubscriptionPlanDto[] {
    return [...this.plans()].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      const da = a.displayOrder ?? 99, db = b.displayOrder ?? 99;
      if (da !== db) return da - db;
      return a.monthlyPrice - b.monthlyPrice;
    });
  }

  planPrice(p: SubscriptionPlanDto): string {
    if (p.monthlyPrice === 0) return this.t('pricing.free');
    const price = this.billingYearly() ? p.yearlyPrice / 12 : p.monthlyPrice;
    return `${price.toFixed(0)} ${p.currency ?? 'EGP'}`;
  }

  planPeriodLabel(): string {
    return this.t(
      this.billingYearly() ? 'pricing.perMonthBilled' : 'pricing.perMonth'
    );
  }

  yearSaving(p: SubscriptionPlanDto): number {
    if (!p.yearlyDiscountPercentage) {
      const monthly12 = p.monthlyPrice * 12;
      if (monthly12 === 0) return 0;
      return Math.round(((monthly12 - p.yearlyPrice) / monthly12) * 100);
    }
    return Math.round(p.yearlyDiscountPercentage);
  }

  isCurrentPlan(p: SubscriptionPlanDto): boolean {
    return this.activeSub()?.planId === p.id;
  }

  visibleFeatures(p: SubscriptionPlanDto): PlanFeatureDto[] {
    return [...p.features]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 8);
  }

  readonly skeletonArray    = Array.from({ length: 6 });
  readonly skeletonSubjects = Array.from({ length: 8 });
  readonly skeletonPlans    = Array.from({ length: 3 });

  get uniqueCategories(): string[] {
    const seen = new Set<string>();
    return this.courses()
      .map(c => c.categoryName)
      .filter(cat => cat && !seen.has(cat) && seen.add(cat) as unknown as boolean)
      .slice(0, 5);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadPublicData();
    this.loadUserData();
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => { this.heroAnimated.set(true); this.cdr.markForCheck(); }, 80);
      this.startAdCarousel();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.adInterval) clearInterval(this.adInterval);
  }

  // ── Public data ───────────────────────────────────────────────────────────
  private loadPublicData(): void {
    const base = this.config.baseUrl;
    const lang = this.transloco.getActiveLang();

    forkJoin({
      ads: this.http.get<any>(
        `${base}/api/AdvertisementDisplay/display?placement=homepage&count=6`
      ).pipe(catchError(() => of({ success: false, data: [] }))),

      courses: this.http.get<any>(
        `${base}/api/Courses?SortBy=rating&Page=1&PageSize=6`
      ).pipe(catchError(() => of({ success: false, data: { data: [] } }))),

      subjects: this.http.get<any>(
        `${base}/api/Subjects?page=1&pageSize=8&activeOnly=true`
      ).pipe(catchError(() => of({ success: false, data: [] }))),

      teachers: this.http.get<any>(
        `${base}/api/Teacher/public?Page=1&PageSize=6`
      ).pipe(catchError(() => of({ success: false, data: { teachers: [] } }))),

      // GET /api/SubscriptionPlans/student  — returns array directly, pass X-Language header
      plans: this.http.get<SubscriptionPlanDto[]>(
        `${base}/api/SubscriptionPlans/student`,
        { headers: new HttpHeaders({ 'X-Language': lang }) }
      ).pipe(catchError(() => of([]))),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(({ ads, courses, subjects, teachers, plans }) => {
      const allAds: AdDto[] = ads?.data ?? [];
      this.bannerAds.set(
        allAds.filter(a => (a.adType ?? '').toLowerCase() !== 'sidebar').slice(0, 4)
      );
      this.courses.set(courses?.data?.data ?? []);
      this.subjects.set(subjects?.data ?? []);

      const tp = teachers?.data;
      this.teachers.set(Array.isArray(tp) ? tp : (tp?.teachers ?? []));

      // Plans endpoint returns array directly (not wrapped in ApiResponse)
      this.plans.set(Array.isArray(plans) ? plans : []);

      this.loadingPublic.set(false);
      this.cdr.markForCheck();
    });
  }

  // ── User data: XP + current subscription (silent on 401) ─────────────────
  private loadUserData(): void {
    const base = this.config.baseUrl;

    this.http.get<any>(`${base}/api/Xp/me`)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(res => {
        if (res?.success && res.data) {
          this.xpSummary.set(res.data);
          this.isLoggedIn.set(true);
          this.cdr.markForCheck();
        }
      });

    // GET /api/UserSubscription/current — returns UserSubscriptionDto directly
    this.http.get<UserSubscriptionDto>(`${base}/api/UserSubscription/current`)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(res => {
        if (res) {
          this.activeSub.set(res);
          this.isLoggedIn.set(true);
          this.cdr.markForCheck();
        }
      });
  }

  // ── Subscription actions ─────────────────────────────────────────────────
  /**
   * Sends to POST /api/Payment/initiate to start the payment flow.
   * Redirects to the Fawaterk payment_url received in the response.
   */
  subscribeToPlan(plan: SubscriptionPlanDto): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/register'], {
        queryParams: { returnUrl: '/', plan: plan.id },
      });
      return;
    }
    if (this.isCurrentPlan(plan)) return;
    if (plan.monthlyPrice === 0) {
      // Free plan — navigate to confirmation or simply show success
      this.router.navigate(['/subscription/activate'], { queryParams: { plan: plan.id } });
      return;
    }

    this.processingPlan.set(plan.id);
    this.cdr.markForCheck();

    const userId = this.xpSummary()?.userId ?? '';
    const body = {
      userId,
      planId: plan.id,
      billingPeriod: this.billingYearly() ? 'Yearly' : 'Monthly',
      paymentMethod: 'CreditCard',
    };

    this.http.post<any>(`${this.config.baseUrl}/api/Payment/initiate`, body)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(res => {
        this.processingPlan.set(null);
        this.cdr.markForCheck();
        if (res?.success && res.payment_url) {
          window.location.href = res.payment_url;
        } else {
          this.router.navigate(['/subscription'], { queryParams: { plan: plan.id } });
        }
      });
  }

  // ── Ad carousel ───────────────────────────────────────────────────────────
  private adInterval: any;

  private startAdCarousel(): void {
    this.adInterval = setInterval(() => {
      const len = this.bannerAds().length;
      if (len > 1) {
        this.currentAdIndex.update(i => (i + 1) % len);
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  nextAd(): void { const l = this.bannerAds().length; if (l) this.currentAdIndex.update(i => (i + 1) % l); }
  prevAd(): void { const l = this.bannerAds().length; if (l) this.currentAdIndex.update(i => (i - 1 + l) % l); }
  goToAd(i: number): void { this.currentAdIndex.set(i); }

  trackAdClick(ad: AdDto): void {
    this.http.post(`${this.config.baseUrl}/api/AdvertisementDisplay/${ad.id}/click`, {})
      .pipe(catchError(() => of(null))).subscribe();
    if (ad.linkUrl) window.open(ad.linkUrl, '_blank', 'noopener');
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  go(path: string): void { this.router.navigate([path]); }
  goToCourse(id: string): void { this.router.navigate(['/courses', id]); }
  goToTeacher(id: string): void { this.router.navigate(['/teachers', id]); }
  goToSubject(id: string): void {
    this.router.navigate(['/courses'], { queryParams: { subject: id } });
  }
  setCategory(key: string): void { this.activeCategory.set(key); }
  toggleBilling(): void { this.billingYearly.update(v => !v); }

  // ── Image helpers ─────────────────────────────────────────────────────────
  private readonly FALLBACK_IDS = [
    '1498050108023-c5249f4df085',
    '1551288049-bebda4e38f71',
    '1561070791-2526d30994b5',
    '1512941937669-90a1b58e7e9c',
    '1460925895917-afdab827c52f',
  ];

  courseImg(c: CourseDto): string {
    if (c.imageUrl) return `${this.config.baseUrl}${c.imageUrl}`;
    const idx = Math.abs((c.id?.charCodeAt(0) ?? 0)) % this.FALLBACK_IDS.length;
    return `https://images.unsplash.com/photo-${this.FALLBACK_IDS[idx]}?w=600&h=380&fit=crop&auto=format`;
  }
  adImg(ad: AdDto): string {
    if (ad.imageUrl) return `${this.config.baseUrl}${ad.imageUrl}`;
    return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=420&fit=crop&auto=format';
  }
  teacherImg(t: TeacherPublicDto): string {
    if (t.profileImageUrl) return `${this.config.baseUrl}${t.profileImageUrl}`;
    return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face';
  }
  subjectColor(s: SubjectDto): string { return s.color || '#4f46e5'; }
  subjectBg(s: SubjectDto): string { return `${s.color || '#4f46e5'}18`; }

  planAccent(p: SubscriptionPlanDto): string { return p.color || '#4f46e5'; }
  planAccentBg(p: SubscriptionPlanDto): string { return `${p.color || '#4f46e5'}12`; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  stars(n: number): number[] { return Array.from({ length: Math.min(Math.round(n), 5) }); }
  trackById(_: number, item: any): string { return item?.id ?? item?.userId ?? String(_); }
  get currentYear(): number { return new Date().getFullYear(); }

  // ── i18n helper (same pattern as courses page) ────────────────────────────
  private t(key: string): string {
    return this.transloco.translate(`home.${key}`);
  }
}