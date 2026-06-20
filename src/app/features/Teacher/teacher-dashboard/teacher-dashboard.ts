// features/teacher/dashboard/teacher-dashboard.ts
// Only the providers array changes — add TRANSLOCO_SCOPE.
// Everything else (signals, http, etc.) stays identical.

import {
  Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import {
  LucideAngularModule, BookOpen, Users, DollarSign, Star,
  TrendingUp, Trophy, Flame, BarChart3, ArrowRight, Plus, Zap, CheckCircle
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule],
  templateUrl: './teacher-dashboard.html',
  styleUrls: ['./teacher-dashboard.scss'],
  providers: [
    /**
     * Loads /assets/i18n/teacherDashboard/en.json on demand.
     * alias 'td' keeps templates short: t('td.totalRevenue')
     * or use *transloco="let t; scope:'teacherDashboard'" and call t('totalRevenue').
     */
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherDashboard' },
  ],
})
export class TeacherDashboard implements OnInit, OnDestroy {
  // ... (identical to the previous version — only the providers block above is new)
  private http      = inject(HttpClient);
  private router    = inject(Router);
  public config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private destroy$  = new Subject<void>();

  readonly BookOpenIcon    = BookOpen;
  readonly UsersIcon       = Users;
  readonly DollarSignIcon  = DollarSign;
  readonly StarIcon        = Star;
  readonly TrendingUpIcon  = TrendingUp;
  readonly TrophyIcon      = Trophy;
  readonly FlameIcon       = Flame;
  readonly BarChart3Icon   = BarChart3;
  readonly ArrowRightIcon  = ArrowRight;
  readonly PlusIcon        = Plus;
  readonly ZapIcon         = Zap;
  readonly CheckCircleIcon = CheckCircle;

  loading         = signal(true);
  stats           = signal<any>(null);
  areaData        = signal<any[]>([]);
  barData         = signal<any[]>([]);
  topCourses      = signal<any[]>([]);
  recentStudents  = signal<any[]>([]);
  ratingBreakdown = signal([
    { stars: 5, count: 0, percentage: 0 },
    { stars: 4, count: 0, percentage: 0 },
    { stars: 3, count: 0, percentage: 0 },
    { stars: 2, count: 0, percentage: 0 },
    { stars: 1, count: 0, percentage: 0 },
  ]);

  readonly CHART_COLORS = ['#3d5af1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e'];

  today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  growthMetrics = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { labelKey: 'teacherDashboard.revenue',  color: '#3d5af1', bg: '#eef0ff', value: this.fmtCurrency(s.revenueThisMonth), total: this.fmtCurrency(s.totalRevenue),       pct: s.totalRevenue   > 0 ? +((s.revenueThisMonth   / s.totalRevenue)   * 100).toFixed(1) : 0 },
      { labelKey: 'teacherDashboard.students', color: '#06b6d4', bg: '#e0f9ff', value: `+${s.newStudentsThisMonth}`,          total: s.totalStudents.toLocaleString(),         pct: s.totalStudents  > 0 ? +((s.newStudentsThisMonth / s.totalStudents)  * 100).toFixed(1) : 0 },
      { labelKey: 'teacherDashboard.reviews',  color: '#f59e0b', bg: '#fff8e6', value: `+${s.newReviewsThisMonth}`,           total: s.totalReviews.toLocaleString(),          pct: s.totalReviews   > 0 ? +((s.newReviewsThisMonth  / s.totalReviews)   * 100).toFixed(1) : 0 },
    ];
  });

  maxRevenue      = computed(() => Math.max(...this.barData().map(b => b.revenue), 1));
  maxAreaRevenue  = computed(() => Math.max(...this.areaData().map(a => a.revenue), 1));
  maxAreaStudents = computed(() => Math.max(...this.areaData().map(a => a.students), 1));

  ngOnInit(): void { this.fetchAll(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private async fetchAll(): Promise<void> {
    try {
      this.loading.set(true);
      const base = this.config.baseUrl;
      const [statsRes, revenueRes, coursesRes, studentsRes] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${base}/api/Teacher/instructor/statistics`)),
        firstValueFrom(this.http.get<any>(`${base}/api/TeacherEarning/monthly-revenue`)),
        firstValueFrom(this.http.get<any>(`${base}/api/Courses/instructor-courses?pageSize=10&sortBy=students`)),
        firstValueFrom(this.http.get<any>(`${base}/api/Enrollments/recent-students?pageSize=5`)),
      ]);
      const s = statsRes?.data ?? {};
      this.stats.set(s);
      const monthly = Array.isArray(revenueRes?.data) ? revenueRes.data : [];
      this.areaData.set(monthly.length ? monthly.map((m: any) => ({ name: m.month, revenue: m.grossRevenue || 0, students: m.newStudents || 0 })) : this.emptyMonths());
      const courses = (coursesRes?.data?.courses ?? []).slice(0, 5);
      this.topCourses.set(courses);
      this.barData.set(courses.map((c: any, i: number) => ({ name: c.title?.length > 12 ? c.title.slice(0, 12) + '…' : c.title, revenue: c.totalRevenue || 0, students: c.studentCount || 0 })));
      this.recentStudents.set(studentsRes?.data ?? []);
      if ((s.totalReviews ?? 0) > 0) {
        this.ratingBreakdown.set([
          { stars: 5, count: s.fiveStarCount  || 0, percentage: s.fiveStarPercentage  || 0 },
          { stars: 4, count: s.fourStarCount  || 0, percentage: s.fourStarPercentage  || 0 },
          { stars: 3, count: s.threeStarCount || 0, percentage: s.threeStarPercentage || 0 },
          { stars: 2, count: s.twoStarCount   || 0, percentage: s.twoStarPercentage   || 0 },
          { stars: 1, count: s.oneStarCount   || 0, percentage: s.oneStarPercentage   || 0 },
        ]);
      }
    } catch {
      // Uses root scope key — always available without waiting for feature scope
      this.toast.error(this.transloco.translate('common.errors.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  private emptyMonths(): any[] {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (11 - i));
      return { name: d.toLocaleString('default', { month: 'short' }), revenue: 0, students: 0 };
    });
  }

  fmtCurrency(v: number | null | undefined): string {
    if (!v) return 'EGP 0';
    if (v >= 1_000_000) return `EGP ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `EGP ${(v / 1_000).toFixed(1)}K`;
    return `EGP ${v.toFixed(2)}`;
  }

  pct(part: number, total: number): number { return total > 0 ? Math.min((part / total) * 100, 100) : 0; }
  growthTag(p: number): 'high' | 'moderate' | 'low' { return p > 50 ? 'high' : p > 20 ? 'moderate' : 'low'; }
  chartColor(i: number): string { return this.CHART_COLORS[i % this.CHART_COLORS.length]; }
  barPct(v: number): number { return (v / this.maxRevenue()) * 100; }
  avatarUrl(path: string | undefined, name: string): string {
    if (!path) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d5af1&color=fff&bold=true`;
    return path.startsWith('http') ? path : `${this.config.baseUrl}/${path}`;
  }

  goToAddCourse(): void { this.router.navigate(['/teacher/add-course']); }
  goToCourse(id: string): void { this.router.navigate(['/teacher/courses', id]); }
  goToStudent(sid: string, cid: string): void { this.router.navigate(['/teacher/students', sid, 'courses', cid]); }
}