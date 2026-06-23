import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, ArrowRight, RefreshCw, MessageSquare, PanelRight, Mail,
  Trophy, Users, BarChart3, Clock, Video, TrendingUp,
  CheckCircle, PlayCircle, History, HelpCircle, BookOpen,
  Eye, Calendar, Info, X
} from 'lucide-angular';

import { NzSpinModule }      from 'ng-zorro-antd/spin';
import { NzTagModule }       from 'ng-zorro-antd/tag';
import { NzBadgeModule }     from 'ng-zorro-antd/badge';
import { NzProgressModule }  from 'ng-zorro-antd/progress';
import { NzTabsModule }      from 'ng-zorro-antd/tabs';
import { NzMessageService }  from 'ng-zorro-antd/message';

import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ────────────────────────────────────────────────────────────
export interface AnalyticsData {
  studentName?: string;
  studentEmail?: string;
  studentAvatar?: string;
  studentJoinedDate?: string;
  enrollmentType?: string;
  enrollmentDate?: string;
  lastAccessed?: string;
  isCompleted?: boolean;
  completedAt?: string;
  certificateEarned?: boolean;
  certificateIssuedAt?: string;
  overallProgress?: number;
  completedLectures?: number;
  totalLectures?: number;
  totalWatchTimeSeconds?: number;
  averageWatchTimePerLecture?: number;
  averageQuizScore?: number;
  totalQuizAttempts?: number;
  notesCount?: number;
  sectionProgress?: SectionProgress[];
  quizPerformance?: QuizPerformance[];
  watchPatterns?: WatchPattern[];
  otherCoursesWithTeacher?: OtherCourse[];
}

export interface SectionProgress {
  sectionId: string | number;
  sectionTitle: string;
  progressPercentage: number;
  completedLectures: number;
  totalLectures: number;
  totalWatchTimeSeconds: number;
  averageWatchTime: number;
  lectures: LectureProgress[];
}

export interface LectureProgress {
  lectureId: string | number;
  lectureTitle: string;
  isCompleted: boolean;
  watchTimeSeconds: number;
  watchPercentage: number;
}

export interface QuizPerformance {
  quizId: string | number;
  quizTitle: string;
  quizType: string;
  attemptCount: number;
  averageScore: number;
  bestScore: number;
  lastAttemptDate: string;
}

export interface WatchPattern {
  date: string;
  totalWatchTimeSeconds: number;
  lectureCount: number;
  lecturesCompleted: number;
}

export interface OtherCourse {
  courseId: string | number;
  courseTitle: string;
  progressPercentage: number;
  enrollmentDate: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface CourseData {
  id?: string | number;
  title?: string;
  level?: string;
  language?: string;
  totalLectures?: number;
  totalHours?: number;
}

export interface StatCardData {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  icon: any;
}

// ── Constants ─────────────────────────────────────────────────────────
export const PROGRESS_THRESHOLDS = {
  COMPLETED: 95,
  ACTIVE: 50,
} as const;

// ════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-teacher-student-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTagModule,
    NzBadgeModule,
    NzProgressModule,
    NzTabsModule,
  ],
  templateUrl: './teacher-student-analytics.html',
  styleUrls: ['./teacher-student-analytics.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherStudentAnalytics' },
  ],
})
export class TeacherStudentAnalytics implements OnInit, OnDestroy {

  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  public  config    = inject(APP_CONFIG);
  private msg       = inject(NzMessageService);
  private transloco = inject(TranslocoService);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon    = ArrowLeft;
  readonly ArrowRightIcon   = ArrowRight;
  readonly RefreshCwIcon    = RefreshCw;
  readonly MessageSquareIcon = MessageSquare;
  readonly PanelRightIcon   = PanelRight;
  readonly MailIcon         = Mail;
  readonly TrophyIcon       = Trophy;
  readonly UsersIcon        = Users;
  readonly BarChart3Icon    = BarChart3;
  readonly ClockIcon        = Clock;
  readonly VideoIcon        = Video;
  readonly TrendingUpIcon   = TrendingUp;
  readonly CheckCircleIcon  = CheckCircle;
  readonly PlayCircleIcon   = PlayCircle;
  readonly HistoryIcon      = History;
  readonly HelpCircleIcon   = HelpCircle;
  readonly BookOpenIcon     = BookOpen;
  readonly EyeIcon          = Eye;
  readonly CalendarIcon     = Calendar;
  readonly InfoIcon         = Info;
  readonly XIcon            = X;

