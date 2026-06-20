import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed, ChangeDetectorRef
} from '@angular/core';
import { CommonModule }     from '@angular/common';
import { FormsModule }      from '@angular/forms';
import { Router }           from '@angular/router';
import { HttpClient }       from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, ArrowRight, RefreshCw, Filter, Search, X,
  Star, MessageSquare, BookOpen, CheckCircle,
  Clock, Eye, BarChart2, Trophy, Users,
  ChevronUp, ChevronDown, TrendingUp
} from 'lucide-angular';

import { NzSpinModule }       from 'ng-zorro-antd/spin';
import { NzTableModule }      from 'ng-zorro-antd/table';
import { NzTagModule }        from 'ng-zorro-antd/tag';
import { NzTooltipModule }    from 'ng-zorro-antd/tooltip';
import { NzModalModule }      from 'ng-zorro-antd/modal';
import { NzSelectModule }     from 'ng-zorro-antd/select';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzInputModule }      from 'ng-zorro-antd/input';
import { NzProgressModule }   from 'ng-zorro-antd/progress';
import { NzRateModule }       from 'ng-zorro-antd/rate';
import { NzAvatarModule }     from 'ng-zorro-antd/avatar';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService }   from 'ng-zorro-antd/message';

import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ────────────────────────────────────────────────────────────
interface OverallStats {
  totalReviews: number;
  averageRating: number;
  totalCourses: number;
  fiveStarCount: number;  fiveStarPercentage: number;
  fourStarCount: number;  fourStarPercentage: number;
  threeStarCount: number; threeStarPercentage: number;
  twoStarCount: number;   twoStarPercentage: number;
  oneStarCount: number;   oneStarPercentage: number;
  recentAverageRating: number;
  recentReviewsCount: number;
  topCourseTitle?: string;
  topCourseRating?: number;
}

interface Review {
  id: string | number;
  userName: string;
  userAvatar?: string;
  courseTitle: string;
  courseId: string | number;
  rating: number;
  comment?: string;
  createdAt: string;
  isVerifiedPurchase?: boolean;
}

interface Course { id: string | number; title: string; }

