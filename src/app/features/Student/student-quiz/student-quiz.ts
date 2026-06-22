// features/Student/student-quiz/student-quiz.ts
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  LucideAngularModule,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

interface QuizOption { id: string; text: string; }
interface QuizQuestion { id: string; text: string; options: QuizOption[]; }
interface QuizTake { id: string; title: string; description?: string; questions: QuizQuestion[]; passingScore?: number; }
interface QuizResult { score: number; totalQuestions: number; correctAnswers: number; passed: boolean; }

type Phase = 'intro' | 'taking' | 'result';

@Component({
  selector: 'app-student-quiz',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-quiz.html',
  styleUrls: ['./student-quiz.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentQuiz' }],
})
export class StudentQuiz implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private http    = inject(HttpClient);
  private config  = inject(APP_CONFIG);
  private toast   = inject(Toast);

  readonly BackIcon  = ArrowLeft;
  readonly CheckIcon = CheckCircle2;
  readonly XIcon     = XCircle;
  readonly AwardIcon = Award;
  readonly RetryIcon = RotateCcw;

  quizId = '';
  loading = signal(true);
  submitting = signal(false);
  phase = signal<Phase>('intro');

  quiz      = signal<QuizTake | null>(null);
  attemptId = signal<string | null>(null);
  answers   = signal<Record<string, string>>({});
  result    = signal<QuizResult | null>(null);

  answeredCount = computed(() => Object.keys(this.answers()).length);
  totalQuestions = computed(() => this.quiz()?.questions.length ?? 0);
  allAnswered = computed(() => this.answeredCount() === this.totalQuestions() && this.totalQuestions() > 0);

  ngOnInit(): void {
    this.quizId = this.route.snapshot.paramMap.get('quizId') ?? '';
    this.loadQuiz();
  }

  private async loadQuiz(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: QuizTake }>(
          `${this.config.baseUrl}/api/quizzes/${this.quizId}/take`
        )
      );
      if (res.success) this.quiz.set(res.data);
    } catch {
      this.toast.error('Failed to load quiz');
    } finally {
      this.loading.set(false);
    }
  }

  async start(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: { id: string } }>(
          `${this.config.baseUrl}/api/quizzes/start`,
          { quizId: this.quizId }
        )
      );
      if (res.success) {
        this.attemptId.set(res.data.id);
        this.phase.set('taking');
      }
    } catch {
      this.toast.error('Unable to start quiz');
    }
  }

  selectAnswer(questionId: string, optionId: string): void {
    this.answers.update(a => ({ ...a, [questionId]: optionId }));
  }

  isSelected(questionId: string, optionId: string): boolean {
    return this.answers()[questionId] === optionId;
  }

  async submit(): Promise<void> {
    if (!this.allAnswered()) { this.toast.warning('Please answer all questions'); return; }
    this.submitting.set(true);
    try {
      const payload = {
        attemptId: this.attemptId(),
        answers: Object.entries(this.answers()).map(([questionId, optionId]) => ({ questionId, optionId })),
      };
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: QuizResult }>(
          `${this.config.baseUrl}/api/quizzes/submit`,
          payload
        )
      );
      if (res.success) {
        this.result.set(res.data);
        this.phase.set('result');
      }
    } catch {
      this.toast.error('Failed to submit quiz');
    } finally {
      this.submitting.set(false);
    }
  }

  retake(): void {
    this.answers.set({});
    this.result.set(null);
    this.attemptId.set(null);
    this.phase.set('intro');
  }

  back(): void { this.router.navigate(['/student/courses']); }
}
