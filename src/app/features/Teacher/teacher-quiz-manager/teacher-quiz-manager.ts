import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RXJSubject } from 'rxjs';
import { CdkDragDrop, moveItemInArray, CdkDropList, CdkDrag } from '@angular/cdk/drag-drop';

import {
  LucideAngularModule,
  ArrowLeft, Plus, Edit2, Trash2, Eye, HelpCircle,
  CheckCircle, X, BarChart2, Info, Settings, AppWindow,
  Link, PlayCircle, BookOpen, Trophy, Image as ImageIcon,
  FileText, Check, AlertTriangle, GripVertical, Users,
  Clock, Layers, Star, ChevronDown, ChevronUp, Upload as UploadIcon,
  RefreshCw, Search
} from 'lucide-angular';

import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

import { NzSpinModule }       from 'ng-zorro-antd/spin';
import { NzSelectModule }     from 'ng-zorro-antd/select';
import { NzInputModule }      from 'ng-zorro-antd/input';
import { NzInputNumberModule }from 'ng-zorro-antd/input-number';
import { NzSwitchModule }     from 'ng-zorro-antd/switch';
import { NzUploadModule }     from 'ng-zorro-antd/upload';
import { NzModalModule }      from 'ng-zorro-antd/modal';
import { NzTagModule }        from 'ng-zorro-antd/tag';
import { NzTooltipModule }    from 'ng-zorro-antd/tooltip';
import { NzAlertModule }      from 'ng-zorro-antd/alert';
import { NzTabsModule }       from 'ng-zorro-antd/tabs';
import { NzBadgeModule }      from 'ng-zorro-antd/badge';
import { NzResultModule }     from 'ng-zorro-antd/result';
import { NzEmptyModule }      from 'ng-zorro-antd/empty';
import { NzListModule }       from 'ng-zorro-antd/list';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzUploadFile }       from 'ng-zorro-antd/upload';

// ── Types ──────────────────────────────────────────────────────────────
interface Quiz {
  id: string;
  title: string;
  description?: string;
  type: number | string;
  passingScore: number;
  timeLimitMinutes?: number;
  isTimeLimitMinutes?: boolean;
  courseId?: string;
  sectionId?: string;
  lectureId?: string;
}

interface QuestionOption {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  explanation?: string;
  order: number;
}

interface Question {
  id: string;
  questionText: string;
  type: number | string;
  points: number;
  order: number;
  imagePath?: string;
  options?: QuestionOption[];
  correctAnswers?: string | string[];
  allowImageAnswer?: boolean;
}

interface QuizContext {
  type: 'course' | 'section' | 'lecture' | 'unknown';
  label: string;
  icon: any;
  cls: string;
}

interface MatchingItem { id: string; text: string; }

interface QuestionStats {
  total: number;
  totalPts: number;
  autoCount: number;
  manualCount: number;
}

interface QuestionTypeConfig {
  label: string;
  color: string;
  autoScore: boolean;
}

interface MatchingPreviewData {
  colA: string[];
  colB: string[];
  map: Record<number, number>;
}

// ── Constants ──────────────────────────────────────────────────────────
const QUESTION_TYPES: Record<string, QuestionTypeConfig> = {
  MultipleChoice:  { label: 'Multiple Choice',  color: 'blue',    autoScore: true  },
  MultipleCorrect: { label: 'Multiple Correct', color: 'purple',  autoScore: true  },
  TrueFalse:       { label: 'True / False',     color: 'green',   autoScore: true  },
  FillBlank:       { label: 'Fill in Blank',    color: 'orange',  autoScore: true  },
  ShortAnswer:     { label: 'Short Answer',     color: 'red',     autoScore: true  },
  Definition:      { label: 'Definition',       color: 'gold',    autoScore: true  },
  Matching:        { label: 'Matching',         color: 'magenta', autoScore: true  },
  Essay:           { label: 'Essay',            color: 'cyan',    autoScore: false },
  LongAnswer:      { label: 'Long Answer',      color: 'volcano', autoScore: false },
};

const TYPE_MAP: Record<number, string> = {
  1: 'MultipleChoice', 2: 'TrueFalse', 3: 'MultipleCorrect',
  4: 'ShortAnswer',    5: 'Essay',     6: 'Matching',
  7: 'FillBlank',      8: 'Definition',9: 'LongAnswer',
};

const QUIZ_TYPE_MAP: Record<number, string> = { 1: 'Practice', 2: 'Graded', 3: 'Survey' };

// ── Module-level helpers ───────────────────────────────────────────────
const getTypeStr = (type: number | string): string =>
  typeof type === 'string' ? type : (TYPE_MAP[type] || 'MultipleChoice');

const getQuizTypeLabel = (type: number | string): string =>
  typeof type === 'string' ? type : (QUIZ_TYPE_MAP[type] || 'Graded');

