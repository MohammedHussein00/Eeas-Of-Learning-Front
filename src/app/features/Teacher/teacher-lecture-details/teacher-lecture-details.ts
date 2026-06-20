import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import {
  LucideAngularModule, ArrowLeft, PlayCircle, Video, Users, Star,
  Clock, CheckCircle, User, Eye, MessageSquare, FileText, BarChart3,
  Menu, Info, Trophy, PauseCircle, Download, Zap, TrendingUp,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzRateModule } from 'ng-zorro-antd/rate';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzResultModule } from 'ng-zorro-antd/result';

/* ─── Types ─────────────────────────────────────────────────────── */
interface LectureVideo {
  videoUrl: string;
  durationSeconds: number;
  formattedDuration: string;
  fileSize: number;
  formattedFileSize: string;
  resolution: string;
  format: string;
  status: string;
}

interface LectureResource {
  id: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  formattedFileSize?: string;
  downloadCount?: number;
}

interface LectureDetails {
  id: string;
  title: string;
  description?: string;
  order: number;
  isFree: boolean;
  isPreview: boolean;
  isPublished: boolean;
  sectionId: string;
  sectionTitle?: string;
  courseId?: string;
  courseTitle?: string;
  durationMinutes: number;
  video?: LectureVideo;
  resources?: LectureResource[];
  stats?: {
    hasVideo: boolean;
    resourceCount: number;
    totalSize: number;
    formattedTotalSize: string;
    totalDownloads: number;
  };
}

interface StudentProgress {
  studentId: string;
  name: string;
  email: string;
  profileImagePath?: string;
  isCompleted: boolean;
  watchProgress: number;
  totalWatchTimeSeconds: number;
  lastWatchedAt?: string;
  completedAt?: string;
  visitCount: number;
  formattedTotalWatchTime?: string;
  formattedAverageWatchTime?: string;
}

interface LectureReview {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  comment?: string;
  helpfulCount: number;
  isApproved: boolean;
  createdAt: string;
  formattedDate?: string;
}

interface ReviewSummary {
  lectureId: string;
  lectureTitle?: string;
  averageRating: number;
  totalReviews: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  fiveStarPercent: number;
  fourStarPercent: number;
  threeStarPercent: number;
  twoStarPercent: number;
  oneStarPercent: number;
  reviews: LectureReview[];
}

interface DistBand { label: string; min: number; max: number; color: string; }

/* ─── Helpers ───────────────────────────────────────────────────── */
const fmtFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes, i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const progressColor = (pct: number): string => {
  if (pct >= 90) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#4f6ef7';
};

const DIST_BANDS: DistBand[] = [
  { label: '0%',      min: 0,  max: 0,   color: '#718096' },
  { label: '1–25%',   min: 1,  max: 25,  color: '#4f6ef7' },
  { label: '26–50%',  min: 26, max: 50,  color: '#0891b2' },
  { label: '51–75%',  min: 51, max: 75,  color: '#d97706' },
  { label: '76–89%',  min: 76, max: 89,  color: '#ea580c' },
  { label: '90–100%', min: 90, max: 100, color: '#16a34a' },
];

@Component({
  selector: 'app-teacher-lecture-details',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslocoModule, LucideAngularModule,
    NzTabsModule, NzTableModule, NzAvatarModule, NzTagModule,
    NzRateModule, NzProgressModule, NzSpinModule, NzEmptyModule,
    NzBadgeModule, NzButtonModule, NzDrawerModule, NzResultModule,
  ],
  templateUrl: './teacher-lecture-details.html',
  styleUrls: ['./teacher-lecture-details.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'lectureDetails' }],
})
export class TeacherLectureDetails implements OnInit {
  private http      = inject(HttpClient);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  // ── Icons ────────────────────────────────────────────
  readonly ArrowLeftIcon    = ArrowLeft;
  readonly PlayCircleIcon   = PlayCircle;
  readonly VideoIcon        = Video;
  readonly TeamIcon         = Users;
  readonly StarIcon         = Star;
  readonly ClockIcon        = Clock;
  readonly CheckCircleIcon  = CheckCircle;
  readonly UserIcon         = User;
  readonly EyeIcon          = Eye;
  readonly MessageIcon      = MessageSquare;
  readonly FileTextIcon     = FileText;
  readonly BarChartIcon     = BarChart3;
  readonly MenuIcon         = Menu;
  readonly InfoIcon         = Info;
  readonly TrophyIcon       = Trophy;
  readonly PauseCircleIcon  = PauseCircle;
  readonly DownloadIcon     = Download;
  readonly ZapIcon          = Zap;
  readonly TrendingUpIcon   = TrendingUp;

  readonly baseUrl = this.config.baseUrl;
  readonly fmtFileSize  = fmtFileSize;
  readonly progressColor = progressColor;
  readonly distBands = DIST_BANDS;

