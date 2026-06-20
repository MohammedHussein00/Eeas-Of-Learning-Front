import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RXJSubject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, Trophy, Clock, Search, Eye, Check, X,
  FileText, Users, TrendingUp, AlertCircle, Star,
  CheckCircle, XCircle, HelpCircle, BarChart3
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// ── Ant Design ──────────────────────────────────────────────────────
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzRateModule } from 'ng-zorro-antd/rate';
import { NzDividerModule } from 'ng-zorro-antd/divider';

// ── Types ────────────────────────────────────────────────────────────
interface QuizInfo {
  id: string;
  title: string;
  description?: string;
  type: number | string;
  passingScore: number;
  timeLimitMinutes?: number;
}

interface AttemptRow {
  attemptId: string;
  userId: string;
  name?: string;
  userEmail?: string;
  profileImagePath?: string;
  enrollmentDate?: string;
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  startedAt: string;
  completedAt?: string;
  timeSpentSeconds: number;
  attemptNumber: number;
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  type: number | string;
  correctAnswers: string[];
  userAnswers: string[];
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  options: {
    id: string;
    questionId: string;
    optionText: string;
    isCorrect: boolean;
    order: number;
    explanation?: string;
  }[];
  explanation?: string;
}

interface AttemptDetail {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  timeSpentSeconds: number;
  startedAt: string;
  completedAt?: string;
  questionResults: QuestionResult[];
  summary?: {
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    averageTimePerQuestion: number;
  };
}

// ── Constants ───────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  MultipleChoice: 'Multiple Choice',
  MultipleCorrect: 'Multiple Correct',
  TrueFalse: 'True / False',
  FillBlank: 'Fill in Blank',
  ShortAnswer: 'Short Answer',
  Definition: 'Definition',
  Matching: 'Matching',
  Essay: 'Essay',
  LongAnswer: 'Long Answer',
};

const TYPE_COLORS: Record<string, string> = {
  MultipleChoice: 'blue',
  MultipleCorrect: 'purple',
  TrueFalse: 'green',
  FillBlank: 'orange',
  ShortAnswer: 'red',
  Definition: 'gold',
  Matching: 'magenta',
  Essay: 'cyan',
  LongAnswer: 'volcano',
};

const TYPE_MAP: Record<number, string> = {
  1: 'MultipleChoice',
  2: 'TrueFalse',
  3: 'MultipleCorrect',
  4: 'ShortAnswer',
  5: 'Essay',
  6: 'Matching',
  7: 'FillBlank',
  8: 'Definition',
  9: 'LongAnswer',
};

const QUIZ_TYPE_MAP: Record<number, string> = {
  1: 'Practice',
  2: 'Graded',
  3: 'Survey',
};

const AVATAR_PALETTE = [
  '#3d5af1', '#8b5cf6', '#0891b2', '#0d9488',
  '#059669', '#d97706', '#dc2626', '#db2777',
];