const parseAnswers = (raw: string | string[] | undefined): string[] => {
  if (!raw || !Array.isArray(raw) || !raw.length) return [];
  if (raw.length === 1 && typeof raw[0] === 'string') {
    const f = raw[0].trim();
    if (f.startsWith('[')) {
      try { const p = JSON.parse(f); if (Array.isArray(p)) return p; } catch (_) {}
    }
  }
  return raw as string[];
};

const genId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Parses an API error response (field-level validation map or flat message)
 * into a single human-readable string.
 */
function parseApiError(err: any): string {
  if (!err) return '';
  const body = err?.error ?? err;
  if (body?.errors && typeof body.errors === 'object') {
    const msgs: string[] = [];
    for (const [field, errs] of Object.entries(body.errors as Record<string, string[]>)) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      (errs as string[]).forEach(m => msgs.push(`${label}: ${m}`));
    }
    if (msgs.length) return msgs.join('\n');
  }
  const msg: string = body?.message || err?.message || '';
  if (msg && !msg.startsWith('[')) return msg;
  if (err?.status === 400) return 'Invalid request. Please check your input.';
  if (err?.status === 401) return 'Unauthorized. Please log in again.';
  if (err?.status === 403) return 'You do not have permission to perform this action.';
  if (err?.status === 404) return 'The requested resource was not found.';
  if (err?.status === 500) return 'A server error occurred. Please try again later.';
  return 'An unexpected error occurred. Please try again.';
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-teacher-quiz-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslocoModule,
    LucideAngularModule, CdkDropList, CdkDrag,
    NzSpinModule, NzSelectModule, NzInputModule, NzInputNumberModule,
    NzSwitchModule, NzUploadModule, NzModalModule, NzTagModule,
    NzTooltipModule, NzAlertModule, NzTabsModule, NzBadgeModule,
    NzResultModule, NzEmptyModule, NzListModule, NzPopconfirmModule,
  ],
  templateUrl: './teacher-quiz-manager.html',
  styleUrls: ['./teacher-quiz-manager.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'teacherQuizManager' }],
})
export class TeacherQuizManager implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  protected config  = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private fb        = inject(FormBuilder);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new RXJSubject<void>();

  // ── Expose helpers to template ─────────────────────────────────────
  protected readonly QUESTION_TYPES   = QUESTION_TYPES;
  protected readonly objectEntries    = Object.entries;
  protected readonly objectKeys       = Object.keys;
  protected readonly getTypeStr       = getTypeStr;
  protected readonly getQuizTypeLabel = getQuizTypeLabel;
  protected readonly parseAnswers     = parseAnswers;

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon     = ArrowLeft;
  readonly PlusIcon          = Plus;
  readonly EditIcon          = Edit2;
  readonly TrashIcon         = Trash2;
  readonly EyeIcon           = Eye;
  readonly HelpCircleIcon    = HelpCircle;
  readonly CheckCircleIcon   = CheckCircle;
  readonly XIcon             = X;
  readonly BarChartIcon      = BarChart2;
  readonly InfoIcon          = Info;
  readonly SettingsIcon      = Settings;
  readonly AppWindowIcon     = AppWindow;
  readonly LinkIcon          = Link;
  readonly PlayCircleIcon    = PlayCircle;
  readonly BookOpenIcon      = BookOpen;
  readonly TrophyIcon        = Trophy;
  readonly ImageIcon         = ImageIcon;
  readonly FileTextIcon      = FileText;
  readonly CheckIcon         = Check;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly GripVerticalIcon  = GripVertical;
  readonly UsersIcon         = Users;
  readonly ClockIcon         = Clock;
  readonly LayersIcon        = Layers;
  readonly StarIcon          = Star;
  readonly ChevronDownIcon   = ChevronDown;
  readonly ChevronUpIcon     = ChevronUp;
  readonly UploadIcon        = UploadIcon;
  readonly RefreshCwIcon     = RefreshCw;
  readonly SearchIcon        = Search;

  // ── Core state ─────────────────────────────────────────────────────
  loading    = signal(true);
  quiz       = signal<Quiz | null>(null);
  questions  = signal<Question[]>([]);
  filtered   = signal<Question[]>([]);
  typeFilter = signal<string>('all');
  searchText = signal<string>('');
  activeTab  = signal<string>('questions');

  // ── Modal state ────────────────────────────────────────────────────
  qModalVisible        = signal(false);
  qModalMode           = signal<'add' | 'edit'>('add');
  qModalLoading        = signal(false);
  editingQuestion      = signal<Question | null>(null);

  prevModalVisible     = signal(false);
  previewQuestion      = signal<Question | null>(null);

  editQuizModalVisible = signal(false);
  editQuizModalLoading = signal(false);

  deleteModalVisible   = signal(false);
  deleteModalLoading   = signal(false);
  deleteModalTitle     = signal('');
  deleteModalMessage   = signal('');
  private deleteAction: (() => Promise<void>) | null = null;

  // ── Question form state ────────────────────────────────────────────
  questionForm!: FormGroup;
  editQuizForm!: FormGroup;

  qType            = signal<string>('MultipleChoice');
  options          = signal<QuestionOption[]>([]);
  tfAnswer         = signal<string>('');
  singleAnswer     = signal<string>('');
  defAnswer        = signal<string>('');
  writtenRubric    = signal<string>('');
  imageFile        = signal<File | null>(null);
  imagePreview     = signal<string | null>(null);
  removeImage      = signal(false);
  fillSentence     = signal<string>('');
  blankIndex       = signal<number | null>(null);
  blankIndices     = signal<number[]>([]);
  allowImageAnswer = signal<boolean>(false);
  isRtl            = signal<boolean>(false);
  matchColA        = signal<MatchingItem[]>([]);
  matchColB        = signal<MatchingItem[]>([]);
  matchAnswerMap   = signal<Record<string, string>>({});
  newA             = signal('');
  newB             = signal('');
  newOptionText    = signal('');
  newOptionExpl    = signal('');

  // ── Computed ───────────────────────────────────────────────────────
  get quizId(): string | null {
    return this.route.snapshot.paramMap.get('id');
  }

  stats = computed((): QuestionStats | null => {
    const qs = this.questions();
    if (!qs.length) return null;
    return {
      total:       qs.length,
      totalPts:    qs.reduce((s, q) => s + q.points, 0),
      autoCount:   qs.filter(q =>  QUESTION_TYPES[getTypeStr(q.type)]?.autoScore).length,
      manualCount: qs.filter(q => !QUESTION_TYPES[getTypeStr(q.type)]?.autoScore).length,
    };
  });

  typeDistribution = computed((): Record<string, number> => {
    const dist: Record<string, number> = {};
    for (const q of this.questions()) {
      const ts = getTypeStr(q.type);
      dist[ts] = (dist[ts] || 0) + 1;
    }
    return dist;
  });

  mappedCount = computed(() =>
    this.matchColA().filter(a => !!this.matchAnswerMap()[a.id]).length
  );

  quizContext = computed((): QuizContext | null => {
    const q = this.quiz();
    if (!q) return null;
    if (q.courseId && !q.lectureId && !q.sectionId)
      return { type: 'course',  label: this.t('course_exam'),  icon: this.TrophyIcon,     cls: 'course'  };
    if (q.sectionId)
      return { type: 'section', label: this.t('section_quiz'), icon: this.AppWindowIcon,  cls: 'section' };
    if (q.lectureId)
      return { type: 'lecture', label: this.t('lecture_quiz'), icon: this.PlayCircleIcon, cls: 'lecture' };
    return   { type: 'unknown', label: 'Quiz',                 icon: this.HelpCircleIcon, cls: 'lecture' };
  });

  // ── Template helpers ───────────────────────────────────────────────
  getTypeConfig(type: number | string): QuestionTypeConfig | undefined {
    return QUESTION_TYPES[getTypeStr(type)];
  }

  protected charFromIndex(idx: number): string { return String.fromCharCode(65 + idx); }

  protected renderQuestionPreview(q: Question): string {
    const ts = getTypeStr(q.type);
    if (['MultipleChoice', 'MultipleCorrect'].includes(ts))
      return (q.options || []).map(o => `${o.isCorrect ? '✓' : '✗'} ${o.optionText}`).join('  ·  ');
    if (ts === 'TrueFalse') {
      const co = (q.options || []).find(o => o.isCorrect);
      return co ? `Answer: ${co.optionText}` : '';
    }
    return parseAnswers(q.correctAnswers)[0] || '';
  }

  protected getMatchingPreviewData(q: Question): MatchingPreviewData {
    const answers = parseAnswers(q.correctAnswers);
    if (answers[0]) {
      try {
        const parsed = JSON.parse(answers[0]);
        if (parsed?.colA && parsed?.colB && parsed?.map)
          return { colA: parsed.colA, colB: parsed.colB, map: parsed.map };
      } catch (_) {}
    }
    return { colA: [], colB: [], map: {} };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForms();
    if (this.quizId) this.fetchData();
    // Detect RTL language
    const rtlLangs = ['ar', 'he', 'fa', 'ur'];
    this.isRtl.set(rtlLangs.includes(this.transloco.getActiveLang()));
    this.transloco.langChanges$.subscribe(lang => {
      this.isRtl.set(rtlLangs.includes(lang));
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── i18n ───────────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`teacherQuizManager.${key}`);
  }

  // ── Forms ──────────────────────────────────────────────────────────
  private buildForms(): void {
    this.questionForm = this.fb.group({
      // FillBlank bypasses questionText validation — set '' as default and we control validity manually
      questionText: [''],
      type:   ['MultipleChoice', Validators.required],
      points: [1,  [Validators.required, Validators.min(0.5), Validators.max(100)]],
      order:  [1,  [Validators.required, Validators.min(1),   Validators.max(999)]],
    });

    this.editQuizForm = this.fb.group({
      title:              ['', Validators.required],
      description:        [''],
      type:               ['Graded', Validators.required],
      passingScore:       [70,   [Validators.required, Validators.min(0), Validators.max(100)]],
      timeLimitMinutes:   [null, [Validators.min(1), Validators.max(480)]],
      isTimeLimitMinutes: [false],
    });
  }

  // ── Data Fetching ──────────────────────────────────────────────────
  private async fetchData(): Promise<void> {
    try {
      this.loading.set(true);
      const [qr, qsr] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}`)),
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}/questions`)),
      ]);
      if (qr?.success) {
        this.quiz.set(qr.data);
      } else {
        throw new Error(qr?.message || this.t('load_error'));
      }
      this.questions.set(qsr?.success ? (qsr.data || []) : []);
      this.applyFilters();
    } catch (err: any) {
      this.toast.error(parseApiError(err) || this.t('load_error'));
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────
  applyFilters(): void {
    let f  = [...this.questions()];
    const tf = this.typeFilter();
    const st = this.searchText().toLowerCase();
    if (tf !== 'all') f = f.filter(q => getTypeStr(q.type) === tf);
    if (st)           f = f.filter(q => q.questionText.toLowerCase().includes(st));
    this.filtered.set(f);
  }

  onTypeFilterChange(val: string): void { this.typeFilter.set(val); this.applyFilters(); }
  onSearchChange(val: string): void     { this.searchText.set(val); this.applyFilters(); }
  onSearchInput(event: Event): void     { this.onSearchChange((event.target as HTMLInputElement).value); }
  onTabChange(index: number): void      { this.activeTab.set(index === 0 ? 'questions' : 'stats'); }

  // ── Drag & Drop ────────────────────────────────────────────────────
  async onDragDrop(event: CdkDragDrop<Question[]>): Promise<void> {
    const qs = [...this.questions()];
    moveItemInArray(qs, event.previousIndex, event.currentIndex);
    const reordered = qs.map((q, i) => ({ ...q, order: i + 1 }));
    this.questions.set(reordered);
    this.applyFilters();
    try {
      await firstValueFrom(
        this.http.put<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}/reorder`, reordered.map(q => q.id))
      );
      this.toast.success(this.t('reordered'));
    } catch {
      this.toast.error(this.t('reorder_failed'));
      this.fetchData();
    }
  }

  // ── State Reset ────────────────────────────────────────────────────
  resetQuestionState(): void {
    this.options.set([]);
    this.tfAnswer.set('');
    this.singleAnswer.set('');
    this.defAnswer.set('');
    this.writtenRubric.set('');
    this.fillSentence.set('');
    this.blankIndex.set(null);
    this.blankIndices.set([]);
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.removeImage.set(false);
    this.matchColA.set([]);
    this.matchColB.set([]);
    this.matchAnswerMap.set({});
    this.allowImageAnswer.set(false);
    this.newA.set('');
    this.newB.set('');
    this.newOptionText.set('');
    this.newOptionExpl.set('');
  }

  // ── Question Modal ─────────────────────────────────────────────────
  openAddQuestion(): void {
    this.resetQuestionState();
    this.questionForm.reset();
    const nextOrder = this.questions().length
      ? Math.max(...this.questions().map(q => q.order)) + 1
      : 1;
    this.questionForm.patchValue({ type: 'MultipleChoice', points: 1, order: nextOrder });
    this.qType.set('MultipleChoice');
    this.qModalMode.set('add');
    this.editingQuestion.set(null);
    this.qModalVisible.set(true);
  }

  openEditQuestion(q: Question): void {
    this.resetQuestionState();
    const ts      = getTypeStr(q.type);
    const answers = parseAnswers(q.correctAnswers);
    this.qType.set(ts);
    this.questionForm.patchValue({ questionText: q.questionText, type: ts, points: q.points, order: q.order });

    if (['MultipleChoice', 'MultipleCorrect'].includes(ts)) {
      this.options.set((q.options || []).map(o => ({
        id: o.id || genId(), optionText: o.optionText || '',
        isCorrect: o.isCorrect || false, explanation: o.explanation || '', order: o.order || 1,
      })));
    } else if (ts === 'TrueFalse') {
      const co = (q.options || []).find(o => o.isCorrect);
      this.tfAnswer.set(co?.optionText || answers[0] || '');
    } else if (ts === 'FillBlank') {
      // Reconstruct original sentence (replace _____ with actual words from answers)
      let sentence = q.questionText || '';
      const blanksAnswers = answers;
      // Try to find blank positions
      const words = sentence.split(/\s+/);
      const indices: number[] = [];
      let answerIdx = 0;
      const restored = words.map((w, i) => {
        if (w === '_____' && answerIdx < blanksAnswers.length) {
          const original = blanksAnswers[answerIdx++];
          indices.push(i);
          return original;
        }
        return w;
      });
      this.fillSentence.set(restored.join(' '));
      this.blankIndices.set(indices);
      this.blankIndex.set(indices[0] ?? null);
      this.singleAnswer.set(answers[0] || '');
    } else if (ts === 'ShortAnswer') {
      this.singleAnswer.set(answers[0] || '');
    } else if (ts === 'Matching') {
      const parsed = this.parseMatchingFromQuestion(q);
      this.matchColA.set(parsed.colA);
      this.matchColB.set(parsed.colB);
      this.matchAnswerMap.set(parsed.answerMap);
    } else if (ts === 'Definition') {
      this.defAnswer.set(answers[0] || '');
    } else if (['Essay', 'LongAnswer'].includes(ts)) {
      this.writtenRubric.set(answers[0] || '');
      this.allowImageAnswer.set(q.allowImageAnswer || false);
    }

    if (q.imagePath) this.imagePreview.set(`${this.config.baseUrl}${q.imagePath}`);
    this.qModalMode.set('edit');
    this.editingQuestion.set(q);
    this.qModalVisible.set(true);
  }

  openEditFromPreview(): void {
    this.prevModalVisible.set(false);
    const q = this.previewQuestion();
    if (q) this.openEditQuestion(q);
  }

  private parseMatchingFromQuestion(q: Question): {
    colA: MatchingItem[]; colB: MatchingItem[]; answerMap: Record<string, string>;
  } {
    const answers = parseAnswers(q.correctAnswers);
    if (answers[0]) {
      try {
        const parsed = JSON.parse(answers[0]);
        if (parsed?.colA && parsed?.colB && parsed?.map) {
          const colA = parsed.colA.map((text: string, i: number) => ({ id: `a-${i}`, text }));
          const colB = parsed.colB.map((text: string, i: number) => ({ id: `b-${i}`, text }));
          const answerMap: Record<string, string> = {};
          Object.entries(parsed.map as Record<string, number>).forEach(([aIdx, bIdx]) => {
            if (colA[Number(aIdx)] && colB[Number(bIdx)])
              answerMap[colA[Number(aIdx)].id] = colB[Number(bIdx)].id;
          });
          return { colA, colB, answerMap };
        }
      } catch (_) {}
    }
    if (q.options?.length) {
      const colA: MatchingItem[] = [];
      const colB: MatchingItem[] = [];
      const answerMap: Record<string, string> = {};
      q.options.forEach((opt, i) => {
        const aId = `a-${i}`;
        const bId = `b-${i}`;
        colA.push({ id: aId, text: opt.optionText || '' });
        colB.push({ id: bId, text: opt.explanation || '' });
        answerMap[aId] = bId;
      });
      return { colA, colB, answerMap };
    }
    return { colA: [], colB: [], answerMap: {} };
  }

  onQuestionTypeChange(val: string): void {
    this.qType.set(val);
    this.resetQuestionState();
    // Clear questionText when switching to/from FillBlank
    this.questionForm.patchValue({ questionText: '' });
  }

  // ── Validation ─────────────────────────────────────────────────────
  validateQuestion(): boolean {
    const type = this.qType();

    // questionText required for all non-FillBlank types
    if (type !== 'FillBlank') {
      const qt = (this.questionForm.value.questionText || '').trim();
      if (!qt) {
        this.questionForm.get('questionText')?.markAsTouched();
        this.toast.error(this.t('enter_question_text'));
        return false;
      }
    }

    if (type === 'MultipleChoice') {
      const opts = this.options();
      if (opts.length < 2) { this.toast.error(this.t('mc_min_2_options')); return false; }
      if (opts.length > 6) { this.toast.error(this.t('mc_max_6_options')); return false; }
      if (opts.some(o => !o.optionText.trim())) { this.toast.error(this.t('option_text_required')); return false; }
      const correctCount = opts.filter(o => o.isCorrect).length;
      if (correctCount === 0) { this.toast.error(this.t('mc_must_have_correct')); return false; }
      if (correctCount > 1)   { this.toast.error(this.t('mc_only_one_correct'));  return false; }
    }

    else if (type === 'MultipleCorrect') {
      const opts = this.options();
      if (opts.length < 3) { this.toast.error(this.t('mcorrect_min_3_options')); return false; }
      if (opts.length > 6) { this.toast.error(this.t('mc_max_6_options')); return false; }
      if (opts.some(o => !o.optionText.trim())) { this.toast.error(this.t('option_text_required')); return false; }
      const correctCount = opts.filter(o => o.isCorrect).length;
      if (correctCount < 1)           { this.toast.error(this.t('mark_at_least_one_correct')); return false; }
      if (correctCount === opts.length){ this.toast.error(this.t('not_all_options_correct'));   return false; }
    }

    else if (type === 'TrueFalse') {
      if (!this.tfAnswer()) { this.toast.error(this.t('select_true_or_false')); return false; }
    }

    else if (type === 'FillBlank') {
      if (!this.fillSentence().trim()) { this.toast.error(this.t('enter_sentence')); return false; }
      if (this.sentenceWords.length < 2) { this.toast.error(this.t('sentence_min_2_words')); return false; }
      if (this.blankIndices().length === 0) { this.toast.error(this.t('click_word_for_blank')); return false; }
      if (this.blankIndices().length > 4) { this.toast.error(this.t('fill_blank_max_4')); return false; }
    }

    else if (type === 'ShortAnswer') {
      if (!this.singleAnswer().trim()) { this.toast.error(this.t('enter_correct_answer')); return false; }
    }

    else if (type === 'Definition') {
      if (!this.defAnswer().trim())            { this.toast.error(this.t('enter_definition'));   return false; }
      if (this.defAnswer().trim().length > 50) { this.toast.error(this.t('definition_max_50')); return false; }
    }

    else if (type === 'Matching') {
      if (this.matchColA().length < 2) { this.toast.error(this.t('matching_min_2_pairs')); return false; }
      if (this.matchColB().length < 2) { this.toast.error(this.t('matching_min_2_pairs')); return false; }
      if (this.matchColA().some(a => !a.text.trim())) { this.toast.error(this.t('column_a_text_required')); return false; }
      if (this.matchColB().some(b => !b.text.trim())) { this.toast.error(this.t('column_b_text_required')); return false; }
      const unmapped = this.matchColA().filter(a => !this.matchAnswerMap()[a.id]);
      if (unmapped.length) { this.toast.error(this.t('map_all_items').replace('{0}', String(unmapped.length))); return false; }
    }

    return true;
  }

  // ── Build Payload ──────────────────────────────────────────────────
  private buildMatchingPayload(fd: FormData): void {
    const aTexts   = this.matchColA().map(a => a.text);
    const bTexts   = this.matchColB().map(b => b.text);
    const indexMap: Record<string, number> = {};
    this.matchColA().forEach((aItem, aIdx) => {
      const bId  = this.matchAnswerMap()[aItem.id];
      const bIdx = this.matchColB().findIndex(b => b.id === bId);
      if (bIdx >= 0) indexMap[aIdx] = bIdx;
    });
    fd.append('CorrectAnswers[0]', JSON.stringify({ colA: aTexts, colB: bTexts, map: indexMap }));
    this.matchColA().forEach((aItem, i) => {
      const bId   = this.matchAnswerMap()[aItem.id];
      const bItem = this.matchColB().find(b => b.id === bId);
      fd.append(`Options[${i}].OptionText`, aItem.text);
      fd.append(`Options[${i}].Explanation`, bItem?.text || '');
      fd.append(`Options[${i}].IsCorrect`, 'true');
      fd.append(`Options[${i}].Order`, String(i + 1));
    });
  }

  private buildFormData(): FormData {
    const fd     = new FormData();
    const values = this.questionForm.value;
    const type   = this.qType();

    // FillBlank: build display text with _____ and record the blank words
    if (type === 'FillBlank' && this.fillSentence() && this.blankIndices().length > 0) {
      const words     = this.fillSentence().split(/\s+/).filter(Boolean);
      const sortedIdx = [...this.blankIndices()].sort((a, b) => a - b);
      const display   = words.map((w, i) => sortedIdx.includes(i) ? '_____' : w).join(' ');
      fd.append('QuestionText', display);
      sortedIdx.forEach((bi, i) => {
        fd.append(`CorrectAnswers[${i}]`, words[bi]);
      });
    } else {
      fd.append('QuestionText', (values.questionText || '').trim());
    }

    // ── FIX: API requires QuizId in FormData body ──────────────────
    if (this.quizId) fd.append('QuizId', this.quizId);

    fd.append('Type',   type);
    fd.append('Points', String(values.points));
    fd.append('Order',  String(values.order));

    if (['MultipleChoice', 'MultipleCorrect'].includes(type)) {
      this.options().forEach((o, i) => {
        if (o.id && !String(o.id).includes('-')) fd.append(`Options[${i}].Id`, String(o.id));
        fd.append(`Options[${i}].OptionText`, o.optionText);
        fd.append(`Options[${i}].IsCorrect`,  String(o.isCorrect));
        fd.append(`Options[${i}].Order`,      String(o.order || i + 1));
        if (o.explanation) fd.append(`Options[${i}].Explanation`, o.explanation);
      });
    } else if (type === 'TrueFalse') {
      fd.append('CorrectAnswers[0]', this.tfAnswer());
      fd.append('Options[0].OptionText', 'True');
      fd.append('Options[0].IsCorrect',  String(this.tfAnswer() === 'True'));
      fd.append('Options[0].Order',      '1');
      fd.append('Options[1].OptionText', 'False');
      fd.append('Options[1].IsCorrect',  String(this.tfAnswer() === 'False'));
      fd.append('Options[1].Order',      '2');
    } else if (type === 'ShortAnswer') {
      fd.append('CorrectAnswers[0]', this.singleAnswer().trim());
    } else if (type === 'Matching') {
      this.buildMatchingPayload(fd);
    } else if (type === 'Definition') {
      if (this.defAnswer().trim()) fd.append('CorrectAnswers[0]', this.defAnswer().trim());
    } else if (['Essay', 'LongAnswer'].includes(type)) {
      if (this.writtenRubric().trim()) fd.append('CorrectAnswers[0]', this.writtenRubric().trim());
      fd.append('AllowImageAnswer', String(this.allowImageAnswer()));
    }

    const img = this.imageFile();
    if (img) fd.append('Image', img);
    if (this.qModalMode() === 'edit' && this.removeImage() && !img) fd.append('RemoveImage', 'true');
    return fd;
  }

  // ── Submit Question ────────────────────────────────────────────────
  async submitQuestion(): Promise<void> {
    // For FillBlank: skip reactive form questionText validation
    if (this.qType() !== 'FillBlank') {
      if (this.questionForm.get('points')?.invalid || this.questionForm.get('order')?.invalid) {
        this.questionForm.markAllAsTouched();
        return;
      }
    } else {
      if (this.questionForm.get('points')?.invalid || this.questionForm.get('order')?.invalid) {
        this.questionForm.markAllAsTouched();
        return;
      }
    }
    if (!this.validateQuestion()) return;

    this.qModalLoading.set(true);
    try {
      const fd  = this.buildFormData();
      const url = this.qModalMode() === 'edit' && this.editingQuestion()
        ? `${this.config.baseUrl}/api/quizzes/questions/${this.editingQuestion()!.id}`
        : `${this.config.baseUrl}/api/quizzes/${this.quizId}/questions`;
      const res = await firstValueFrom(
        this.qModalMode() === 'edit'
          ? this.http.put<any>(url, fd)
          : this.http.post<any>(url, fd)
      );
      if (res?.success) {
        this.toast.success(this.qModalMode() === 'edit' ? this.t('update_success') : this.t('create_success'));
        this.qModalVisible.set(false);
        this.resetQuestionState();
        this.questionForm.reset();
        await this.fetchData();
      } else {
        throw new Error(res?.message || this.t('save_error'));
      }
    } catch (err: any) {
      this.toast.error(parseApiError(err) || this.t('save_error'));
    } finally {
      this.qModalLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Delete Question ────────────────────────────────────────────────
  async deleteQuestion(q: Question): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.delete<any>(`${this.config.baseUrl}/api/quizzes/questions/${q.id}`)
      );
      if (res?.success) {
        this.toast.success(this.t('question_deleted'));
        this.questions.update(prev => prev.filter(x => x.id !== q.id));
        this.applyFilters();
      } else {
        this.toast.error(parseApiError(res) || this.t('delete_error'));
      }
    } catch (err: any) {
      if (err?.status === 404) {
        this.questions.update(prev => prev.filter(x => x.id !== q.id));
        this.applyFilters();
      } else {
        this.toast.error(parseApiError(err) || this.t('delete_error'));
      }
    }
  }

  confirmDeleteQuestion(q: Question): void {
    this.deleteModalTitle.set(this.t('delete_question'));
    this.deleteModalMessage.set(this.t('delete_question_confirm'));
    this.deleteAction = async () => { await this.deleteQuestion(q); };
    this.deleteModalVisible.set(true);
  }

  async executeDelete(): Promise<void> {
    if (!this.deleteAction) return;
    this.deleteModalLoading.set(true);
    try {
      await this.deleteAction();
      this.deleteModalVisible.set(false);
    } catch (err: any) {
      this.toast.error(parseApiError(err) || this.t('delete_error'));
    } finally {
      this.deleteModalLoading.set(false);
      this.deleteAction = null;
    }
  }

  // ── Edit Quiz ──────────────────────────────────────────────────────
  openEditQuiz(): void {
    const q = this.quiz();
    if (!q) return;
    this.editQuizForm.patchValue({
      title:              q.title,
      description:        q.description,
      type:               getQuizTypeLabel(q.type),
      passingScore:       q.passingScore,
      timeLimitMinutes:   q.timeLimitMinutes,
      isTimeLimitMinutes: q.isTimeLimitMinutes || !!q.timeLimitMinutes,
    });
    this.editQuizModalVisible.set(true);
  }

  async submitEditQuiz(): Promise<void> {
    if (this.editQuizForm.invalid) { this.editQuizForm.markAllAsTouched(); return; }
    this.editQuizModalLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.put<any>(`${this.config.baseUrl}/api/quizzes/${this.quizId}`, this.editQuizForm.value)
      );
      if (res?.success) {
        this.toast.success(this.t('save_success'));
        this.editQuizModalVisible.set(false);
        await this.fetchData();
      } else {
        throw new Error(res?.message || this.t('save_error'));
      }
    } catch (err: any) {
      this.toast.error(parseApiError(err) || this.t('save_error'));
    } finally {
      this.editQuizModalLoading.set(false);
    }
  }

  // ── Image Upload ───────────────────────────────────────────────────
  beforeImageUpload = (file: NzUploadFile): boolean => {
    const rawFile = file as unknown as File;
    if (!rawFile.type.startsWith('image/')) { this.toast.error(this.t('images_only')); return false; }
    if (rawFile.size / 1024 / 1024 > 5)     { this.toast.error(this.t('max_5mb'));     return false; }
    this.imageFile.set(rawFile);
    this.removeImage.set(false);
    const r  = new FileReader();
    r.onload = e => this.imagePreview.set(e.target?.result as string);
    r.readAsDataURL(rawFile);
    return false;
  };

  removeImagePreview(): void {
    if (this.qModalMode() === 'edit' && this.editingQuestion()?.imagePath) this.removeImage.set(true);
    this.imageFile.set(null);
    this.imagePreview.set(null);
  }

  // ── Preview Modal ──────────────────────────────────────────────────
  openPreview(q: Question): void {
    this.previewQuestion.set(q);
    this.prevModalVisible.set(true);
  }

  // ── Options Editor ─────────────────────────────────────────────────
  addOption(): void {
    const text = this.newOptionText().trim();
    if (!text) { this.toast.warning(this.t('enter_option_text')); return; }
    if (this.options().length >= 6) { this.toast.warning(this.t('mc_max_6_options')); return; }
    this.options.update(prev => [...prev, {
      id: genId(), optionText: text, isCorrect: false,
      explanation: this.newOptionExpl().trim(), order: prev.length + 1,
    }]);
    this.newOptionText.set('');
    this.newOptionExpl.set('');
  }

  toggleOptionCorrect(idx: number): void {
    if (this.qType() === 'MultipleChoice') {
      this.options.update(prev => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
    } else {
      this.options.update(prev => prev.map((o, i) => i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
    }
  }

  removeOption(idx: number): void {
    this.options.update(prev => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, order: i + 1 })));
  }

  updateOption(idx: number, field: keyof QuestionOption, val: string | boolean): void {
    this.options.update(prev => prev.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  }

  // ── Matching Builder ───────────────────────────────────────────────
  addColA(): void {
    const text = this.newA().trim();
    if (!text) { this.toast.warning(this.t('enter_item')); return; }
    if (this.matchColA().length >= 12) { this.toast.warning(this.t('matching_max_reached')); return; }
    this.matchColA.update(prev => [...prev, { id: genId(), text }]);
    this.newA.set('');
  }

  addColB(): void {
    const text = this.newB().trim();
    if (!text) { this.toast.warning(this.t('enter_item')); return; }
    if (this.matchColB().length >= 12) { this.toast.warning(this.t('matching_max_reached')); return; }
    this.matchColB.update(prev => [...prev, { id: genId(), text }]);
    this.newB.set('');
  }

  removeColA(id: string): void {
    this.matchColA.update(prev => prev.filter(x => x.id !== id));
    this.matchAnswerMap.update(m => { const n = { ...m }; delete n[id]; return n; });
  }

  removeColB(id: string): void {
    this.matchColB.update(prev => prev.filter(x => x.id !== id));
    this.matchAnswerMap.update(m => {
      const n = { ...m };
      Object.keys(n).forEach(aId => { if (n[aId] === id) delete n[aId]; });
      return n;
    });
  }

  updateColA(id: string, text: string): void {
    this.matchColA.update(prev => prev.map(x => x.id === id ? { ...x, text } : x));
  }

  updateColB(id: string, text: string): void {
    this.matchColB.update(prev => prev.map(x => x.id === id ? { ...x, text } : x));
  }

  setMapping(aId: string, bId: string | null): void {
    this.matchAnswerMap.update(m => {
      const n = { ...m };
      if (!bId) delete n[aId]; else n[aId] = bId;
      return n;
    });
  }

  // ── Fill Blank Builder ─────────────────────────────────────────────
  onSentenceChange(val: string): void {
    this.fillSentence.set(val);
    this.blankIndex.set(null);
    this.blankIndices.set([]);
  }

  toggleBlankMulti(idx: number): void {
    this.blankIndices.update(current => {
      if (current.includes(idx)) {
        return current.filter(i => i !== idx);
      }
      if (current.length >= 4) return current; // max 4 blanks
      return [...current, idx].sort((a, b) => a - b);
    });
    // Keep blankIndex in sync with first blank for legacy compat
    this.blankIndex.set(this.blankIndices()[0] ?? null);
  }

  toggleBlank(idx: number): void {
    this.toggleBlankMulti(idx);
  }

  get sentenceWords(): string[] {
    const s = this.fillSentence();
    return s ? s.split(/\s+/).filter(Boolean) : [];
  }

  // ── Navigation ─────────────────────────────────────────────────────
  goBack(): void       { this.router.navigate(['/teacher/courses']); }
  viewAttempts(): void { this.router.navigate(['/teacher/quiz-attempts', this.quizId]); }
}