  // ── State ────────────────────────────────────────────
  loading         = signal(true);
  lecture         = signal<LectureDetails | null>(null);
  studentProgress = signal<StudentProgress[]>([]);
  reviewSummary   = signal<ReviewSummary | null>(null);
  progressLoading = signal(false);
  reviewsLoading  = signal(false);
  activeTab       = signal('video');
  sidebarOpen     = signal(false);
  tabIndex        = 0;

  lectureId = '';

  // ── Computed stats ───────────────────────────────────
  stats = computed(() => {
    const list = this.studentProgress();
    if (!list.length) return { total: 0, completed: 0, inProgress: 0, avgWatch: 0, notStarted: 0 };
    const completed  = list.filter(s => s.isCompleted).length;
    const inProgress = list.filter(s => !s.isCompleted && s.watchProgress > 0).length;
    const avgWatch   = Math.round(list.reduce((a, s) => a + s.watchProgress, 0) / list.length);
    return {
      total: list.length,
      completed,
      inProgress,
      avgWatch,
      notStarted: list.length - completed - inProgress,
    };
  });

  topWatchers = computed(() =>
    [...this.studentProgress()]
      .sort((a, b) => b.watchProgress - a.watchProgress)
      .slice(0, 5)
  );

  watchDistribution = computed(() => {
    const list = this.studentProgress();
    const total = list.length;
    return this.distBands.map(band => {
      const count = list.filter(s => s.watchProgress >= band.min && s.watchProgress <= band.max).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...band, count, pct };
    });
  });

  starBreakdown = computed(() => {
    const rs = this.reviewSummary();
    if (!rs) return [];
    const data: { star: number; pct: number; count: number }[] = [
      { star: 5, pct: rs.fiveStarPercent,  count: rs.fiveStarCount },
      { star: 4, pct: rs.fourStarPercent,  count: rs.fourStarCount },
      { star: 3, pct: rs.threeStarPercent, count: rs.threeStarCount },
      { star: 2, pct: rs.twoStarPercent,   count: rs.twoStarCount },
      { star: 1, pct: rs.oneStarPercent,   count: rs.oneStarCount },
    ];
    return data;
  });

  progressColumns = [
    { key: 'student',    titleKey: 'student',    title: 'Student' },
    { key: 'progress',   titleKey: 'progress',   title: 'Progress' },
    { key: 'status',     titleKey: 'status',     title: 'Status' },
    { key: 'watchTime',  titleKey: 'watchTime',  title: 'Watch Time' },
    { key: 'visits',     titleKey: 'visits',     title: 'Visits' },
    { key: 'lastWatched',titleKey: 'lastWatched',title: 'Last Watched' },
    { key: 'completedAt',titleKey: 'completedAt',title: 'Completed' },
  ];

  ngOnInit(): void {
    this.lectureId = this.route.snapshot.paramMap.get('id') ?? '';
    this.fetchLecture();
    this.fetchProgress();
    this.fetchReviews();
  }

  // ── Fetch lecture ──────────────────────────────────────
  private async fetchLecture(): Promise<void> {
    if (!this.lectureId) return;
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/lectures/${this.lectureId}`)
      );
      if (res?.success) this.lecture.set(res.data);
      else this.toast.error(res?.message || this.t('loadFailed'));
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.t('loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Fetch student progress ──────────────────────────────
  private async fetchProgress(): Promise<void> {
    if (!this.lectureId) return;
    this.progressLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/LectureProgress/lectures/${this.lectureId}/all-progress`)
      );
      if (res?.success) this.studentProgress.set(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      this.progressLoading.set(false);
    }
  }

  // ── Fetch reviews ────────────────────────────────────────
  private async fetchReviews(): Promise<void> {
    if (!this.lectureId) return;
    this.reviewsLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/LectureReview/lectures/${this.lectureId}`)
      );
      if (res?.success) this.reviewSummary.set(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      this.reviewsLoading.set(false);
    }
  }

  // ── UI helpers ─────────────────────────────────────────
  setTab(key: string): void { this.activeTab.set(key); }
  openSidebar(): void  { this.sidebarOpen.set(true); }
  closeSidebar(): void { this.sidebarOpen.set(false); }
  goBack(): void { this.router.navigate([-1 as any]); }

  videoSrc(url?: string): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : `${this.baseUrl}${url}`;
  }

  avatarUrl(path?: string): string | undefined {
    return path ? `${this.baseUrl}${path}` : undefined;
  }

  resourceName(url: string): string {
    return url.split('/').pop() || url;
  }

  formatDate(d?: string): string {
    return d ? new Date(d).toLocaleDateString() : '—';
  }

  // ── Translation ──────────────────────────────────────────
  t(key: string, fallback?: string): string {
    const v = this.transloco.translate(`lectureDetails.${key}`);
    return v && v !== `lectureDetails.${key}` ? v : (fallback ?? key);
  }

  tc(key: string, fallback?: string): string {
    const v = this.transloco.translate(`common.${key}`);
    return v && v !== `common.${key}` ? v : (fallback ?? key);
  }
}