  // ── State ──────────────────────────────────────────────────────────
  loading       = signal(true);
  networkError  = signal(false);
  analytics     = signal<AnalyticsData | null>(null);
  course        = signal<CourseData | null>(null);
  activeTabIndex = signal(0);
  sidebarOpen   = signal(false);

  // ── Route params ───────────────────────────────────────────────────
  studentId = signal('');
  courseId  = signal('');

  // ── RTL Detection ──────────────────────────────────────────────────
  /** Returns true when the active language is RTL (Arabic). */
  get isRtl(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  /** Returns the correct back-arrow icon depending on text direction. */
  get backArrowIcon() {
    return this.isRtl ? this.ArrowRightIcon : this.ArrowLeftIcon;
  }

  // ── Computed ───────────────────────────────────────────────────────
  cv = computed(() => {
    const a = this.analytics();
    if (!a) return null;

    const pct = a.overallProgress ?? 0;

    let statusColor = 'default';
    let statusText  = this.t('not_started');
    if (pct >= PROGRESS_THRESHOLDS.COMPLETED) {
      statusColor = 'success';
      statusText  = this.t('completed');
    } else if (pct >= PROGRESS_THRESHOLDS.ACTIVE) {
      statusColor = 'processing';
      statusText  = this.t('active');
    } else if (pct > 0) {
      statusColor = 'warning';
      statusText  = this.t('started');
    }

    const ws = a.totalWatchTimeSeconds ?? 0;

    return {
      pct,
      statusColor,
      statusText,
      completedLectures:  a.completedLectures ?? 0,
      totalLectures:      a.totalLectures ?? 0,
      watchDisplay:       this.formatSeconds(ws),
      hours:              Math.floor(ws / 3600),
      minutes:            Math.floor((ws % 3600) / 60),
      avgDisplay:         this.formatSeconds(Math.round(a.averageWatchTimePerLecture ?? 0)),
      enrollmentType:     a.enrollmentType ?? '—',
      enrollmentTypeColor: a.enrollmentType === 'Paid' ? 'blue' : 'green',
    };
  });

  pct = computed(() => this.cv()?.pct ?? 0);

  statCards = computed((): StatCardData[] => {
    const a  = this.analytics();
    const cv = this.cv();
    if (!a || !cv) return [];

    return [
      {
        label: this.t('lectures_completed'),
        value: `${cv.completedLectures} / ${cv.totalLectures}`,
        color: '#27ae60', bg: '#ecfdf5',
        icon: this.CheckCircleIcon,
      },
      {
        label: this.t('total_watch_time'),
        value: cv.watchDisplay,
        color: '#d97706', bg: '#fffbeb',
        icon: this.ClockIcon,
      },
      {
        label: this.t('avg_quiz_score'),
        value: `${Math.round(a.averageQuizScore ?? 0)}%`,
        color: '#0891b2', bg: '#ecfeff',
        icon: this.BarChart3Icon,
      },
      {
        label: this.t('notes_taken'),
        value: a.notesCount ?? 0,
        color: '#7c3aed', bg: '#f5f0ff',
        icon: this.BookOpenIcon,
      },
      {
        label: this.t('quiz_attempts'),
        value: a.totalQuizAttempts ?? 0,
        color: '#d97706', bg: '#fffbeb',
        icon: this.HelpCircleIcon,
      },
      {
        label: this.t('active_days'),
        value: a.watchPatterns?.length ?? 0,
        color: '#3d5af1', bg: '#eef0ff',
        icon: this.CalendarIcon,
      },
      {
        label: this.t('other_courses'),
        value: a.otherCoursesWithTeacher?.length ?? 0,
        color: '#059669', bg: '#ecfdf5',
        icon: this.BookOpenIcon,
      },
      {
        label: this.t('certificate'),
        value: a.certificateEarned ? this.t('earned') : this.t('not_earned'),
        color: a.certificateEarned ? '#d97706' : '#94a3b8',
        bg:    a.certificateEarned ? '#fffbeb' : '#f1f5f9',
        icon: this.TrophyIcon,
      },
    ];
  });

  sectionProgress  = computed(() => this.analytics()?.sectionProgress ?? []);
  quizPerformance  = computed(() => this.analytics()?.quizPerformance ?? []);
  watchPatterns    = computed(() => this.analytics()?.watchPatterns ?? []);
  otherCourses     = computed(() => this.analytics()?.otherCoursesWithTeacher ?? []);

  checklistItems = computed(() => {
    const a   = this.analytics();
    const pct = this.pct();
    return [
      { key: 'check_started',     done: pct > 0 },
      { key: 'check_half',        done: pct >= 50 },
      { key: 'check_completed',   done: pct >= PROGRESS_THRESHOLDS.COMPLETED },
      { key: 'check_quiz',        done: (a?.totalQuizAttempts ?? 0) > 0 },
      { key: 'check_certificate', done: !!a?.certificateEarned },
    ];
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const sid = params.get('studentId') ?? '';
      const cid = params.get('courseId')  ?? '';
      this.studentId.set(sid);
      this.courseId.set(cid);
      if (sid && cid) {
        this.fetchData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data ───────────────────────────────────────────────────────────
  async fetchData(): Promise<void> {
    this.loading.set(true);
    this.networkError.set(false);
    try {
      const [courseRes, analyticsRes] = await Promise.all([
        firstValueFrom(
          this.http.get<any>(`${this.config.baseUrl}/api/courses/${this.courseId()}/preview-admin-teacher`)
        ),
        firstValueFrom(
          this.http.get<any>(`${this.config.baseUrl}/api/enrollments/teacher/course/${this.courseId()}/student/${this.studentId()}/details`)
        ),
      ]);

      if (courseRes?.success) {
        this.course.set(courseRes.data);
      }
      
      if (analyticsRes?.success) {
        this.analytics.set(analyticsRes.data);
      } else {
        throw new Error(analyticsRes?.message ?? 'Failed to load analytics');
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err?.code === 'ERR_NETWORK') {
        this.networkError.set(true);
      } else {
        this.msg.error(this.t('failed_to_load_data'));
        this.router.navigate([`/teacher/courses/${this.courseId()}/students`]);
      }
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  refresh(): void {
    this.fetchData();
    this.msg.success(this.t('data_refreshed'));
  }

  // ── Navigation ─────────────────────────────────────────────────────
  navigateToStudents(): void {
    this.router.navigate([`/teacher/students`]);
  }

  navigateToChat(): void {
    this.router.navigate([`/teacher/chats/${this.studentId()}`]);
  }

  navigateToCourse(courseId: string | number): void {
    this.router.navigate([`/teacher/courses/${courseId}/builder`]);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  formatDate(d?: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  formatSeconds(s?: number | null): string {
    if (!s || s === 0) return '0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  progressColor(pct: number): string {
    if (pct >= 80) return '#27ae60';
    if (pct >= 50) return '#d97706';
    if (pct > 0)   return '#3d5af1';
    return '#dc2626';
  }

  sectionTagColor(pct: number): string {
    if (pct >= 80) return 'success';
    if (pct >= 50) return 'warning';
    if (pct > 0)   return 'processing';
    return 'default';
  }

  activityDotColor(seconds: number): string {
    if (seconds > 3600) return '#27ae60';
    if (seconds > 1800) return '#3d5af1';
    if (seconds > 0)    return '#d97706';
    return '#dde1f0';
  }

  round(val: number): number {
    return Math.round(val);
  }

  avatarLetter(name?: string | null): string {
    return (name ?? 'S').charAt(0).toUpperCase();
  }

  // ── Translation helper ─────────────────────────────────────────────
  t(key: string): string {
    const result = this.transloco.translate(`teacherStudentAnalytics.${key}`);
    return result;
  }
}