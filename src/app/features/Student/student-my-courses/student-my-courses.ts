// features/Student/student-my-courses/student-my-courses.ts
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import {
  LucideAngularModule,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  GraduationCap,
} from 'lucide-angular';
import { StudentCourses, EnrolledCourse } from '../../../core/services/student-courses';

type Filter = 'all' | 'inProgress' | 'completed';

@Component({
  selector: 'app-student-my-courses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule, NzProgressModule],
  templateUrl: './student-my-courses.html',
  styleUrls: ['./student-my-courses.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentMyCourses' }],
})
export class StudentMyCourses implements OnInit {
  private router  = inject(Router);
  private courses = inject(StudentCourses);

  readonly BookOpenIcon   = BookOpen;
  readonly PlayIcon       = PlayCircle;
  readonly CheckIcon      = CheckCircle2;
  readonly GraduationIcon = GraduationCap;

  loading = signal(true);
  all     = signal<EnrolledCourse[]>([]);
  filter  = signal<Filter>('all');

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all',        label: 'all' },
    { key: 'inProgress', label: 'inProgress' },
    { key: 'completed',  label: 'completed' },
  ];

  visible = computed(() => {
    const list = this.all();
    switch (this.filter()) {
      case 'inProgress': return list.filter(c => !c.isCompleted);
      case 'completed':  return list.filter(c => c.isCompleted);
      default:           return list;
    }
  });

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await this.courses.getMyEnrolledCourses());
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(f: Filter): void { this.filter.set(f); }

  open(course: EnrolledCourse): void {
    this.router.navigate(['/student/courses', course.id, 'learn']);
  }

  browseCourses(): void {
    this.router.navigate(['/courses']);
  }
}
