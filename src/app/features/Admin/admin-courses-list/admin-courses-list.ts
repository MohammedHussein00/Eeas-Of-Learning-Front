import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject } from 'rxjs';
import {
  LucideAngularModule,
  BookOpen, Search, RefreshCw, Pencil, Trash2,
  CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft,
  ChevronRight, Star, Users, FileText,
  X, ChevronDown, Send, Shield, Plus, Crown,
  ToggleLeft, ToggleRight, Layers,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast }      from '../../../core/services/toast';

// Ant Design
import { NzSpinModule }    from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  isPublished: boolean;
  isFree: boolean;
  price: number;
  level?: string;
  language?: string;
  rating: number;
  ratingCount: number;
  studentCount: number;
  totalHours: number;
  totalLectures: number;
  instructorName?: string;
  categoryName?: string;
  createdAt?: string;
  publishStatus?: string | number;
  isPlatformCourse?: boolean;
  platformCreatorName?: string;
}

export interface PendingReq {
  id: string;
  courseId: string;
  courseTitle?: string;
  teacherName?: string;
  status: string;
  teacherNotes?: string;
  requestedAt?: string;
  lectureCount?: number;
  hasPromoVideo?: boolean;
}

interface ToastData {
  msg: string;
  type: 'success' | 'error';
}

interface ReviewModalState {
  open: boolean;
  req: PendingReq | null;
  mode: 'view' | 'approve' | 'reject';
}

interface UnpubModalState {
  open: boolean;
  course: Course | null;
}

