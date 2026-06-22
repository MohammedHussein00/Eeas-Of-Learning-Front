// features/Student/student-community/student-community.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, ArrowLeft, MessageCircle, Send, CornerDownRight } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

interface Answer { id: string; content: string; authorName?: string; createdAt?: string; }
interface Question {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  createdAt?: string;
  answers?: Answer[];
  answerCount?: number;
}

@Component({
  selector: 'app-student-community',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-community.html',
  styleUrls: ['./student-community.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentCommunity' }],
})
export class StudentCommunity implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private http    = inject(HttpClient);
  private config  = inject(APP_CONFIG);
  private toast   = inject(Toast);

  readonly BackIcon  = ArrowLeft;
  readonly MsgIcon   = MessageCircle;
  readonly SendIcon  = Send;
  readonly ReplyIcon = CornerDownRight;

  courseId = '';
  loading  = signal(true);
  questions = signal<Question[]>([]);
  expanded  = signal<string | null>(null);

  // New question form
  newTitle   = signal('');
  newContent = signal('');
  posting    = signal(false);

  // Per-question answer drafts
  answerDrafts = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('courseId') ?? '';
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: Question[] }>(
          `${this.config.baseUrl}/api/community/courses/${this.courseId}/questions?page=1&pageSize=30`
        )
      );
      this.questions.set(res.success && res.data ? res.data : []);
    } catch {
      this.questions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async postQuestion(): Promise<void> {
    const title = this.newTitle().trim();
    const content = this.newContent().trim();
    if (!title || !content) return;
    this.posting.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: Question }>(
          `${this.config.baseUrl}/api/community/questions`,
          { title, content, courseId: this.courseId }
        )
      );
      if (res.success) {
        this.questions.update(list => [res.data, ...list]);
        this.newTitle.set('');
        this.newContent.set('');
        this.toast.success('Question posted');
      }
    } catch {
      this.toast.error('Failed to post question');
    } finally {
      this.posting.set(false);
    }
  }

  toggle(question: Question): void {
    this.expanded.update(id => id === question.id ? null : question.id);
  }

  isExpanded(question: Question): boolean {
    return this.expanded() === question.id;
  }

  setDraft(questionId: string, value: string): void {
    this.answerDrafts.update(d => ({ ...d, [questionId]: value }));
  }

  draft(questionId: string): string {
    return this.answerDrafts()[questionId] ?? '';
  }

  async postAnswer(question: Question): Promise<void> {
    const content = this.draft(question.id).trim();
    if (!content) return;
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: Answer }>(
          `${this.config.baseUrl}/api/community/questions/${question.id}/answers`,
          { content }
        )
      );
      if (res.success) {
        this.questions.update(list => list.map(q =>
          q.id === question.id
            ? { ...q, answers: [...(q.answers ?? []), res.data], answerCount: (q.answerCount ?? 0) + 1 }
            : q
        ));
        this.setDraft(question.id, '');
      }
    } catch {
      this.toast.error('Failed to post answer');
    }
  }

  back(): void { this.router.navigate(['/student/courses']); }
}
