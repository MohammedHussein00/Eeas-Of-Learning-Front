import {
  Component, OnInit, OnDestroy, inject, signal,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import {
  LucideAngularModule,
  ArrowLeft, ArrowRight, Eye, Mail, Clock, CheckCircle,
  BarChart3, Users, User, HelpCircle, Filter, Search, Download,
  RefreshCw, AlertCircle,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// ── Ant Design ─────────────────────────────────────────────────────
import { NzCardModule }        from 'ng-zorro-antd/card';
import { NzButtonModule }      from 'ng-zorro-antd/button';
import { NzInputModule }       from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule }      from 'ng-zorro-antd/select';
import { NzDatePickerModule }  from 'ng-zorro-antd/date-picker';
import { NzTableModule }       from 'ng-zorro-antd/table';
import { NzTagModule }         from 'ng-zorro-antd/tag';
import { NzAvatarModule }      from 'ng-zorro-antd/avatar';
import { NzProgressModule }    from 'ng-zorro-antd/progress';
import { NzSpinModule }        from 'ng-zorro-antd/spin';
import { NzEmptyModule }       from 'ng-zorro-antd/empty';
import { NzTooltipModule }     from 'ng-zorro-antd/tooltip';
import { NzModalModule }       from 'ng-zorro-antd/modal';
import { NzRadioModule }       from 'ng-zorro-antd/radio';
import { NzSwitchModule }      from 'ng-zorro-antd/switch';
import { NzAlertModule }       from 'ng-zorro-antd/alert';
import { NzGridModule }        from 'ng-zorro-antd/grid';
import { NzFormModule }        from 'ng-zorro-antd/form';

// ── Types ───────────────────────────────────────────────────────────
interface CourseInfo {
  id: string | number;
  title: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  studentCount?: number;
  rating?: number;
}

interface StudentRecord {
  enrollmentId: string | number;
  studentId: string | number;
  studentName: string;
  studentEmail: string;
  studentAvatar?: string;
  enrollmentDate: string;
  status: number; // 0 = Enrolled, 1 = PendingPayment, 2 = Cancelled
  enrollmentType: number; // 0 = Free, 1 = Paid
  progressPercentage: number;
  completedLectures: number;
  totalLectures: number;
  totalWatchTimeSeconds: number;
  lastAccessedAt:string;
  formattedWatchTime: string;
  averageQuizScore: number;
  totalQuizAttempts: number;
  notesCount: number;
  isCompleted: boolean;
  certificateEarned: boolean;
}

interface CourseStats {
  total: number;
  enrolled: number;
  pending: number;
  cancelled: number;
  completionRate: number;
  averageProgress: number;
}

interface SearchFilters {
  searchTerm: string;
  enrollmentDateRange: [string, string] | null;
  sortDescending: boolean;
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: SearchFilters = {
  searchTerm: '',
  enrollmentDateRange: null,
  sortDescending: true,
  page: 1,
  pageSize: 20,
};

const progressColor = (pct: number): string => {
  if (pct >= 80) return '#52c41a';
  if (pct >= 50) return '#faad14';
  return '#ff4d4f';
};

@Component({
  selector: 'app-teacher-course-students',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslocoModule, LucideAngularModule,
    NzCardModule, NzButtonModule, NzInputModule, NzInputNumberModule, NzSelectModule,
    NzDatePickerModule, NzTableModule, NzTagModule, NzAvatarModule, NzProgressModule,
    NzSpinModule, NzEmptyModule, NzTooltipModule, NzModalModule, NzRadioModule,
    NzSwitchModule, NzAlertModule, NzGridModule, NzFormModule,
  ],
  templateUrl: './teacher-course-students.html',
  styleUrls: ['./teacher-course-students.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'courseStudents' }],
})
export class TeacherCourseStudents implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private fb        = inject(FormBuilder);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon   = ArrowLeft;
  readonly ArrowRightIcon  = ArrowRight;
  readonly EyeIcon         = Eye;
  readonly MailIcon        = Mail;
  readonly ClockIcon       = Clock;
  readonly CheckCircleIcon = CheckCircle;
  readonly BarChartIcon    = BarChart3;
  readonly TeamIcon        = Users;
  readonly UserIcon        = User;
  readonly HelpCircleIcon  = HelpCircle;
  readonly FilterIcon      = Filter;
  readonly SearchIcon      = Search;
  readonly DownloadIcon    = Download;
  readonly RefreshCwIcon   = RefreshCw;
  readonly AlertCircleIcon = AlertCircle;

  readonly baseUrl      = this.config.baseUrl;
  readonly progressColor = progressColor;

  courseId = '';

  // ── State signals ──────────────────────────────────────────────────
  loading         = signal(true);
  course          = signal<CourseInfo | null>(null);
  students        = signal<StudentRecord[]>([]);
  studentsLoading = signal(false);
  stats           = signal<CourseStats>({
    total: 0, enrolled: 0, pending: 0, cancelled: 0, completionRate: 0, averageProgress: 0,
  });
  searchFilters   = signal<SearchFilters>({ ...DEFAULT_FILTERS });

  // Export modal
  exportVisible = signal(false);
  exportLoading = signal(false);
  exportFormat  = signal<'csv' | 'json' | 'pdf'>('csv');

  // ── RTL detection ──────────────────────────────────────────────────
  /** Returns true when the active language is RTL (Arabic). */
  get isRtl(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  /** Returns the correct back-arrow icon depending on text direction. */
  get backArrowIcon() {
    return this.isRtl ? this.ArrowRightIcon : this.ArrowLeftIcon;
  }

  // ── Filter form ──────────────────────────────────────────────────
  filterForm = this.fb.group({
    searchTerm:          [''],
    enrollmentDateRange: [null as any],
    sortDescending:      [true],
  });

  pageSizeOptions = [10, 20, 50, 100];

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    // Re-detect direction when language changes
    this.transloco.langChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.courseId = this.route.snapshot.paramMap.get('courseId') ?? '';
    if (this.courseId) {
      this.fetchCourseData();
      this.fetchStudentsList();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ───────────────────────────────────────────────────
  private async fetchCourseData(): Promise<void> {
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/courses/${this.courseId}/preview-admin-teacher`)
      );
      if (res?.success) this.course.set(res.data);
    } catch {
      this.toast.error(this.t('failed_to_load_course_info'));
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  async fetchStudentsList(): Promise<void> {
    this.studentsLoading.set(true);
    try {
      const payload: any = {
        searchTerm: this.searchFilters().searchTerm || '',
        sortDescending: this.searchFilters().sortDescending,
        page: this.searchFilters().page,
        pageSize: this.searchFilters().pageSize,
      };

      // Add date range if present
      if (this.searchFilters().enrollmentDateRange) {
        payload.fromDate = this.searchFilters().enrollmentDateRange![0];
        payload.toDate = this.searchFilters().enrollmentDateRange![1];
      }

      const res: any = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/enrollments/teacher/course/${this.courseId}/students/search`,
          payload
        )
      );
      
      if (res?.success) {
        const list: StudentRecord[] = res.data || [];
        this.students.set(list);

        const total = list.length;
        const enrolled = list.filter(s => s.status === 0).length;
        const pending = list.filter(s => s.status === 1).length;
        const cancelled = list.filter(s => s.status === 2).length;
        const completed = list.filter(s => s.isCompleted).length;
        
        this.stats.set({
          total,
          enrolled,
          pending,
          cancelled,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          averageProgress: total > 0
            ? Math.round(list.reduce((sum, s) => sum + (s.progressPercentage || 0), 0) / total)
            : 0,
        });
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      this.toast.error(this.t('failed_to_load_students_list'));
    } finally {
      this.studentsLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Filters ──────────────────────────────────────────────────────
  applyFilters(): void {
    const v = this.filterForm.value;
    this.searchFilters.update(f => ({
      ...f,
      searchTerm:          v.searchTerm || '',
      sortDescending:      v.sortDescending ?? true,
      enrollmentDateRange: v.enrollmentDateRange
        ? [v.enrollmentDateRange[0].toISOString(), v.enrollmentDateRange[1].toISOString()]
        : null,
      page: 1,
    }));
    this.fetchStudentsList();
  }

  resetFilters(): void {
    this.filterForm.reset({
      searchTerm: '',
      enrollmentDateRange: null,
      sortDescending: true,
    });
    this.searchFilters.set({ ...DEFAULT_FILTERS });
    this.fetchStudentsList();
  }

  refresh(): void {
    this.fetchCourseData();
    this.fetchStudentsList();
  }

  // ── Pagination ───────────────────────────────────────────────────
  onPageChange(page: number): void {
    this.searchFilters.update(f => ({ ...f, page }));
    this.fetchStudentsList();
  }

  onPageSizeChange(pageSize: number): void {
    this.searchFilters.update(f => ({ ...f, page: 1, pageSize }));
    this.fetchStudentsList();
  }

  // ── Export ───────────────────────────────────────────────────────
  openExportModal(): void { this.exportFormat.set('csv'); this.exportVisible.set(true); }
  closeExportModal(): void { this.exportVisible.set(false); this.exportLoading.set(false); }
  setExportFormat(fmt: 'csv' | 'json' | 'pdf'): void { this.exportFormat.set(fmt); }

  async handleExport(): Promise<void> {
    this.exportLoading.set(true);
    try {
      const list = this.students();
      const fmt  = this.exportFormat();

      if (fmt === 'pdf') {
        this.toast.info(this.t('pdf_coming_soon'));
        this.exportLoading.set(false);
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      let blob: Blob; let fileName: string;

      if (fmt === 'json') {
        const exportData = {
          course: this.course()?.title || this.t('unknown_course'),
          exportDate: new Date().toISOString(),
          format: fmt,
          students: list.map(s => ({
            name: s.studentName,
            email: s.studentEmail,
            enrollmentDate: s.enrollmentDate,
            status: this.statusLabel(s.status),
            progress: s.progressPercentage,
            completedLectures: s.completedLectures,
            totalLectures: s.totalLectures,
            watchTime: s.formattedWatchTime,
            lastAccessed: s.lastAccessedAt || null,
            isCompleted: s.isCompleted,
            certificateEarned: s.certificateEarned,
            averageQuizScore: s.averageQuizScore,
            totalQuizAttempts: s.totalQuizAttempts,
          })),
        };
        blob     = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        fileName = `students-${this.courseId}-${dateStr}.json`;
      } else {
        const headers = [
          'Name', 'Email', 'Enrollment Date', 'Status', 'Progress %',
          'Completed Lectures', 'Total Lectures', 'Watch Time',
          'Is Completed', 'Certificate Earned', 'Avg Quiz Score', 'Quiz Attempts'
        ];
        const rows = list.map(s => [
          s.studentName,
          s.studentEmail,
          s.enrollmentDate ? new Date(s.enrollmentDate).toLocaleDateString() : '',
          this.statusLabel(s.status),
          String(s.progressPercentage),
          String(s.completedLectures),
          String(s.totalLectures),
          s.formattedWatchTime || '0m 0s',
          s.isCompleted ? 'Yes' : 'No',
          s.certificateEarned ? 'Yes' : 'No',
          String(s.averageQuizScore),
          String(s.totalQuizAttempts),
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        blob     = new Blob([csvContent], { type: 'text/csv' });
        fileName = `students-${this.courseId}-${dateStr}.csv`;
      }

      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);

      this.toast.success(this.t('export_started'));
      this.closeExportModal();
    } catch (error) {
      console.error('Export failed:', error);
      this.toast.error(this.t('failed_to_export_student_data'));
      this.exportLoading.set(false);
    }
  }

  // ── Navigation ───────────────────────────────────────────────────
  goBackToCourse(): void {
    this.router.navigate(['/teacher/courses', this.courseId]);
  }
  
  viewStudentAnalytics(record: StudentRecord): void {
    this.router.navigate([`/teacher/students/${record.studentId}/courses/${this.courseId}`]);
  }
  
  viewEnrollment(record: StudentRecord): void {
    this.router.navigate(['/teacher/enrollments', record.enrollmentId]);
  }
  
  sendMessage(record: StudentRecord): void {
    this.router.navigate([`/teacher/chats/${record.studentId}`]);
  }

  // ── Display helpers ──────────────────────────────────────────────
  statusLabel(status: number): string {
    switch (status) {
      case 0: return this.t('enrolled');
      case 1: return this.t('pending_payment');
      case 2: return this.t('cancelled');
      default: return this.t('unknown');
    }
  }

  statusColor(status: number): string {
    switch (status) {
      case 0: return 'success';
      case 1: return 'warning';
      case 2: return 'default';
      default: return 'default';
    }
  }

  enrollmentTypeLabel(type: number): string {
    return type === 0 ? this.t('free') : this.t('paid');
  }

  enrollmentTypeColor(type: number): string {
    return type === 0 ? 'green' : 'blue';
  }

  formatDate(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  avatarUrl(path?: string): string | undefined {
    if (!path) return undefined;
    return path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
  }

  formatCountMessage(count: number): string {
    return this.t('showing_students').replace('{count}', count.toString());
  }

  formatTotalMessage(total: number): string {
    return this.t('total_items').replace('{total}', total.toString());
  }

  // ── i18n helpers ──────────────────────────────────────────────────
  /** Scope-prefixed translation (courseStudents.*) */
  t(key: string): string {
    return this.transloco.translate(`courseStudents.${key}`);
  }

  /** Common-scope translation (common.*) */
  tc(key: string): string {
    return this.transloco.translate(`common.${key}`);
  }
}