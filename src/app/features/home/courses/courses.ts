import {
  Component, inject, signal, computed, OnInit,
  ChangeDetectionStrategy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, filter, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  BookOpen, Search, SlidersHorizontal, X, Star, Users, Clock,
  LayoutGrid, List, ChevronDown, Filter, DollarSign, Sparkles,
  ArrowDownWideNarrow, ArrowUpNarrowWide, MessageSquare, Calendar,
  Building2, BadgeCheck, Shield
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ───────────────────────────────────────────────────────────
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

interface FilterState {
  search: string;
  minPrice: string;
  maxPrice: string;
  minRating: number;
  isFree: boolean | null;
  hasDiscount: boolean | null;
  sortBy: string;
}

interface SortOption {
  id: string;
  name: string;
  nameAr: string;
  icon: any;
}

// ── Constants ────────────────────────────────────────────────────────
const DEFAULT_FILTERS: FilterState = {
  search: '',
  minPrice: '',
  maxPrice: '',
  minRating: 0,
  isFree: null,
  hasDiscount: null,
  sortBy: 'rating',
};

const FALLBACK_IMAGE_IDS = [
  '1498050108023-c5249f4df085',
  '1551288049-bebda4e38f71',
  '1561070791-2526d30994b5',
  '1512941937669-90a1b58e7e9c',
  '1460925895917-afdab827c52f',
];

@Component({
  selector: 'app-courses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './courses.html',
  styleUrls: ['./courses.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'courses' },
  ],
})
export class Courses implements OnInit {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private transloco = inject(TranslocoService);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly BookOpenIcon          = BookOpen;
  readonly SearchIcon            = Search;
  readonly SlidersHorizontalIcon = SlidersHorizontal;
  readonly XIcon                 = X;
  readonly StarIcon              = Star;
  readonly UsersIcon             = Users;
  readonly ClockIcon             = Clock;
  readonly LayoutGridIcon        = LayoutGrid;
  readonly ListIcon              = List;
  readonly ChevronDownIcon       = ChevronDown;
  readonly FilterIcon            = Filter;
  readonly DollarSignIcon        = DollarSign;
  readonly Building2Icon         = Building2;
  readonly BadgeCheckIcon        = BadgeCheck;
  readonly ShieldIcon            = Shield;

  // ── Filter / Sort options ──────────────────────────────────────────
  readonly sortOptions: SortOption[] = [
    { id: 'rating',     name: 'Highest Rated',      nameAr: 'الأعلى تقييماً',           icon: Star },
    { id: 'newest',     name: 'Newest',              nameAr: 'الأحدث',                   icon: Sparkles },
    { id: 'oldest',     name: 'Oldest',              nameAr: 'الأقدم',                   icon: Calendar },
    { id: 'price_asc',  name: 'Price: Low to High',  nameAr: 'السعر: منخفض إلى مرتفع', icon: ArrowUpNarrowWide },
    { id: 'price_desc', name: 'Price: High to Low',  nameAr: 'السعر: مرتفع إلى منخفض', icon: ArrowDownWideNarrow },
    { id: 'students',   name: 'Most Popular',        nameAr: 'الأكثر شعبية',             icon: Users },
    { id: 'reviews',    name: 'Most Reviewed',       nameAr: 'الأكثر تقييماً',           icon: MessageSquare },
  ];

  readonly ratingOptions = [4.5, 4.0, 3.5, 3.0];
  readonly skeletonItems = Array.from({ length: 6 });

  // ── State signals ──────────────────────────────────────────────────
  loading          = signal(false);
  courses          = signal<CourseDto[]>([]);
  error            = signal('');
  totalCount       = signal(0);
  currentPage      = signal(1);
  totalPages       = signal(1);
  showFilters      = signal(false);
  sortDropdownOpen = signal(false);
  viewMode         = signal<'grid' | 'list'>('grid');
  filters          = signal<FilterState>({ ...DEFAULT_FILTERS });

  // ── Language / RTL ─────────────────────────────────────────────────
  get isRTL(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  // ── Computed ───────────────────────────────────────────────────────
  readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.isFree !== null,
      f.hasDiscount,
      f.minRating > 0,
      f.minPrice,
      f.maxPrice,
    ].filter(Boolean).length;
  });

  readonly currentSortOption = computed(() =>
    this.sortOptions.find(o => o.id === this.filters().sortBy) ?? this.sortOptions[0]
  );

  readonly currentSortLabel = computed(() => {
    const opt = this.currentSortOption();
    return this.isRTL ? opt.nameAr : opt.name;
  });

  readonly currentSortIcon = computed(() => this.currentSortOption().icon);

  readonly paginationPages = computed((): (number | string)[] => {
    const total   = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (total <= maxVisible + 2) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end   = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    // ✅ Read snapshot synchronously — avoids EmptyError entirely
    this.loadFromSnapshot();

    // Restore saved view mode
    const saved = localStorage.getItem('coursesViewMode') as 'grid' | 'list' | null;
    if (saved) this.viewMode.set(saved);

    this.fetchCourses();

    // ✅ React to browser back/forward navigation safely via NavigationEnd
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.loadFromSnapshot();
      this.fetchCourses();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Read query params from snapshot (synchronous, never throws) ────
  private loadFromSnapshot(): void {
    const p = this.route.snapshot.queryParamMap;
    this.filters.set({
      search:      p.get('search')      ?? '',
      minPrice:    p.get('minPrice')    ?? '',
      maxPrice:    p.get('maxPrice')    ?? '',
      minRating:   Number(p.get('minRating')) || 0,
      isFree:      p.get('isFree') === 'true'  ? true
                 : p.get('isFree') === 'false' ? false : null,
      hasDiscount: p.get('hasDiscount') === 'true' ? true : null,
      sortBy:      p.get('sortBy')      ?? 'rating',
    });
  }

  // ── Close sort dropdown when clicking outside ──────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.cp-sort-wrap')) {
      this.sortDropdownOpen.set(false);
    }
  }

  // ── Data loading ───────────────────────────────────────────────────
  async fetchCourses(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const f = this.filters();
      let params = new HttpParams()
        .set('SortBy',   f.sortBy)
        .set('Page',     String(this.currentPage()))
        .set('PageSize', '12');

      if (f.search)          params = params.set('SearchTerm', f.search);
      if (f.isFree !== null) params = params.set('IsFree', String(f.isFree));
      if (f.hasDiscount)     params = params.set('HasDiscount', 'true');
      if (f.minRating > 0)   params = params.set('MinRating', String(f.minRating));
      if (f.minPrice)        params = params.set('MinPrice', f.minPrice);
      if (f.maxPrice)        params = params.set('MaxPrice', f.maxPrice);

      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/Courses`, { params }),
        { defaultValue: null }   // ✅ guard against empty HTTP observable
      );

      if (res?.success) {
        const data = res.data;
        this.courses.set(data.data ?? []);
        this.totalCount.set(data.totalCount ?? 0);
        this.totalPages.set(Math.ceil((data.totalCount ?? 0) / 12));
      } else {
        this.error.set(res?.message ?? this.t('loadFailed'));
      }
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? this.t('loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filter / Search handlers ───────────────────────────────────────
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update(f => ({ ...f, search: value }));
    this.syncQueryParams();
  }

  handleSearch(): void {
    this.currentPage.set(1);
    this.fetchCourses();
  }

  onIsFreeChange(value: boolean): void {
    this.filters.update(f => ({ ...f, isFree: f.isFree === value ? null : value }));
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  onHasDiscountChange(value: boolean): void {
    this.filters.update(f => ({ ...f, hasDiscount: f.hasDiscount === value ? null : value }));
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  clearPriceFilter(): void {
    this.filters.update(f => ({ ...f, isFree: null, hasDiscount: null }));
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  onRatingChange(r: number): void {
    this.filters.update(f => ({ ...f, minRating: f.minRating === r ? 0 : r }));
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  onMinPriceChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update(f => ({ ...f, minPrice: value }));
    this.syncQueryParams();
  }

  onMaxPriceChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update(f => ({ ...f, maxPrice: value }));
    this.syncQueryParams();
  }

  clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  onSortChange(id: string): void {
    this.filters.update(f => ({ ...f, sortBy: id }));
    this.sortDropdownOpen.set(false);
    this.currentPage.set(1);
    this.fetchCourses();
    this.syncQueryParams();
  }

  // ── Sidebar / view toggle ──────────────────────────────────────────
  toggleFilters(): void     { this.showFilters.update(v => !v); }
  closeFilters(): void      { this.showFilters.set(false); }
  toggleSortDropdown(): void { this.sortDropdownOpen.update(v => !v); }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
    localStorage.setItem('coursesViewMode', mode);
  }

  // ── Pagination ─────────────────────────────────────────────────────
  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.fetchCourses();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Navigation ─────────────────────────────────────────────────────
  navigateToCourse(id: string): void {
    this.router.navigate(['/courses', id]);
  }

  // ── Image helper ───────────────────────────────────────────────────
  getCourseImage(course: CourseDto): string {
    if (course.imageUrl) {
      return `${this.config.baseUrl}${course.imageUrl}`;
    }
    const id = FALLBACK_IMAGE_IDS[Math.floor(Math.random() * FALLBACK_IMAGE_IDS.length)];
    return `https://images.unsplash.com/photo-${id}?w=600&h=400&fit=crop&auto=format`;
  }

  // ── Sync URL query params ──────────────────────────────────────────
  private syncQueryParams(): void {
    const f = this.filters();
    const qp: Record<string, string> = {};
    if (f.search)              qp['search']      = f.search;
    if (f.isFree !== null)     qp['isFree']      = String(f.isFree);
    if (f.hasDiscount)         qp['hasDiscount'] = 'true';
    if (f.minRating > 0)       qp['minRating']   = String(f.minRating);
    if (f.minPrice)            qp['minPrice']    = f.minPrice;
    if (f.maxPrice)            qp['maxPrice']    = f.maxPrice;
    if (f.sortBy !== 'rating') qp['sortBy']      = f.sortBy;
    this.router.navigate([], { queryParams: qp, replaceUrl: true });
  }

  // ── i18n helper ────────────────────────────────────────────────────
  private t(key: string): string {
    return this.transloco.translate(`courses.${key}`);
  }
  getCoursesFoundText(count: number): string {
  const key = count === 1 ? 'courseFoundSingular' : 'coursesFoundPlural';
  return this.transloco.translate(`courses.${key}`, { count });
}
}