interface DelModalState {
  open: boolean;
  course: Course | null;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-admin-courses-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  templateUrl: './admin-courses-list.html',
  styleUrls:   ['./admin-courses-list.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'coursesList' },
  ],
})
export class AdminCoursesListComponent implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private toastSvc  = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly BookOpenIcon      = BookOpen;
  readonly SearchIcon        = Search;
  readonly RefreshCwIcon     = RefreshCw;
  readonly PencilIcon        = Pencil;
  readonly Trash2Icon        = Trash2;
  readonly CheckCircleIcon   = CheckCircle;
  readonly XCircleIcon       = XCircle;
  readonly ClockIcon         = Clock;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly ChevronLeftIcon   = ChevronLeft;
  readonly ChevronRightIcon  = ChevronRight;
  readonly StarIcon          = Star;
  readonly UsersIcon         = Users;
  readonly FileTextIcon      = FileText;
  readonly XIcon             = X;
  readonly ChevronDownIcon   = ChevronDown;
  readonly SendIcon          = Send;
  readonly ShieldIcon        = Shield;
  readonly PlusIcon          = Plus;
  readonly CrownIcon         = Crown;
  readonly ToggleLeftIcon    = ToggleLeft;
  readonly ToggleRightIcon   = ToggleRight;
  readonly LayersIcon        = Layers;

  // ── Constants ─────────────────────────────────────
  readonly PAGE_SIZE   = 15;
  readonly skeletonRows = Array(8).fill(0);

  // ── State Signals ─────────────────────────────────
  loading       = signal(true);
  tableLoading  = signal(false);
  refreshing    = signal(false);
  submitting    = signal(false);
  deleting      = signal(false);

  courses       = signal<Course[]>([]);
  pendingReqs   = signal<PendingReq[]>([]);

  search        = signal('');
  statusFilter  = signal('all');
  typeFilter    = signal('all');
  sortBy        = signal('newest');
  currentPage   = signal(1);

  reviewFeedback = signal('');
  feedbackErr    = signal('');

  reviewModal = signal<ReviewModalState>({ open: false, req: null, mode: 'view' });
  unpubModal  = signal<UnpubModalState>({ open: false, course: null });
  delModal    = signal<DelModalState>({ open: false, course: null });
  toast       = signal<ToastData | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ──────────────────────────────────────
  get baseUrl(): string { return this.config.baseUrl; }

  isRTL = computed(() =>
    this.transloco.getActiveLang() === 'ar'
  );

  publishedCount = computed(() =>
    this.courses().filter(c => c.isPublished).length
  );

  platformCount = computed(() =>
    this.courses().filter(c => c.isPlatformCourse).length
  );

  teacherCount = computed(() =>
    this.courses().filter(c => !c.isPlatformCourse).length
  );

  filteredCourses = computed<Course[]>(() => {
    const q     = this.search().toLowerCase();
    const sf    = this.statusFilter();
    const tf    = this.typeFilter();
    const sort  = this.sortBy();

    return [...this.courses()]
      .filter(c => {
        const matchSearch = !q ||
          c.title?.toLowerCase().includes(q) ||
          c.instructorName?.toLowerCase().includes(q) ||
          c.categoryName?.toLowerCase().includes(q);

        const matchType =
          tf === 'all' ||
          (tf === 'platform' && c.isPlatformCourse) ||
          (tf === 'teacher'  && !c.isPlatformCourse);

        const ps = this.resolvePublishStatus(c);
        const matchStatus =
          sf === 'all' ||
          (sf === 'published' && ps === 'published') ||
          (sf === 'pending'   && ps === 'pending')   ||
          (sf === 'draft'     && ps === 'draft')      ||
          (sf === 'rejected'  && ps === 'rejected');

        return matchSearch && matchType && matchStatus;
      })
      .sort((a, b) => {
        if (sort === 'newest')   return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        if (sort === 'oldest')   return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        if (sort === 'rating')   return (b.rating || 0) - (a.rating || 0);
        if (sort === 'students') return (b.studentCount || 0) - (a.studentCount || 0);
        if (sort === 'title')    return (a.title || '').localeCompare(b.title || '');
        return 0;
      });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCourses().length / this.PAGE_SIZE))
  );

  pagedCourses = computed<Course[]>(() => {
    const p = this.currentPage();
    return this.filteredCourses().slice((p - 1) * this.PAGE_SIZE, p * this.PAGE_SIZE);
  });

  pageEnd = computed(() =>
    Math.min(this.currentPage() * this.PAGE_SIZE, this.filteredCourses().length)
  );

  pageNumbers = computed<number[]>(() => {
    const tp    = this.totalPages();
    const p     = this.currentPage();
    const count = Math.min(tp, 7);
    return Array.from({ length: count }, (_, i) => {
      if (tp <= 7)     return i + 1;
      if (p <= 4)      return i + 1;
      if (p >= tp - 3) return tp - 6 + i;
      return p - 3 + i;
    });
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Data Fetching ─────────────────────────────────
  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([this.fetchCourses(), this.fetchPending()]);
    } catch { /* errors handled inside each */ }
    finally { this.loading.set(false); }
  }

  async handleRefresh(): Promise<void> {
    this.refreshing.set(true);
    await this.loadAll();
    this.refreshing.set(false);
  }

  async fetchCourses(): Promise<void> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/Courses/search`, { params: { pageSize: 1000 } })
      );
      const data = res?.data ?? res ?? [];
      this.courses.set(Array.isArray(data) ? data : []);
    } catch {
      this.courses.set([]);
    }
  }

  async fetchPending(): Promise<void> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/Courses/publish-requests/pending`)
      );
      const data = res?.data ?? res ?? [];
      this.pendingReqs.set(Array.isArray(data) ? data : []);
    } catch {
      this.pendingReqs.set([]);
    }
  }

  // ── Actions ───────────────────────────────────────
  async handlePublish(course: Course): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/Courses/${course.id}/publish`, {})
      );
      this.courses.update(cs =>
        cs.map(c => c.id === course.id
          ? { ...c, isPublished: true, publishStatus: 'Published' }
          : c)
      );
      this.showToast(this.t('publishSuccess'), 'success');
    } catch (e: any) {
      this.showToast(e?.error?.message || this.t('publishError'), 'error');
    }
  }

  async handleReviewSubmit(): Promise<void> {
    const { req, mode } = this.reviewModal();
    if (!req) return;

    if (mode === 'reject' && !this.reviewFeedback().trim()) {
      this.feedbackErr.set(this.t('feedbackRequired'));
      return;
    }

    this.submitting.set(true);
    try {
      if (mode === 'approve') {
        await firstValueFrom(
          this.http.post(
            `${this.baseUrl}/api/Courses/publish-requests/${req.id}/approve`,
            { adminFeedback: this.reviewFeedback() || '' }
          )
        );
        this.courses.update(cs =>
          cs.map(c => c.id === req.courseId
            ? { ...c, isPublished: true, publishStatus: 'Published' }
            : c)
        );
        this.showToast(this.t('approveSuccess'), 'success');
      } else {
        await firstValueFrom(
          this.http.post(
            `${this.baseUrl}/api/Courses/publish-requests/${req.id}/reject`,
            { adminFeedback: this.reviewFeedback() }
          )
        );
        this.showToast(this.t('rejectSuccess'), 'success');
      }
      this.pendingReqs.update(rs => rs.filter(r => r.id !== req.id));
      this.closeReviewModal();
    } catch (e: any) {
      this.showToast(e?.error?.message || this.t('actionFailed'), 'error');
    } finally {
      this.submitting.set(false);
    }
  }

  async handleUnpublish(): Promise<void> {
    const { course } = this.unpubModal();
    if (!course) return;
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/Courses/${course.id}/unpublish`, {})
      );
      this.courses.update(cs =>
        cs.map(c => c.id === course.id
          ? { ...c, isPublished: false, publishStatus: 'Draft' }
          : c)
      );
      this.closeUnpubModal();
      this.showToast(this.t('unpublishSuccess'), 'success');
    } catch (e: any) {
      this.showToast(e?.error?.message || this.t('actionFailed'), 'error');
    }
  }

  async handleDelete(): Promise<void> {
    const { course } = this.delModal();
    if (!course) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/Courses/${course.id}`));
      this.courses.update(cs => cs.filter(c => c.id !== course.id));
      this.pendingReqs.update(rs => rs.filter(r => r.courseId !== course.id));
      this.closeDelModal();
      this.showToast(this.t('deleteSuccess'), 'success');
    } catch (e: any) {
      this.showToast(e?.error?.message || this.t('deleteError'), 'error');
    } finally {
      this.deleting.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────
  resolvePublishStatus(c: Course): string {
    if (c.isPublished) return 'published';
    const ps = String(c.publishStatus ?? '').toLowerCase().replace(/[\s_]/g, '');
    if (ps === 'pendingapproval' || ps === '1') return 'pending';
    if (ps === 'rejected'        || ps === '3') return 'rejected';
    return 'draft';
  }

  getPendingReq(courseId: string): PendingReq | undefined {
    return this.pendingReqs().find(r => r.courseId === courseId);
  }

  navigate(path: string): void {
    this.router.navigateByUrl(path);
  }

  // ── Search / Filter / Sort ────────────────────────
  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.search.set('');
    this.currentPage.set(1);
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  setStatusFilter(val: string): void {
    this.statusFilter.set(val);
    this.currentPage.set(1);
  }

  onTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  onSortBy(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  setPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.currentPage.set(n);
  }

  // ── Review Modal ──────────────────────────────────
  openReviewModal(req: PendingReq): void {
    this.reviewFeedback.set('');
    this.feedbackErr.set('');
    this.reviewModal.set({ open: true, req, mode: 'view' });
  }

  closeReviewModal(): void {
    this.reviewModal.set({ open: false, req: null, mode: 'view' });
    this.reviewFeedback.set('');
    this.feedbackErr.set('');
  }

  setReviewMode(mode: 'view' | 'approve' | 'reject'): void {
    this.reviewModal.update(s => ({ ...s, mode }));
    this.feedbackErr.set('');
  }

  onFeedbackInput(event: Event): void {
    this.reviewFeedback.set((event.target as HTMLTextAreaElement).value);
    this.feedbackErr.set('');
  }

  // ── Unpublish Modal ───────────────────────────────
  openUnpubModal(course: Course): void {
    this.unpubModal.set({ open: true, course });
  }

  closeUnpubModal(): void {
    this.unpubModal.set({ open: false, course: null });
  }

  // ── Delete Modal ──────────────────────────────────
  openDelModal(course: Course): void {
    this.delModal.set({ open: true, course });
  }

  closeDelModal(): void {
    if (this.deleting()) return;
    this.delModal.set({ open: false, course: null });
  }

  // ── Toast ─────────────────────────────────────────
  showToast(msg: string, type: 'success' | 'error'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ msg, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  // ── i18n ──────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`coursesList.${key}`);
  }
}