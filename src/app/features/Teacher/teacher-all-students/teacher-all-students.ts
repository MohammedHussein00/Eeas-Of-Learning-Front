import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { Router }            from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, RefreshCw, Download, Filter, Search, X,
  Users, Trophy, BookOpen, DollarSign, Eye, Mail, Clock,
  ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-angular';

import { NzSpinModule }        from 'ng-zorro-antd/spin';
import { NzTableModule }       from 'ng-zorro-antd/table';
import { NzTagModule }         from 'ng-zorro-antd/tag';
import { NzTooltipModule }     from 'ng-zorro-antd/tooltip';
import { NzModalModule }       from 'ng-zorro-antd/modal';
import { NzSelectModule }      from 'ng-zorro-antd/select';
import { NzDatePickerModule }  from 'ng-zorro-antd/date-picker';
import { NzPaginationModule }  from 'ng-zorro-antd/pagination';
import { NzInputModule }       from 'ng-zorro-antd/input';
import { NzNotification } from '../../../core/services/custom-notification&messages/NzNotification';

import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ────────────────────────────────────────────────────────────
interface Course { id: string; title: string; [k: string]: any; }

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  userName: string;
  userEmail: string;
  enrolledAt: string;
  progressPercentage?: number;
  isCompleted?: boolean;
  amount?: number;
}

interface Statistics {
  totalStudents: number;
  activeStudents: number;
  completedStudents: number;
  averageProgress: number;
  totalEnrollments: number;
  totalRevenue: number;
}

interface StudentAggregate {
  id: string;
  totalEnrollments: number;
  completedEnrollments: number;
  totalProgress: number;
}

type SortBy    = 'name' | 'enrolled' | 'amount';
type SortOrder = 'asc'  | 'desc';

@Component({
  selector: 'app-teacher-all-students',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TranslocoModule,
    LucideAngularModule,
    NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule,
    NzModalModule, NzSelectModule, NzDatePickerModule,
    NzPaginationModule, NzInputModule,
  ],
  templateUrl: './teacher-all-students.html',
  styleUrls:   ['./teacher-all-students.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherAllStudents' },
  ],
})
export class TeacherAllStudents implements OnInit, OnDestroy {
  private http         = inject(HttpClient);
  public  router       = inject(Router);
  private config       = inject(APP_CONFIG);
  private notification = inject(NzNotification);
  private transloco    = inject(TranslocoService);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon  = ArrowLeft;
  readonly RefreshIcon    = RefreshCw;
  readonly DownloadIcon   = Download;
  readonly FilterIcon     = Filter;
  readonly SearchIcon     = Search;
  readonly XIcon          = X;
  readonly UsersIcon      = Users;
  readonly TrophyIcon     = Trophy;
  readonly BookIcon       = BookOpen;
  readonly DollarIcon     = DollarSign;
  readonly EyeIcon        = Eye;
  readonly MailIcon       = Mail;
  readonly ClockIcon      = Clock;
  readonly ChevUpIcon     = ChevronUp;
  readonly ChevDownIcon   = ChevronDown;
  readonly SortIcon       = ChevronsUpDown;

  // ── State ──────────────────────────────────────────────────────────
  loading         = signal(true);
  enrollments     = signal<Enrollment[]>([]);
  filtered        = signal<Enrollment[]>([]);
  courses         = signal<Course[]>([]);
  statistics      = signal<Statistics>({
    totalStudents: 0, activeStudents: 0, completedStudents: 0,
    averageProgress: 0, totalEnrollments: 0, totalRevenue: 0,
  });

  // Filters
  searchText      = signal('');
  selectedCourse  = signal('all');
  dateRange       = signal<[Date, Date] | null>(null);
  sortBy          = signal<SortBy>('name');
  sortOrder       = signal<SortOrder>('asc');
  filtersVisible  = signal(true);

  // Pagination
  currentPage     = signal(1);
  pageSize        = signal(10);

  // Export modal
  exportVisible   = signal(false);
  exportLoading   = signal(false);