interface ReviewsData {
  reviews: Review[];
  stats: OverallStats | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortBy = 'newest' | 'oldest' | 'highest' | 'lowest';

const EMPTY_PAGE: ReviewsData = {
  reviews: [], stats: null, totalCount: 0, page: 1, pageSize: 20, totalPages: 0,
};

@Component({
  selector: 'app-teacher-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TranslocoModule,
    LucideAngularModule,
    NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule,
    NzModalModule, NzSelectModule, NzPaginationModule,
    NzInputModule, NzProgressModule, NzRateModule, NzAvatarModule,
  ],
  templateUrl: './teacher-reviews.html',
  styleUrls:   ['./teacher-reviews.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherReviews' },
  ],
})
export class TeacherReviews implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private notify    = inject(NzNotificationService);
  private msg       = inject(NzMessageService);
  private transloco = inject(TranslocoService);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon  = ArrowLeft;
  readonly ArrowRightIcon = ArrowRight;
  readonly RefreshIcon    = RefreshCw;
  readonly FilterIcon     = Filter;
  readonly SearchIcon     = Search;
  readonly XIcon          = X;
  readonly StarIcon       = Star;
  readonly MessageIcon    = MessageSquare;
  readonly BookIcon       = BookOpen;
  readonly CheckIcon      = CheckCircle;
  readonly ClockIcon      = Clock;
  readonly EyeIcon        = Eye;
  readonly BarChartIcon   = BarChart2;
  readonly TrophyIcon     = Trophy;
  readonly UsersIcon      = Users;
  readonly ChevUpIcon     = ChevronUp;
  readonly ChevDownIcon   = ChevronDown;
  readonly TrendingIcon   = TrendingUp;

  // ── RTL Detection ──────────────────────────────────────────────────
  /** Returns true when the active language is RTL (Arabic). */
  get isRtl(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  /** Returns the correct back-arrow icon depending on text direction. */
  get backArrowIcon() {
    return this.isRtl ? this.ArrowRightIcon : this.ArrowLeftIcon;
  }

  // ── State ──────────────────────────────────────────────────────────
  loading        = signal(true);
  reviewsLoading = signal(false);

  reviewsData  = signal<ReviewsData>(EMPTY_PAGE);
  overallStats = signal<OverallStats | null>(null);
  courses      = signal<Course[]>([]);

  // Detail modal
  selectedReview  = signal<Review | null>(null);
  detailVisible   = signal(false);

  // Filters
  searchText     = signal('');
  selectedCourse = signal<string | number | null>(null);
  selectedRating = signal<number | null>(null);
  sortBy         = signal<SortBy>('newest');
  filtersVisible = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize    = signal(20);

  // ── Computed ───────────────────────────────────────────────────────
  statCards = computed(() => {
    const s = this.overallStats();
    if (!s) return [];
    return [
      {
        labelKey: this.t('teacherReviews.average_rating'),
        value: s.averageRating.toFixed(1),
        suffix: this.t('out_of_5'),
        color: this.ratingColor(s.averageRating),
        bg: '#fffbeb',
        icon: this.StarIcon,
        sub: `${this.t('based_on')} ${s.totalReviews} ${this.t('reviews')}`,
      },
      {
        labelKey: this.t('teacherReviews.total_reviews'),
        value: s.totalReviews,
        suffix: '',
        color: '#3d5af1',
        bg: '#eef0ff',
        icon: this.MessageIcon,
        sub: `${this.t('across')} ${s.totalCourses} ${this.t('courses')}`,
      },
      {
        labelKey: this.t('teacherReviews.recent_rating'),
        value: (s.recentAverageRating ?? 0).toFixed(1),
        suffix: this.t('out_of_5'),
        color: '#0891b2',
        bg: '#ecfeff',
        icon: this.TrendingIcon,
        sub: `${s.recentReviewsCount} ${this.t('recent_reviews')}`,
      },
    ];
  });

  ratingDistribution = computed(() => {
    const s = this.overallStats();
    if (!s) return [];
    return [
      { stars: 5, count: s.fiveStarCount,  pct: s.fiveStarPercentage },
      { stars: 4, count: s.fourStarCount,  pct: s.fourStarPercentage },
      { stars: 3, count: s.threeStarCount, pct: s.threeStarPercentage },
      { stars: 2, count: s.twoStarCount,   pct: s.twoStarPercentage },
      { stars: 1, count: s.oneStarCount,   pct: s.oneStarPercentage },
    ];
  });

  insights = computed(() => {
    const s = this.overallStats();
    if (!s) return [];
    const total = s.totalReviews || 1;
    return [
      {
        label: this.t('satisfaction_rate'),
        value: `${(((s.fiveStarCount + s.fourStarCount) / total) * 100).toFixed(0)}%`,
        color: '#059669',
      },
      {
        label: this.t('total_courses'),
        value: s.totalCourses || 0,
        color: '#94a3b8',
      },
    ];
  });

  filteredReviews = computed(() => {
    let data = [...(this.reviewsData().reviews || [])];

    const q = this.searchText().toLowerCase();
    if (q) {
      data = data.filter(r =>
        (r.comment || '').toLowerCase().includes(q) ||
        (r.userName || '').toLowerCase().includes(q) ||
        (r.courseTitle || '').toLowerCase().includes(q)
      );
    }

    return data;
  });

  paginatedReviews = computed(() => {
    const data  = this.filteredReviews();
    const start = (this.currentPage() - 1) * this.pageSize();
    return data.slice(start, start + this.pageSize());
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.transloco.langChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.fetchAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data fetching ──────────────────────────────────────────────────
  async fetchAllData(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.fetchOverallStats(),
        this.fetchCourses(),
        this.fetchReviews(),
      ]);
    } catch {
      this.notify.error(this.t('error'), this.t('error_loading_reviews'));
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  async fetchOverallStats(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/CourseReviews/instructor/overall-stats`)
      );
      if (res?.success) this.overallStats.set(res.data);
    } catch {
      // Non-fatal error - silently ignore
    }
  }

  async fetchCourses(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/instructor/my-courses`)
      );
      if (res?.success) this.courses.set(res.data?.courses || []);
    } catch {
      // Non-fatal error - silently ignore
    }
  }

  async fetchReviews(): Promise<void> {
    this.reviewsLoading.set(true);
    try {
      const params: Record<string, any> = {
        page:     this.currentPage(),
        pageSize: this.pageSize(),
        sortBy:   this.sortBy(),
      };
      if (this.selectedCourse()) params['courseId']  = this.selectedCourse();
      if (this.selectedRating()) {
        params['minRating'] = this.selectedRating();
        params['maxRating'] = this.selectedRating();
      }

      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/CourseReviews/instructor/reviews`, { params })
      );
      if (res?.success) this.reviewsData.set(res.data ?? EMPTY_PAGE);
    } catch {
      // Non-fatal error - silently ignore
    } finally {
      this.reviewsLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────
  onRefresh(): void {
    this.resetFilters();
    this.fetchAllData();
    this.msg.success(this.t('data_refreshed') || 'Data refreshed');
  }

  onSearchChange(val: string): void {
    this.searchText.set(val);
    this.currentPage.set(1);
  }

  onCourseChange(val: string | number | null): void {
    this.selectedCourse.set(val);
    this.currentPage.set(1);
    this.fetchReviews();
  }

  onRatingChange(val: number | null): void {
    this.selectedRating.set(val);
    this.currentPage.set(1);
    this.fetchReviews();
  }

  onSortChange(val: SortBy): void {
    this.sortBy.set(val);
    this.currentPage.set(1);
    this.fetchReviews();
  }

  onRatingRowClick(stars: number): void {
    const current = this.selectedRating();
    this.onRatingChange(current === stars ? null : stars);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.fetchReviews();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchReviews();
  }

  resetFilters(): void {
    this.searchText.set('');
    this.selectedCourse.set(null);
    this.selectedRating.set(null);
    this.sortBy.set('newest');
    this.currentPage.set(1);
    this.fetchReviews();
  }

  // ── Detail Modal ───────────────────────────────────────────────────
  openDetail(review: Review): void {
    this.selectedReview.set(review);
    this.detailVisible.set(true);
  }

  closeDetail(): void {
    this.detailVisible.set(false);
    this.selectedReview.set(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  getPaginationRange(): string {
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(this.currentPage() * this.pageSize(), this.filteredReviews().length);
    const total = this.filteredReviews().length;
    
    return this.t('total_reviews_count')
      .replace('{range}', `${start}-${end}`)
      .replace('{total}', total.toString());
  }

  ratingColor(r: number): string {
    if (r >= 4.5) return '#059669';
    if (r >= 3.5) return '#3d5af1';
    if (r >= 2.5) return '#d97706';
    return '#dc2626';
  }

  ratingBarColor(stars: number): string {
    return this.ratingColor(stars);
  }

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateTime(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  starsArray(n: number): number[] {
    return Array.from({ length: Math.min(5, Math.max(0, Math.round(n))) }, (_, i) => i);
  }

  goBack(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  // ── Translation helper ─────────────────────────────────────────────
  t(key: string): string {
    const result = this.transloco.translate(`teacherReviews.${key}`);
    // Return the key itself if translation returns the key (fallback)
    return result === `teacherReviews.${key}` ? key : result;
  }
}