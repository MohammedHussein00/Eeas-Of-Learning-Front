// features/Student/student-reviews/student-reviews.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Star, MessageSquareText, Trash2 } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

interface CourseReview {
  id: string;
  courseId: string;
  courseTitle?: string;
  rating: number;
  title?: string;
  content?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-student-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-reviews.html',
  styleUrls: ['./student-reviews.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentReviews' }],
})
export class StudentReviews implements OnInit {
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);
  private toast  = inject(Toast);

  readonly StarIcon  = Star;
  readonly MsgIcon   = MessageSquareText;
  readonly TrashIcon = Trash2;

  readonly stars = [1, 2, 3, 4, 5];

  loading = signal(true);
  reviews = signal<CourseReview[]>([]);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: { items?: CourseReview[] } | CourseReview[] }>(
          `${this.config.baseUrl}/api/coursereviews/my-reviews?page=1&pageSize=30`
        )
      );
      const data = res.data as any;
      const list: CourseReview[] = Array.isArray(data) ? data : (data?.items ?? data?.reviews ?? []);
      this.reviews.set(res.success ? list : []);
    } catch {
      this.reviews.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async remove(review: CourseReview): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.delete<{ success: boolean }>(`${this.config.baseUrl}/api/coursereviews/${review.id}`)
      );
      if (res.success) {
        this.reviews.update(list => list.filter(r => r.id !== review.id));
        this.toast.success('Review deleted');
      }
    } catch {
      this.toast.error('Failed to delete review');
    }
  }
}