  // ── Computed ───────────────────────────────────────────────────────
  paginated = computed(() => {
    const data = this.filtered();
    const start = (this.currentPage() - 1) * this.pageSize();
    return data.slice(start, start + this.pageSize());
  });

  statCards = computed(() => [
    { labelKey: 'total_students',     value: this.statistics().totalStudents,                 color: '#3d5af1', bg: '#eef0ff',  icon: this.UsersIcon },
    { labelKey: 'completed_students', value: this.statistics().completedStudents,             color: '#e67e22', bg: '#fff7ed',  icon: this.TrophyIcon },
    { labelKey: 'total_enrollments',  value: this.statistics().totalEnrollments,              color: '#0891b2', bg: '#ecfeff',  icon: this.BookIcon },
    { labelKey: 'total_revenue',      value: '$' + this.statistics().totalRevenue.toFixed(2), color: '#27ae60', bg: '#e8faf0',  icon: this.DollarIcon },
  ]);

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {

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
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/courses/instructor-courses?page=1&pageSize=100`)
      );
      let coursesList: Course[] = [];
      if (res?.success) {
        coursesList = res.data?.courses || [];
        this.courses.set(coursesList);
      }
      await this.fetchAllEnrollments(coursesList);
    } catch (error) {


    } finally {
      this.loading.set(false);
    }
  }

  /**
   * FIX: fetch all course enrollments in parallel with Promise.all
   * instead of sequentially awaiting each course inside a for-loop.
   * This reduces total load time from O(n * latency) to O(latency).
   */
  private async fetchAllEnrollments(coursesList: Course[]): Promise<void> {
    if (!coursesList?.length) {
      this.enrollments.set([]);
      this.filtered.set([]);
      this.statistics.set({
        totalStudents: 0, activeStudents: 0, completedStudents: 0,
        averageProgress: 0, totalEnrollments: 0, totalRevenue: 0,
      });
      return;
    }

    // Fire all enrollment requests simultaneously
    const results = await Promise.allSettled(
      coursesList.map(course =>
        firstValueFrom(
          this.http.get<any>(
            `${this.config.baseUrl}/api/enrollments/teacher/course/${course.id}/enrollments`
          )
        ).then(res => ({ course, res }))
      )
    );

    let all: Enrollment[] = [];
    const unique = new Map<string, StudentAggregate>();

    for (const result of results) {
      if (result.status === 'rejected') {
        // Log error but continue - per-course errors are non-fatal
        console.error('Failed to fetch enrollments for a course:', result.reason);
        continue;
      }

      const { course, res } = result.value;
      if (!res?.success) continue;

      const rows: any[] = res.data || [];
      all = [
        ...all,
        ...rows.map(e => ({
          ...e,
          courseTitle: course.title,
          courseId:    course.id,
          coursePrice: e.amount || 0,
        })),
      ];

      rows.forEach(e => {
        if (!unique.has(e.userId)) {
          unique.set(e.userId, {
            id: e.userId,
            totalEnrollments: 0,
            completedEnrollments: 0,
            totalProgress: 0,
          });
        }
        const s = unique.get(e.userId)!;
        s.totalEnrollments += 1;
        if (e.isCompleted) s.completedEnrollments += 1;
        s.totalProgress += e.progressPercentage || 0;
      });
    }

    this.enrollments.set(all);
    const students = Array.from(unique.values());

    this.statistics.set({
      totalStudents:     students.length,
      activeStudents:    students.filter(s => s.totalEnrollments > s.completedEnrollments).length,
      completedStudents: students.filter(s => s.completedEnrollments === s.totalEnrollments && s.totalEnrollments > 0).length,
      averageProgress:   students.length > 0
        ? Math.round(
            students.reduce((sum, s) => sum + (s.totalProgress / s.totalEnrollments), 0) / students.length
          )
        : 0,
      totalEnrollments: all.length,
      totalRevenue:     all.filter(e => e.amount).reduce((sum, e) => sum + (e.amount || 0), 0),
    });

    this.applyFilters();
  }

  // ── Filtering & sorting ────────────────────────────────────────────
  applyFilters(): void {
    let data = [...this.enrollments()];

    const q = this.searchText().toLowerCase();
    if (q) {
      data = data.filter(e =>
        e.userName?.toLowerCase().includes(q) ||
        e.userEmail?.toLowerCase().includes(q)
      );
    }

    if (this.selectedCourse() !== 'all') {
      data = data.filter(e => e.courseId === this.selectedCourse());
    }

    const dr = this.dateRange();
    if (dr?.[0] && dr?.[1]) {
      const s = dr[0].getTime();
      const e = new Date(dr[1]);
      e.setHours(23, 59, 59, 999);
      const endTime = e.getTime();
      data = data.filter(en => {
        const d = new Date(en.enrolledAt).getTime();
        return d >= s && d <= endTime;
      });
    }

    data.sort((a, b) => {
      let cmp = 0;
      if (this.sortBy() === 'name')     cmp = (a.userName || '').localeCompare(b.userName || '');
      if (this.sortBy() === 'enrolled') cmp = new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime();
      if (this.sortBy() === 'amount')   cmp = (a.amount || 0) - (b.amount || 0);
      return this.sortOrder() === 'asc' ? cmp : -cmp;
    });

    this.filtered.set(data);
    this.currentPage.set(1);
  }

  onSearchChange(val: string): void    { this.searchText.set(val);    this.applyFilters(); }
  onCourseChange(val: string): void    { this.selectedCourse.set(val); this.applyFilters(); }
  onDateRangeChange(dates: [Date, Date] | null): void { this.dateRange.set(dates); this.applyFilters(); }
  onSortByChange(val: SortBy): void    { this.sortBy.set(val);        this.applyFilters(); }
  onSortOrderChange(val: SortOrder): void { this.sortOrder.set(val);  this.applyFilters(); }

  resetFilters(): void {
    this.searchText.set('');
    this.selectedCourse.set('all');
    this.dateRange.set(null);
    this.sortBy.set('name');
    this.sortOrder.set('asc');
    this.applyFilters();
  }
testNotification(): void {
   this.notification.open({
      title: 'Deployment Started',
      content: 'Build pipeline triggered for main branch.',
      icon: ChevronDown,
      placement: 'bottomRight',
      duration: 6000,
    });
  

}
  // ── Pagination ─────────────────────────────────────────────────────
  onPageChange(page: number): void     { this.currentPage.set(page); }
  onPageSizeChange(size: number): void { this.pageSize.set(size); this.currentPage.set(1); }

  // ── Export ─────────────────────────────────────────────────────────
  openExportModal(): void  { this.exportVisible.set(true); }
  closeExportModal(): void { this.exportVisible.set(false); }

  async handleExport(): Promise<void> {
    this.exportLoading.set(true);
    try {
      const rows = this.filtered().map(e => ({
        [this.t('student_name')]:  e.userName,
        [this.t('email')]:         e.userEmail,
        [this.t('course')]:        e.courseTitle,
        [this.t('enrolled_date')]: new Date(e.enrolledAt).toLocaleDateString(),
        [this.t('progress')]:      `${e.progressPercentage || 0}%`,
        [this.t('amount')]:        `$${(e.amount || 0).toFixed(2)}`,
      }));

      const headers = Object.keys(rows[0] || {});
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `enrollments_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.notification.success(
        this.t('success'),
        this.t('export_success'),
        { duration: 77000 }
      );
    } catch (error) {
         this.notification.success(
        this.t('success'),
        this.t('export_success'),
        { duration: 77000 }
      );
      
    } finally {
      this.exportLoading.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  progressColor(pct: number): string {
    return pct >= 80 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#3d5af1';
  }

  initial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString();
  }

  goBack(): void { this.router.navigate(['/teacher/dashboard']); }

  viewStudent(userId: string, courseId: string): void {
    this.router.navigate(['/teacher/students', userId, 'courses', courseId]);
  }

  t(key: string): string {
    return this.transloco.translate(`teacherAllStudents.${key}`);
  }

}