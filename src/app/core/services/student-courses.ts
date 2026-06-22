// core/services/student-courses.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app.config';

// ---- Browse / catalog ------------------------------------------------------
export interface CourseListItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  instructorName?: string;
  price?: number;
  discountPrice?: number;
  currentPrice?: number;
  isFree?: boolean;
  hasDiscount?: boolean;
  rating?: number;
  ratingCount?: number;
  studentCount?: number;
  level?: string;
  totalLectures?: number;
  totalHours?: number;
}

// ---- Enrolled course (with progress) --------------------------------------
export interface EnrolledCourse {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  instructorName?: string;
  completionPercentage: number;
  completedLectures: number;
  totalLectures: number;
  enrolledAt?: string;
  lastAccessedAt?: string;
  isCompleted: boolean;
  status?: string;
}

// ---- Course detail with sections / lectures -------------------------------
export interface LectureItem {
  id: string;
  title: string;
  durationSeconds?: number;
  videoUrl?: string;
  contentType?: string;
  isPreview?: boolean;
  isCompleted?: boolean;
  order?: number;
  quizId?: string;
}

export interface SectionItem {
  id: string;
  title: string;
  order?: number;
  lectures: LectureItem[];
  quizId?: string;
}

export interface CourseDetails {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  longDescription?: string;
  whatYouWillLearn?: string[];
  requirements?: string[];
  thumbnailUrl?: string;
  instructorName?: string;
  instructorId?: string;
  price?: number;
  currentPrice?: number;
  isFree?: boolean;
  rating?: number;
  ratingCount?: number;
  studentCount?: number;
  totalHours?: number;
  totalLectures?: number;
  language?: string;
  level?: string;
  isEnrolled?: boolean;
  sections?: SectionItem[];
}

export interface CourseProgressSummary {
  courseId: string;
  completionPercentage: number;
  completedLectures: number;
  totalLectures: number;
  isCompleted: boolean;
}

export interface LectureNote {
  id: string;
  lectureId: string;
  content: string;
  timestamp?: number;
  createdAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class StudentCourses {
  private http = inject(HttpClient);
  private config = inject(APP_CONFIG);

  private get base() { return this.config.baseUrl; }

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------
  async browse(params: { page?: number; pageSize?: number; search?: string } = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 12));
    if (params.search) qs.set('search', params.search);
    const res = await firstValueFrom(
      this.http.get<{ data: CourseListItem[]; totalCount: number; page: number; pageSize: number }>(
        `${this.base}/api/courses?${qs.toString()}`
      )
    );
    return res;
  }

  async getCourseDetails(id: string): Promise<CourseDetails | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CourseDetails>>(`${this.base}/api/courses/${id}`)
      );
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Enrolled courses
  // -------------------------------------------------------------------------
  async getMyEnrolledCourses(): Promise<EnrolledCourse[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<EnrolledCourse[]>>(
          `${this.base}/api/courses/my-enrolled-courses`
        )
      );
      return res.success && res.data ? res.data : [];
    } catch {
      return [];
    }
  }

  /** Full course content for an enrolled learner (sections + lectures). */
  async getEnrolledCourse(id: string): Promise<CourseDetails | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CourseDetails>>(`${this.base}/api/courses/${id}/enrolled`)
      );
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }

  async enroll(courseId: string): Promise<ApiResponse<any>> {
    return firstValueFrom(
      this.http.post<ApiResponse<any>>(
        `${this.base}/api/enrollments/${courseId}?isWeb=true`, {}
      )
    );
  }

  // -------------------------------------------------------------------------
  // Lecture progress
  // -------------------------------------------------------------------------
  async getCourseProgress(courseId: string): Promise<CourseProgressSummary | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CourseProgressSummary>>(
          `${this.base}/api/lectureprogress/courses/${courseId}/progress`
        )
      );
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }

  async startLecture(lectureId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/api/lectureprogress/lectures/${lectureId}/start`, {})
      );
    } catch { /* non-fatal */ }
  }

  async updateLectureProgress(
    lectureId: string,
    body: { currentPositionSeconds: number; sessionWatchTimeSeconds?: number; markAsCompleted?: boolean }
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(
          `${this.base}/api/lectureprogress/lectures/${lectureId}/progress`,
          body
        )
      );
    } catch { /* non-fatal — best-effort sync */ }
  }

  async completeLecture(lectureId: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<boolean>>(
          `${this.base}/api/lectureprogress/lectures/${lectureId}/complete`, {}
        )
      );
      return res.success;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------
  async getLectureNotes(lectureId: string): Promise<LectureNote[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ notes: LectureNote[] }>>(
          `${this.base}/api/lectureprogress/lectures/${lectureId}/notes`
        )
      );
      return res.success && res.data?.notes ? res.data.notes : [];
    } catch {
      return [];
    }
  }

  async createNote(lectureId: string, content: string, timestamp?: number): Promise<LectureNote | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<LectureNote>>(
          `${this.base}/api/lectureprogress/lectures/${lectureId}/notes`,
          { content, timestamp }
        )
      );
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }

  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.delete<ApiResponse<boolean>>(
          `${this.base}/api/lectureprogress/notes/${noteId}`
        )
      );
      return res.success;
    } catch {
      return false;
    }
  }
}
