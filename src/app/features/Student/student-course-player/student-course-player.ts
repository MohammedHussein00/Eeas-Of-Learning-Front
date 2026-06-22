// features/Student/student-course-player/student-course-player.ts
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import {
  LucideAngularModule,
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  ChevronDown,
  Trash2,
  StickyNote,
  HelpCircle,
} from 'lucide-angular';
import {
  StudentCourses,
  CourseDetails,
  SectionItem,
  LectureItem,
  LectureNote,
} from '../../../core/services/student-courses';
import { Toast } from '../../../core/services/toast';

@Component({
  selector: 'app-student-course-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoModule, LucideAngularModule, NzSpinModule, NzProgressModule],
  templateUrl: './student-course-player.html',
  styleUrls: ['./student-course-player.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentCoursePlayer' }],
})
export class StudentCoursePlayer implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private courses = inject(StudentCourses);
  private toast   = inject(Toast);

  readonly BackIcon     = ArrowLeft;
  readonly DoneIcon     = CheckCircle2;
  readonly CircleIcon   = Circle;
  readonly PlayIcon     = PlayCircle;
  readonly FileIcon     = FileText;
  readonly ChevronIcon  = ChevronDown;
  readonly TrashIcon    = Trash2;
  readonly NoteIcon     = StickyNote;
  readonly QuizIcon     = HelpCircle;

  courseId = '';
  loading  = signal(true);
  course   = signal<CourseDetails | null>(null);
  currentLecture = signal<LectureItem | null>(null);
  openSections   = signal<Set<string>>(new Set());

  // Notes
  notes        = signal<LectureNote[]>([]);
  newNote      = signal('');
  notesLoading = signal(false);

  sidebarOpen = signal(true);

  private progressTimer: any = null;

  // Flatten lectures for prev/next + progress
  allLectures = computed<LectureItem[]>(() =>
    (this.course()?.sections ?? []).flatMap(s => s.lectures)
  );

  progress = computed(() => {
    const all = this.allLectures();
    if (!all.length) return 0;
    const done = all.filter(l => l.isCompleted).length;
    return Math.round((done / all.length) * 100);
  });

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('courseId') ?? '';
    const lectureId = this.route.snapshot.paramMap.get('lectureId');
    this.load(lectureId);
  }

  ngOnDestroy(): void {
    this.clearProgressTimer();
  }

  private async load(lectureId: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.courses.getEnrolledCourse(this.courseId);
      if (!data) {
        this.toast.error('Unable to load course');
        this.router.navigate(['/student/courses']);
        return;
      }
      this.course.set(data);

      // open all sections by default
      const open = new Set<string>((data.sections ?? []).map(s => s.id));
      this.openSections.set(open);

      const all = this.allLectures();
      const target = lectureId
        ? all.find(l => l.id === lectureId)
        : (all.find(l => !l.isCompleted) ?? all[0]);
      if (target) this.selectLecture(target, false);
    } finally {
      this.loading.set(false);
    }
  }

  toggleSection(section: SectionItem): void {
    this.openSections.update(set => {
      const next = new Set(set);
      next.has(section.id) ? next.delete(section.id) : next.add(section.id);
      return next;
    });
  }

  isSectionOpen(section: SectionItem): boolean {
    return this.openSections().has(section.id);
  }

  async selectLecture(lecture: LectureItem, updateUrl = true): Promise<void> {
    this.clearProgressTimer();
    this.currentLecture.set(lecture);
    if (updateUrl) {
      this.router.navigate(['/student/courses', this.courseId, 'learn', lecture.id], { replaceUrl: true });
    }
    this.courses.startLecture(lecture.id);
    this.loadNotes(lecture.id);
    // Best-effort heartbeat for video position would hook a real <video> element;
    // here we periodically sync a coarse position.
    this.startProgressHeartbeat(lecture.id);
  }

  private startProgressHeartbeat(lectureId: string): void {
    let seconds = 0;
    this.progressTimer = setInterval(() => {
      seconds += 15;
      this.courses.updateLectureProgress(lectureId, {
        currentPositionSeconds: seconds,
        sessionWatchTimeSeconds: 15,
      });
    }, 15000);
  }

  private clearProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  async markComplete(lecture: LectureItem): Promise<void> {
    const ok = await this.courses.completeLecture(lecture.id);
    if (ok) {
      // mutate local state immutably
      this.course.update(c => {
        if (!c) return c;
        return {
          ...c,
          sections: c.sections?.map(s => ({
            ...s,
            lectures: s.lectures.map(l => l.id === lecture.id ? { ...l, isCompleted: true } : l),
          })),
        };
      });
      const cur = this.currentLecture();
      if (cur?.id === lecture.id) this.currentLecture.set({ ...cur, isCompleted: true });
      this.toast.success('Lecture marked complete');
      this.goNext();
    }
  }

  goNext(): void {
    const all = this.allLectures();
    const idx = all.findIndex(l => l.id === this.currentLecture()?.id);
    if (idx >= 0 && idx < all.length - 1) this.selectLecture(all[idx + 1]);
  }

  goPrev(): void {
    const all = this.allLectures();
    const idx = all.findIndex(l => l.id === this.currentLecture()?.id);
    if (idx > 0) this.selectLecture(all[idx - 1]);
  }

  openQuiz(quizId: string): void {
    this.router.navigate(['/student/quizzes', quizId]);
  }

  // --- Notes -----------------------------------------------------------------
  private async loadNotes(lectureId: string): Promise<void> {
    this.notesLoading.set(true);
    try {
      this.notes.set(await this.courses.getLectureNotes(lectureId));
    } finally {
      this.notesLoading.set(false);
    }
  }

  async addNote(): Promise<void> {
    const content = this.newNote().trim();
    const lecture = this.currentLecture();
    if (!content || !lecture) return;
    const created = await this.courses.createNote(lecture.id, content);
    if (created) {
      this.notes.update(list => [created, ...list]);
      this.newNote.set('');
    }
  }

  async removeNote(note: LectureNote): Promise<void> {
    const ok = await this.courses.deleteNote(note.id);
    if (ok) this.notes.update(list => list.filter(n => n.id !== note.id));
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  back(): void { this.router.navigate(['/student/courses']); }
}
