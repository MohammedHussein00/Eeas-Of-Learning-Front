import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, ViewChild, TemplateRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  BarChart2, Plus, Book, CheckCircle, XCircle, Users, DollarSign,
  Star, Search, RefreshCw, Eye, Edit, Trash2, AlertCircle, AlertTriangle
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// ── Ant Design ─────────────────────────────────────────────────────
import { NzTableModule }     from 'ng-zorro-antd/table';
import { NzSelectModule }    from 'ng-zorro-antd/select';
import { NzSpinModule }      from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTooltipModule }   from 'ng-zorro-antd/tooltip';

// ── Types ───────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  subtitle?: string;
  isPublished: boolean;
  studentCount: number;
  totalRevenue: number;
  rating: number;
  ratingCount: number;
  categoryName?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface CourseStats {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  totalStudents: number;
  totalRevenue: number;
  averageRating: number;
}

interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

interface DeleteError {
  courseId: string;
  courseName: string;
  message: string;
}

@Component({
  selector: 'app-teacher-courses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzTableModule,
    NzSelectModule,
    NzSpinModule,
    NzPopconfirmModule,
    NzTooltipModule,
  ],
  templateUrl: './teacher-courses.html',
  styleUrls: ['./teacher-courses.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherCourses' },
  ],
})
export class TeacherCourses implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  // ── Popconfirm template refs ───────────────────────────────────────
  @ViewChild('confirmTpl',     { static: true }) confirmTpl!:     TemplateRef<void>;
  @ViewChild('confirmWarnTpl', { static: true }) confirmWarnTpl!: TemplateRef<void>;

  // ── Icons ──────────────────────────────────────────────────────────
  readonly BarChartIcon      = BarChart2;
  readonly PlusIcon          = Plus;
  readonly BookIcon          = Book;
  readonly CheckCircleIcon   = CheckCircle;
  readonly XCircleIcon       = XCircle;
  readonly UsersIcon         = Users;
  readonly DollarSignIcon    = DollarSign;
  readonly StarIcon          = Star;
  readonly SearchIcon        = Search;
  readonly RefreshCwIcon     = RefreshCw;
  readonly EyeIcon           = Eye;
  readonly EditIcon          = Edit;
  readonly Trash2Icon        = Trash2;
  readonly AlertCircleIcon   = AlertCircle;
  readonly AlertTriangleIcon = AlertTriangle;

  // ── State signals ──────────────────────────────────────────────────
  loading      = signal(false);
  courses      = signal<Course[]>([]);
  stats        = signal<CourseStats>({
    totalCourses: 0, publishedCourses: 0, draftCourses: 0,
    totalStudents: 0, totalRevenue: 0, averageRating: 0,
  });
  deleteErr    = signal<DeleteError | null>(null);
  deleteSuccessMsg = signal<string | null>(null);
  deletingId   = signal<string | null>(null);
  private deleteSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  searchTerm   = signal('');
  statusFilter = signal<boolean | null>(null);
  pagination   = signal<PaginationState>({ current: 1, pageSize: 20, total: 0 });

  private search$ = new Subject<string>();

  // ── Table sort functions ───────────────────────────────────────────
  sortByStudents = (a: Course, b: Course): number => (a.studentCount || 0) - (b.studentCount || 0);
  sortByRevenue  = (a: Course, b: Course): number => (a.totalRevenue  || 0) - (b.totalRevenue  || 0);

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.pagination.update(p => ({ ...p, current: 1 }));
      this.fetchCourses();
    });

    this.fetchCourses();
    this.fetchStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.deleteSuccessTimer) clearTimeout(this.deleteSuccessTimer);
  }

  // ── Data loading ───────────────────────────────────────────────────
  async fetchCourses(): Promise<void> {
    this.loading.set(true);
    try {
      const p = this.pagination();
      let params = new HttpParams()
        .set('page',      p.current)
        .set('pageSize',  p.pageSize)
        .set('sortBy',    'createdAt')
        .set('sortOrder', 'desc');

      if (this.searchTerm())            params = params.set('searchTerm', this.searchTerm());
      if (this.statusFilter() !== null) params = params.set('isPublished', String(this.statusFilter()));

      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/Teacher/instructor/my-courses`, { params })
      );
      if (res?.success) {
        this.courses.set(res.data?.courses ?? []);
        this.pagination.update(prev => ({ ...prev, total: res.data?.totalCount ?? 0 }));
      }
    } catch {
      this.toast.error(this.t('loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  async fetchStats(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/Teacher/instructor/statistics`)
      );
      if (res?.success) this.stats.set(res.data ?? {});
    } catch { /* silently ignore */ }
  }

  // ── Filter handlers ────────────────────────────────────────────────
  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.pagination.update(p => ({ ...p, current: 1 }));
    this.fetchCourses();
  }

  onStatusChange(value: boolean | null): void {
    this.statusFilter.set(value ?? null);
    this.pagination.update(p => ({ ...p, current: 1 }));
    this.fetchCourses();
  }

  refresh(): void {
    this.deleteErr.set(null);
    this.clearDeleteSuccess();
    this.fetchCourses();
    this.fetchStats();
  }

  // ── Pagination ─────────────────────────────────────────────────────
  onPageChange(page: number): void {
    this.pagination.update(p => ({ ...p, current: page }));
    this.fetchCourses();
  }

  onPageSizeChange(size: number): void {
    this.pagination.update(p => ({ ...p, current: 1, pageSize: size }));
    this.fetchCourses();
  }

  // ── Delete ─────────────────────────────────────────────────────────
  async handleDelete(courseId: string, courseName: string): Promise<void> {
    this.deleteErr.set(null);
    this.deleteSuccessMsg.set(null);
    if (this.deleteSuccessTimer) clearTimeout(this.deleteSuccessTimer);
    this.deletingId.set(courseId);
    try {
      const res = await firstValueFrom(
        this.http.delete<any>(`${this.config.baseUrl}/api/courses/${courseId}`)
      );

      if (res && res.success === false) {
        const serverMsg = (res.message ?? '') as string;
        const msg = serverMsg && !serverMsg.startsWith('[')
          ? serverMsg
          : this.t('deleteFailed');
        this.deleteErr.set({ courseId, courseName, message: msg });
        this.cdr.markForCheck();
        return;
      }

      const msg = this.t('deleteSuccess');
      this.toast.success(msg);
      this.deleteSuccessMsg.set(msg);
      this.cdr.markForCheck();
      this.deleteSuccessTimer = setTimeout(() => {
        this.deleteSuccessMsg.set(null);
        this.cdr.markForCheck();
      }, 4000);
      this.fetchCourses();
      this.fetchStats();
    } catch (err: any) {
      const status    = err?.status as number;
      const rawMsg    = (err?.error?.message ?? err?.message ?? '') as string;
      const serverMsg = rawMsg.startsWith('[') ? '' : rawMsg;
      const msg =
        serverMsg
          ? serverMsg
          : status === 400
            ? this.t('deleteHasStudents')
            : status === 403 || status === 401
              ? this.t('permissionDenied')
              : this.t('deleteFailed');
      this.deleteErr.set({ courseId, courseName, message: msg });
      this.cdr.markForCheck();
    } finally {
      this.deletingId.set(null);
      this.cdr.markForCheck();
    }
  }

  clearDeleteErr(): void { this.deleteErr.set(null); }

  clearDeleteSuccess(): void {
    if (this.deleteSuccessTimer) clearTimeout(this.deleteSuccessTimer);
    this.deleteSuccessMsg.set(null);
  }

  // ── Navigation ─────────────────────────────────────────────────────
  navigateToCreate(): void { this.router.navigate(['/teacher/add-course']); }
  viewCourse(id: string):   void { this.router.navigate(['/teacher/courses', id, 'builder']); }
  editCourse(id: string):   void { this.router.navigate(['/teacher/courses', id]); }

  // ── i18n helper ────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`teacherCourses.${key}`);
  }
}