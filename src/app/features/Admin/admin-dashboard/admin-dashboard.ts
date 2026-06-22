// features/admin/dashboard/admin-dashboard.ts
import {
  Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import {
  LucideAngularModule,
  Users, DollarSign, BookOpen, Star, TrendingUp,
  Shield, AlertTriangle, CheckCircle, Clock, Activity,
  BarChart3, Globe, Zap, ArrowRight, RefreshCw,
  UserCheck, UserX, Award, Layers,
  ChevronUp, ChevronDown, Eye, CreditCard, Database
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisMonth: number;
  totalTeachers: number;
  verifiedTeachers: number;
  pendingVerifications: number;
  totalStudents: number;
  totalAdmins: number;
  totalCourses: number;
  publishedCourses: number;
  pendingCourses: number;
  totalRevenue: number;
  revenueThisMonth: number;
  totalEnrollments: number;
  enrollmentsThisMonth: number;
  enrollmentsLastMonth: number;
  totalPayouts: number;
  pendingPayouts: number;
  averageCourseRating: number;
  totalReviews: number;
  activeSubscriptions: number;
}

export interface MonthlyRow    { month: string; revenue: number; enrollments: number; }
export interface CourseItem    { id: string; title: string; studentCount: number; rating: number; ratingCount: number; totalRevenue: number; isPublished: boolean; instructorName?: string; categoryName?: string; currentPrice?: string; }
export interface TeacherItem   { userId: string; fullName: string; profilePictureUrl?: string; isVerified: boolean; createdAt: string; }
export interface PayoutItem    { id: string; teacherName: string; teacherEmail?: string; totalAmount?: number; netAmount?: number; platformFee?: number; status: string | number; createdAt: string; paidAt?: string; payoutMethod?: string; recipientNumber?: string; }
export interface SubjectItem   { id: string; name: string; questionCount: number; isActive: boolean; color?: string; }
export interface UserDist      { role: string; count: number; color: string; }
export interface RadialRow     { name: string; value: number; fill: string; }
export interface ProgressRow   { label: string; value: string; pct: number; color: string; }
export interface KpiCard       { color: string; labelKey: string; valueKey: string; badgeKey: string; badgeType: 'up' | 'down' | 'neu'; subKey: string; }
export interface StatusConfig  { cls: string; label: string; }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'adminDashboard' },
  ],
})
export class AdminDashboard implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  public  config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private destroy$  = new Subject<void>();

  // Icons
  readonly UsersIcon       = Users;
  readonly DollarSignIcon  = DollarSign;
  readonly BookOpenIcon    = BookOpen;
  readonly StarIcon        = Star;
  readonly TrendingUpIcon  = TrendingUp;
  readonly ShieldIcon      = Shield;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly CheckCircleIcon = CheckCircle;
  readonly ClockIcon       = Clock;
  readonly ActivityIcon    = Activity;
  readonly BarChart3Icon   = BarChart3;
  readonly GlobeIcon       = Globe;
  readonly ZapIcon         = Zap;
  readonly ArrowRightIcon  = ArrowRight;
  readonly RefreshCwIcon   = RefreshCw;
  readonly UserCheckIcon   = UserCheck;
  readonly UserXIcon       = UserX;
  readonly AwardIcon       = Award;
  readonly LayersIcon      = Layers;
  readonly ChevronUpIcon   = ChevronUp;
  readonly ChevronDownIcon = ChevronDown;
  readonly EyeIcon         = Eye;
  readonly CreditCardIcon  = CreditCard;
  readonly DatabaseIcon    = Database;

  // State signals
  loading    = signal(true);
  refreshing = signal(false);
  error      = signal<string | null>(null);
  stats      = signal<PlatformStats | null>(null);
  monthly    = signal<MonthlyRow[]>([]);
  courses    = signal<CourseItem[]>([]);
  teachers   = signal<TeacherItem[]>([]);
  payouts    = signal<PayoutItem[]>([]);
  subjects   = signal<SubjectItem[]>([]);
  userDist   = signal<UserDist[]>([]);

  readonly COLORS = ['#6366f1','#14b8a6','#f59e0b','#f43f5e','#8b5cf6','#22c55e','#06b6d4','#ec4899'];

  today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Derived computed values
  chartData = computed<MonthlyRow[]>(() => {
    const m = this.monthly();
    if (m.length) return m;
    return this.emptyMonths();
  });

  barData = computed(() =>
    this.courses().map((c, i) => ({
      name: (c.title?.length ?? 0) > 14 ? c.title.slice(0, 12) + '…' : (c.title || 'Untitled'),
      students: c.studentCount ?? 0,
      fill: this.COLORS[i % this.COLORS.length],
    }))
  );

  radialData = computed<RadialRow[]>(() => {
    const s = this.stats();
    return [
      { name: 'Published %', value: s ? Math.round((s.publishedCourses / Math.max(s.totalCourses, 1)) * 100) : 0, fill: '#6366f1' },
      { name: 'Verified %',  value: s ? Math.round((s.verifiedTeachers / Math.max(s.totalTeachers, 1)) * 100) : 0, fill: '#14b8a6' },
    ];
  });

  progressRows = computed<ProgressRow[]>(() => {
    const s = this.stats();
    return [
      { label: 'totalCourses',   value: this.fmtNum(s?.totalCourses),   pct: s ? (s.publishedCourses     / Math.max(s.totalCourses, 1))   * 100 : 0, color: '#6366f1' },
      { label: 'totalTeachers',  value: this.fmtNum(s?.totalTeachers),  pct: s ? (s.verifiedTeachers     / Math.max(s.totalTeachers, 1))  * 100 : 0, color: '#14b8a6' },
      { label: 'enrollments',    value: this.fmtNum(s?.totalEnrollments), pct: s ? (s.enrollmentsLastMonth / Math.max(s.totalEnrollments, 1)) * 100 : 0, color: '#8b5cf6' },
      { label: 'totalUsers',     value: this.fmtNum(s?.totalUsers),     pct: s ? (s.activeUsers          / Math.max(s.totalUsers, 1))     * 100 : 0, color: '#f59e0b' },
    ];
  });

  maxBarStudents = computed(() => Math.max(...this.barData().map(b => b.students), 1));
  maxChartRevenue  = computed(() => Math.max(...this.chartData().map(c => c.revenue), 1));
  maxChartEnrolls  = computed(() => Math.max(...this.chartData().map(c => c.enrollments), 1));

  ngOnInit(): void { this.fetchAll(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  async fetchAll(silent = false): Promise<void> {
    try {
      if (!silent) this.loading.set(true);
      else         this.refreshing.set(true);
      this.error.set(null);

      const base = this.config.baseUrl;
      const endpoints = [
        `${base}/api/Users/statistics-for-dashboard`,
        `${base}/api/Teacher/admin/statistics`,
        `${base}/api/Courses?pageSize=8`,
        `${base}/api/teacher/earnings/admin/payouts`,
        `${base}/api/Subjects?activeOnly=true&pageSize=10`,
        `${base}/api/TeacherEarning/monthly-revenue`,
        `${base}/api/Enrollments/stats`,
      ];

      const results = await Promise.allSettled(
        endpoints.map(url => firstValueFrom(this.http.get<any>(url)))
      );

      const get = (r: PromiseSettledResult<any>, ...paths: string[]) => {
        if (r.status !== 'fulfilled') return {};
        let d = r.value;
        for (const p of paths) { if (d?.[p] !== undefined) { d = d[p]; break; } }
        return d ?? {};
      };

      const toArray = (r: PromiseSettledResult<any>): any[] => {
        if (r.status !== 'fulfilled') return [];
        const d = r.value;
        if (Array.isArray(d)) return d;
        for (const k of ['data','courses','payouts','subjects','items']) {
          if (Array.isArray(d?.[k])) return d[k];
        }
        return [];
      };

      // 1. User stats
      const userStats    = get(results[0]);
      // 2. Teacher stats
      const teacherStats = get(results[1], 'data');
      // 3. Courses
      const coursesList: CourseItem[]  = toArray(results[2]);
      // 4. Payouts
      const payoutList: PayoutItem[]   = toArray(results[3]);
      // 5. Subjects
      const subjectList: SubjectItem[] = toArray(results[4]);
      // 6. Monthly revenue
      const rawMonthly: MonthlyRow[] = (() => {
        if (results[5].status !== 'fulfilled') return [];
        let m = results[5].value;
        if (!Array.isArray(m)) m = m?.data ?? [];
        if (!Array.isArray(m)) return [];
        return m.map((r: any) => ({
          month: r.month ?? r.name ?? '—',
          revenue: r.grossRevenue ?? r.revenue ?? 0,
          enrollments: r.newStudents ?? r.enrollments ?? 0,
        }));
      })();
      // 7. Enrollment stats
      const enrollData = (() => {
        if (results[6].status !== 'fulfilled') return {};
        const d = results[6].value;
        return d?.data ?? d ?? {};
      })();

      // Derived values
      const totalUsers        = userStats.totalUsers   ?? 0;
      const totalTeachers     = userStats.totalTeachers   ?? teacherStats.totalTeachers ?? 0;
      const totalStudents     = userStats.totalStudents ?? 0;
      const totalAdmins       = userStats.totalAdmins  ?? 0;
      const activeUsers       = userStats.activeUsers  ?? 0;
      const activeSubscriptions = userStats.activeSubscriptions ?? 0;

      const totalRevenue: number =
        teacherStats.totalPlatformRevenue ||
        payoutList.reduce((sum, p) => sum + (p.netAmount ?? p.totalAmount ?? 0), 0);

      const currentMonth = new Date().toLocaleString('default', { month: 'short' });
      const revenueThisMonth: number =
        rawMonthly.find(m => m.month === currentMonth)?.revenue ||
        payoutList
          .filter(p => {
            const d = new Date(p.paidAt || p.createdAt);
            return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
          })
          .reduce((sum, p) => sum + (p.netAmount ?? p.totalAmount ?? 0), 0);

      const monthlyBase: MonthlyRow[] =
        rawMonthly.length > 0 ? rawMonthly : this.emptyMonths();

      const mergedStats: PlatformStats = {
        totalUsers, activeUsers,
        inactiveUsers:        userStats.inactiveUsers ?? 0,
        newUsersThisMonth:    userStats.newUsersThisMonth ?? 0,
        totalTeachers, totalStudents, totalAdmins,
        verifiedTeachers:     teacherStats.verifiedTeachers ?? 0,
        pendingVerifications: teacherStats.pendingVerifications ?? 0,
        totalCourses:         teacherStats.totalCourses ?? coursesList.length,
        publishedCourses:     teacherStats.publishedCourses ?? 0,
        pendingCourses:       teacherStats.pendingCourses ?? 0,
        totalRevenue, revenueThisMonth,
        totalEnrollments:     enrollData.totalEnrollments ?? 0,
        enrollmentsThisMonth: enrollData.enrollmentsThisMonth ?? 0,
        enrollmentsLastMonth: enrollData.enrollmentsLastMonth ?? 0,
        totalPayouts:         payoutList.length,
        pendingPayouts:       payoutList.filter(p => String(p.status) === 'Pending' || String(p.status) === '0').length,
        averageCourseRating:  teacherStats.averageRating ?? 0,
        totalReviews:         teacherStats.totalReviews ?? 0,
        activeSubscriptions,
      };

      this.stats.set(mergedStats);
      this.monthly.set(monthlyBase);
      this.courses.set([...coursesList].sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0)).slice(0, 6));
      this.teachers.set((teacherStats.recentTeachers ?? []).slice(0, 5));
      this.payouts.set(payoutList.slice(0, 6));
      this.subjects.set((subjectList as SubjectItem[]).slice(0, 7));
      this.userDist.set(
        [
          { role: 'Students', count: totalStudents, color: '#6366f1' },
          { role: 'Teachers', count: totalTeachers, color: '#14b8a6' },
          { role: 'Admins',   count: totalAdmins,   color: '#f59e0b' },
        ].filter(d => d.count > 0)
      );
    } catch (err: any) {
      this.error.set(err?.message || 'Failed to load dashboard data');
      if (!silent) {
        this.toast.error(this.transloco.translate('common.errors.loadFailed'));
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  private emptyMonths(): MonthlyRow[] {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (11 - i));
      return { month: d.toLocaleString('default', { month: 'short' }), revenue: 0, enrollments: 0 };
    });
  }

  // ── Formatters ──────────────────────────────────────────────────
  fmtNum(v = 0): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  }

  fmtMoney(v = 0, currency = 'EGP'): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${currency}`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K ${currency}`;
    return `${v.toFixed(0)} ${currency}`;
  }

  fmtDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  pct(part: number, total: number): number {
    return total > 0 ? Math.min((part / total) * 100, 100) : 0;
  }

  // ── Status ──────────────────────────────────────────────────────
  statusConfig(status: string | number): StatusConfig {
    const s = String(status).toLowerCase();
    if (s === 'completed' || s === '2') return { cls: 'green', label: 'Completed' };
    if (s === 'pending'   || s === '0') return { cls: 'amber', label: 'Pending' };
    if (s === 'failed'    || s === '3') return { cls: 'red',   label: 'Failed' };
    return { cls: 'blue', label: String(status) };
  }

  // ── Helpers ─────────────────────────────────────────────────────
  chartColor(i: number): string { return this.COLORS[i % this.COLORS.length]; }
  barPct(v: number): number { return (v / this.maxBarStudents()) * 100; }

  avatarUrl(path: string | undefined, name: string): string {
    if (!path) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true`;
    return path.startsWith('http') ? path : `${this.config.baseUrl}/${path}`;
  }

  allZero(arr: MonthlyRow[], key: keyof MonthlyRow): boolean {
    return arr.every(r => (r[key] as number) === 0);
  }

  // ── Navigation ──────────────────────────────────────────────────
  goTo(path: string): void { this.router.navigate([path]); }
}