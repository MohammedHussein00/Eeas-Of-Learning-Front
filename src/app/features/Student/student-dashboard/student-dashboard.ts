// features/Student/student-dashboard/student-dashboard.ts
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import {
  LucideAngularModule,
  BookOpen,
  CheckCircle2,
  Trophy,
  Flame,
  ArrowRight,
  PlayCircle,
  GraduationCap,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { StudentCourses, EnrolledCourse } from '../../../core/services/student-courses';
import { StudentProfile } from '../../../core/services/student-profile';

interface XpSummary {
  totalXp: number;
  allTimeRank: number;
  weeklyXp: number;
  weeklyRank: number;
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule, NzProgressModule],
  templateUrl: './student-dashboard.html',
  styleUrls: ['./student-dashboard.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentDashboard' }],
})
export class StudentDashboard implements OnInit {
  private http     = inject(HttpClient);
  private router   = inject(Router);
  private config   = inject(APP_CONFIG);
  private courses  = inject(StudentCourses);
  private profile  = inject(StudentProfile);

  readonly BookOpenIcon     = BookOpen;
  readonly CheckIcon        = CheckCircle2;
  readonly TrophyIcon       = Trophy;
  readonly FlameIcon        = Flame;
  readonly ArrowRightIcon   = ArrowRight;
  readonly PlayIcon         = PlayCircle;
  readonly GraduationIcon   = GraduationCap;

  loading        = signal(true);
  enrolledCourses = signal<EnrolledCourse[]>([]);
  xp             = signal<XpSummary | null>(null);

  studentName = computed(() => this.profile.profile()?.name ?? 'Student');

  stats = computed(() => {
    const list = this.enrolledCourses();
    return {
      enrolled: list.length,
      completed: list.filter(c => c.isCompleted).length,
      inProgress: list.filter(c => !c.isCompleted && c.completionPercentage > 0).length,
    };
  });

  // Top 3 courses to "continue learning"
  continueLearning = computed(() =>
    this.enrolledCourses()
      .filter(c => !c.isCompleted)
      .sort((a, b) => (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))
      .slice(0, 3)
  );

  ngOnInit(): void {
    this.profile.fetchProfile();
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [courses, xpRes] = await Promise.all([
        this.courses.getMyEnrolledCourses(),
        this.fetchXp(),
      ]);
      this.enrolledCourses.set(courses);
      this.xp.set(xpRes);
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchXp(): Promise<XpSummary | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: XpSummary }>(`${this.config.baseUrl}/api/xp/me`)
      );
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }

  continueCourse(course: EnrolledCourse): void {
    this.router.navigate(['/student/courses', course.id, 'learn']);
  }

  goToCourses(): void {
    this.router.navigate(['/student/courses']);
  }

  browseCourses(): void {
    this.router.navigate(['/courses']);
  }

  goToLeaderboard(): void {
    this.router.navigate(['/student/leaderboard']);
  }
}
