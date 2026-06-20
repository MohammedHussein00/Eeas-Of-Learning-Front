import {
  Component, inject, signal, computed, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, filter, takeUntil } from 'rxjs';
import gsap from 'gsap';
import {
  LucideAngularModule,
  ArrowLeft, BookOpen, Clock, Users, Star, Shield, CheckCircle, Lock,
  CreditCard, Zap, Globe, Award, Monitor, Smartphone, AlertCircle,
  ChevronRight, BadgeCheck, Building2, GraduationCap, RefreshCw, ExternalLink
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ───────────────────────────────────────────────────────────

interface CoursePreviewData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  price: number;
  discountPrice: number | null;
  isFree: boolean;
  isPublished: boolean;
  language: string;
  level: string;
  rating: number;
  ratingCount: number;
  studentCount: number;
  totalLectures: number;
  totalHours: number;
  instructorId: string;
  instructorName: string;
  instructorBio: string;
  instructorAvatar: string;
  isEnrolled: boolean;
  hasDiscount: boolean;
  currentPrice: string;
  discountPercentage: number;
  isPlatformCourse?: boolean;
}

interface EnrollmentDto {
  id: string;
  userId: string;
  courseId: string;
  status: number;
  paymentUrl?: string;
  redirectUrl?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: string[];
}

type EnrollStep = 'review' | 'enrolling' | 'redirecting' | 'success' | 'error';

interface Perk {
  icon: any;
  en: string;
  ar: string;
}

interface Guarantee {
  en: string;
  ar: string;
}

// ── Constants ────────────────────────────────────────────────────────

const PLATFORM_INSTRUCTOR_NAMES = ['System Administrator', 'EOL', 'EOL Platform', 'EOL Admin'];

const GUARANTEES: Guarantee[] = [
  { en: '30-day money-back guarantee', ar: 'ضمان استرداد المال خلال 30 يوم' },
  { en: 'Lifetime access to course content', ar: 'وصول مدى الحياة للمحتوى' },
  { en: 'Certificate of completion', ar: 'شهادة إتمام الدورة' },
  { en: 'Access on all devices', ar: 'الوصول من جميع الأجهزة' },
];