// ── Component ────────────────────────────────────────────────────────
@Component({
  selector: 'app-teacher-quiz-attempts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzProgressModule,
    NzSelectModule,
    NzInputModule,
    NzModalModule,
    NzTagModule,
    NzAvatarModule,
    NzBadgeModule,
    NzEmptyModule,
    NzResultModule,
    NzRateModule,
    NzDividerModule,
  ],
  templateUrl: './teacher-quiz-attempts.html',
  styleUrls: ['./teacher-quiz-attempts.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherQuizAttempts' },
  ],
})
export class TeacherQuizAttempts implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private config = inject(APP_CONFIG);
  private toast = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RXJSubject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon = ArrowLeft;
  readonly TrophyIcon = Trophy;
  readonly ClockIcon = Clock;
  readonly SearchIcon = Search;
  readonly EyeIcon = Eye;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly FileTextIcon = FileText;
  readonly UsersIcon = Users;
  readonly TrendingUpIcon = TrendingUp;
  readonly AlertCircleIcon = AlertCircle;
  readonly StarIcon = Star;
  readonly CheckCircleIcon = CheckCircle;
  readonly XCircleIcon = XCircle;
  readonly HelpCircleIcon = HelpCircle;
  readonly BarChartIcon = BarChart3;
  readonly Math = Math;

  // ── State ──────────────────────────────────────────────────────────
  loading = signal(true);
  quiz = signal<QuizInfo | null>(null);
  attempts = signal<AttemptRow[]>([]);
  filtered = signal<AttemptRow[]>([]);

  search = signal('');
  filter = signal<'all' | 'passed' | 'failed'>('all');
  sortBy = signal<'date' | 'score_desc' | 'score_asc' | 'name'>('date');

  detailModalVisible = signal(false);
  detailModalLoading = signal(false);
  detailData = signal<AttemptDetail | null>(null);

  // ── Computed ───────────────────────────────────────────────────────
  get quizId(): string | null {
    return this.route.snapshot.paramMap.get('id');
  }

  stats = computed(() => {
    const all = this.attempts();
    const passed = all.filter(a => a.isPassed).length;
    return {
      total: all.length,
      passed,
      failed: all.length - passed,
      avgScore: all.length ? all.reduce((s, a) => s + a.percentage, 0) / all.length : 0,
      passRate: all.length ? Math.round((passed / all.length) * 100) : 0,
    };
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.quizId) {
      this.fetchData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── i18n ───────────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`teacherQuizAttempts.${key}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  getTypeStr(type: number | string): string {
    if (typeof type === 'string') return type;
    return TYPE_MAP[type as number] || 'MultipleChoice';
  }

  getTypeLabel(type: number | string): string {
    return TYPE_LABELS[this.getTypeStr(type)] || String(type);
  }

  getTypeColor(type: number | string): string {
    return TYPE_COLORS[this.getTypeStr(type)] || 'default';
  }

  getQuizTypeLabel(type: number | string): string {
    if (typeof type === 'string') return type;
    return QUIZ_TYPE_MAP[type as number] || 'Graded';
  }

  fmtTime(secs: number): string {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  fmtDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  fmtDateTime(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  initials(name?: string, email?: string): string {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
  }

  avatarColor(str: string): string {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = str.charCodeAt(i) + ((h << 5) - h);
    }
    return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
  }

  avatarUrl(path?: string): string | undefined {
    if (!path) return undefined;
    return path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
  }

  // ── Filtering ──────────────────────────────────────────────────────
  applyFilters(): void {
    let f = [...this.attempts()];

    if (this.filter() === 'passed') {
      f = f.filter(a => a.isPassed);
    } else if (this.filter() === 'failed') {
      f = f.filter(a => !a.isPassed);
    }

    const s = this.search().toLowerCase();
    if (s) {
      f = f.filter(a =>
        (a.name || '').toLowerCase().includes(s) ||
        (a.userEmail || '').toLowerCase().includes(s)
      );
    }

    const sort = this.sortBy();
    if (sort === 'score_desc') {
      f.sort((a, b) => b.percentage - a.percentage);
    } else if (sort === 'score_asc') {
      f.sort((a, b) => a.percentage - b.percentage);
    } else if (sort === 'date') {
      f.sort((a, b) =>
        new Date(b.completedAt || b.startedAt).getTime() -
        new Date(a.completedAt || a.startedAt).getTime()
      );
    } else if (sort === 'name') {
      f.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    this.filtered.set(f);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.applyFilters();
  }

  onFilterChange(value: 'all' | 'passed' | 'failed'): void {
    this.filter.set(value);
    this.applyFilters();
  }

  onSortChange(value: 'date' | 'score_desc' | 'score_asc' | 'name'): void {
    this.sortBy.set(value);
    this.applyFilters();
  }

  // ── Data Fetching ───────────────────────────────────────────────────
  private async fetchData(): Promise<void> {
    this.loading.set(true);
    try {
      const [qr, ar] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}`)),
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}/all-attempts`)),
      ]);

      if (qr?.success) this.quiz.set(qr.data);
      if (ar?.success) {
        this.attempts.set(ar.data || []);
        this.applyFilters();
      }
    } catch (err: any) {
      console.error('[QuizAttempts] Fetch error:', err);
      this.toast.error(this.t('load_error'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Detail Modal ────────────────────────────────────────────────────
  async openDetail(row: AttemptRow): Promise<void> {
    this.detailModalVisible.set(true);
    this.detailModalLoading.set(true);
    this.detailData.set(null);

    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/quizzes/result/${row.attemptId}`)
      );
      if (res?.success) {
        this.detailData.set(res.data);
      } else {
        this.detailModalVisible.set(false);
      }
    } catch (err: any) {
      console.error('[QuizAttempts] Detail fetch error:', err);
      this.detailModalVisible.set(false);
      this.toast.error(this.t('detail_load_error'));
    } finally {
      this.detailModalLoading.set(false);
    }
  }

  closeDetail(): void {
    this.detailModalVisible.set(false);
    this.detailData.set(null);
  }

  // ── Question Result Helpers ────────────────────────────────────────
  isManualGrade(type: number | string): boolean {
    const ts = this.getTypeStr(type);
    return ['Essay', 'LongAnswer'].includes(ts);
  }

  isPartial(qr: QuestionResult): boolean {
    return !qr.isCorrect && qr.pointsEarned > 0;
  }

  getQuestionBlockClass(qr: QuestionResult): string {
    if (this.isManualGrade(qr.type) && qr.pointsEarned === 0 && !qr.isCorrect) return '';
    if (qr.isCorrect) return 'correct';
    if (this.isPartial(qr)) return 'partial';
    return 'wrong';
  }

  parseMatchingAnswers(answers: string[]): { colA: string[]; colB: string[]; map: Record<string, number> } | null {
    if (!answers.length) return null;
    try {
      const p = JSON.parse(answers[0]);
      if (p && p.colA && p.colB && p.map) return p;
    } catch (_) { /* ignore */ }
    return null;
  }

  buildUserMatchingMap(userAnswers: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    userAnswers.forEach(a => {
      if (a.includes('::')) {
        const [l, r] = a.split('::', 2);
        map[l.trim()] = r.trim();
      }
    });
    return map;
  }
}