@Component({
  selector: 'app-course-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './course-checkout.html',
  styleUrls: ['./course-checkout.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'checkout' },
  ],
})
export class CourseCheckout implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private config = inject(APP_CONFIG);
  private transloco = inject(TranslocoService);

  @ViewChild('pageRef') pageRef?: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private fetchedRef = false;
  private redirectTimer?: ReturnType<typeof setTimeout>;
  private successTimer?: ReturnType<typeof setTimeout>;

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon = ArrowLeft;
  readonly BookOpenIcon = BookOpen;
  readonly ClockIcon = Clock;
  readonly UsersIcon = Users;
  readonly StarIcon = Star;
  readonly ShieldIcon = Shield;
  readonly CheckCircleIcon = CheckCircle;
  readonly LockIcon = Lock;
  readonly CreditCardIcon = CreditCard;
  readonly ZapIcon = Zap;
  readonly GlobeIcon = Globe;
  readonly AwardIcon = Award;
  readonly MonitorIcon = Monitor;
  readonly SmartphoneIcon = Smartphone;
  readonly AlertCircleIcon = AlertCircle;
  readonly ChevronRightIcon = ChevronRight;
  readonly BadgeCheckIcon = BadgeCheck;
  readonly Building2Icon = Building2;
  readonly GraduationCapIcon = GraduationCap;
  readonly RefreshCwIcon = RefreshCw;
  readonly ExternalLinkIcon = ExternalLink;

  readonly guarantees = GUARANTEES;

  // ── State signals ──────────────────────────────────────────────────
  loading = signal(true);
  course = signal<CoursePreviewData | null>(null);
  step = signal<EnrollStep>('review');
  errorMsg = signal('');
  countdown = signal(5);

  private entranceCtx?: gsap.Context;
  private statusCtx?: gsap.Context;

  // ── Language / RTL ─────────────────────────────────────────────────
  get isRTL(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  // ── Translation helper ────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`checkout.${key}`);
  }

  // ── Computed ───────────────────────────────────────────────────────
  readonly platform = computed(() => {
    const c = this.course();
    return c ? this.checkIsPlatformCourse(c) : false;
  });

  readonly instructorDisplay = computed(() => {
    const c = this.course();
    if (!c) return '';
    return this.platform() ? 'EOL' : (c.instructorName || 'Unknown');
  });

  readonly displayPrice = computed(() => {
    const c = this.course();
    if (!c) return '0';
    return c.hasDiscount
      ? c.currentPrice || c.price.toFixed(2)
      : c.price.toFixed(2);
  });

  readonly perks = computed((): Perk[] => {
    const c = this.course();
    const hours = c?.totalHours ?? 0;
    const lectures = c?.totalLectures ?? 0;
    const lang = c?.language === 'ar' ? 'Arabic' : 'English';
    const langAr = c?.language === 'ar' ? 'العربية' : 'الإنجليزية';
    return [
      { icon: this.ClockIcon, en: `${hours}h on-demand video`, ar: `${hours} ساعة فيديو` },
      { icon: this.BookOpenIcon, en: `${lectures} lectures`, ar: `${lectures} محاضرة` },
      { icon: this.MonitorIcon, en: 'Full lifetime access', ar: 'وصول كامل مدى الحياة' },
      { icon: this.SmartphoneIcon, en: 'Access on mobile & TV', ar: 'وصول عبر الجوال والتلفاز' },
      { icon: this.AwardIcon, en: 'Certificate of completion', ar: 'شهادة إتمام' },
      { icon: this.GlobeIcon, en: lang, ar: langAr },
    ];
  });

  readonly imageUrl = computed(() => {
    const c = this.course();
    return c?.imageUrl
      ? `${this.config.baseUrl}${c.imageUrl}`
      : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=500&fit=crop&auto=format';
  });

  // ── Helpers ────────────────────────────────────────────────────────

  private checkIsPlatformCourse(d: CoursePreviewData): boolean {
    if (d.isPlatformCourse) return true;
    if (d.instructorName && PLATFORM_INSTRUCTOR_NAMES.some(n =>
      d.instructorName.toLowerCase().includes(n.toLowerCase())
    )) return true;
    return false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  ngOnInit(): void {
    this.fetchedRef = false;
    this.fetchCourse();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchedRef = false;
        this.step.set('review');
        this.errorMsg.set('');
        this.fetchCourse();
      }
    });

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.fetchedRef = false;
        this.fetchCourse();
      }
    });
  }

  ngAfterViewInit(): void {
    // Animations triggered after data loads
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.redirectTimer);
    clearTimeout(this.successTimer);
    this.entranceCtx?.revert();
    this.statusCtx?.revert();
  }

  // ── Data loading ───────────────────────────────────────────────────

  private async fetchCourse(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || this.fetchedRef) return;
    this.fetchedRef = true;
    this.loading.set(true);

    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CoursePreviewData>>(
          `${this.config.baseUrl}/api/Courses/${id}/preview`
        ),
        { defaultValue: null }
      );

      if (res?.success) {
        const c = res.data;
        this.course.set(c);

        if (c.isEnrolled) {
          this.router.navigate(['/courses', id, 'learn'], { replaceUrl: true });
          return;
        }

        this.loading.set(false);
        setTimeout(() => this.animateEntrance());
      } else {
        this.errorMsg.set(res?.message || this.t('courseNotFound'));
        this.step.set('error');
        this.loading.set(false);
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        this.errorMsg.set(this.t('courseNotFound'));
      } else {
        this.errorMsg.set(err?.error?.message || this.t('courseNotFound'));
      }
      this.step.set('error');
      this.loading.set(false);
    }
  }

  // ── Animations ─────────────────────────────────────────────────────

  private animateEntrance(): void {
    if (!this.pageRef) return;
    this.entranceCtx?.revert();
    this.entranceCtx = gsap.context(() => {
      gsap.from('.co-main > *', {
        y: 24,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power3.out',
        delay: 0.15,
      });
      gsap.from('.co-sidebar', {
        x: 30,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
        delay: 0.3,
      });
    }, this.pageRef.nativeElement);
  }

  private animateStatusCard(): void {
    if (!this.pageRef) return;
    this.statusCtx?.revert();
    this.statusCtx = gsap.context(() => {
      gsap.from('.co-status-card', {
        scale: 0.92,
        opacity: 0,
        duration: 0.4,
        ease: 'back.out(1.4)',
      });
    }, this.pageRef.nativeElement);
  }

  // ── Enroll handler ─────────────────────────────────────────────────

  async handleEnroll(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const c = this.course();
    if (!id || !c) return;

    this.step.set('enrolling');
    setTimeout(() => this.animateStatusCard());

    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<EnrollmentDto>>(
          `${this.config.baseUrl}/api/enrollments/${id}?isWeb=true`,
          null
        ),
        { defaultValue: null }
      );

      if (!res?.success) {
        this.errorMsg.set(res?.message || this.t('enrollmentFailed'));
        this.step.set('error');
        setTimeout(() => this.animateStatusCard());
        return;
      }

      const enrollment = res.data;

      if (c.isFree) {
        this.step.set('success');
        setTimeout(() => this.animateStatusCard());
        this.successTimer = setTimeout(() => {
          this.router.navigate(['/courses', id, 'learn']);
        }, 2000);
      } else if (enrollment.paymentUrl) {
        this.step.set('redirecting');
        this.countdown.set(5);
        setTimeout(() => this.animateStatusCard());

        this.redirectTimer = setTimeout(() => {
          window.location.href = enrollment.paymentUrl!;
        }, 5000);

        this.startCountdown();
      } else if (enrollment.redirectUrl) {
        this.step.set('success');
        setTimeout(() => this.animateStatusCard());
        this.successTimer = setTimeout(() => {
          this.router.navigateByUrl(enrollment.redirectUrl!);
        }, 1500);
      } else {
        this.errorMsg.set(this.t('enrollmentFailed'));
        this.step.set('error');
        setTimeout(() => this.animateStatusCard());
      }
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        err?.error?.errors?.[0] ||
        this.t('enrollmentFailed');
      this.errorMsg.set(msg);
      this.step.set('error');
      setTimeout(() => this.animateStatusCard());
    }
  }

  // ── Countdown ──────────────────────────────────────────────────────

  private startCountdown(): void {
    if (this.step() !== 'redirecting' || this.countdown() <= 0) return;
    const timer = setTimeout(() => {
      this.countdown.update(c => c - 1);
      this.startCountdown();
    }, 1000);
    setTimeout(() => clearTimeout(timer), 6000);
  }

  // ── Action handlers ───────────────────────────────────────────────

  retryEnrollment(): void {
    this.step.set('review');
    this.errorMsg.set('');
  }

  goToPaymentNow(): void {
    this.handleEnroll();
  }

  goBackToCourse(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.router.navigate(['/courses', id]);
  }

  goToCourses(): void {
    this.router.navigate(['/courses']);
  }

  goLearn(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.router.navigate(['/courses', id, 'learn']);
  }

  // ── Host listeners ─────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.step() === 'error') {
      this.step.set('review');
      this.errorMsg.set('');
    }
  }
}