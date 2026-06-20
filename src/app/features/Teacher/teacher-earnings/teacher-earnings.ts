import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, RefreshCw, Download, Wallet, DollarSign,
  BarChart2, History, Eye, CheckCircle, Clock, AlertCircle,
  Loader, TrendingUp, TrendingDown, Building2, Users,
  Phone, Info, Globe, Send, X, Filter, Zap,
  ChevronRight
} from 'lucide-angular';

import { NzSpinModule }         from 'ng-zorro-antd/spin';
import { NzTableModule }        from 'ng-zorro-antd/table';
import { NzTagModule }          from 'ng-zorro-antd/tag';
import { NzTooltipModule }      from 'ng-zorro-antd/tooltip';
import { NzModalModule }        from 'ng-zorro-antd/modal';
import { NzSelectModule }       from 'ng-zorro-antd/select';
import { NzInputModule }        from 'ng-zorro-antd/input';
import { NzInputNumberModule }  from 'ng-zorro-antd/input-number';
import { NzProgressModule }     from 'ng-zorro-antd/progress';
import { NzAvatarModule }       from 'ng-zorro-antd/avatar';
import { NzAlertModule }        from 'ng-zorro-antd/alert';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule }      from 'ng-zorro-antd/divider';
import { NzDrawerModule }       from 'ng-zorro-antd/drawer';
import { NzButtonModule }       from 'ng-zorro-antd/button';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService }     from 'ng-zorro-antd/message';
import { NzFormModule }         from 'ng-zorro-antd/form';
import { NzDatePickerModule }   from 'ng-zorro-antd/date-picker';

import { APP_CONFIG } from '../../../core/config/app.config';

// ── Types ────────────────────────────────────────────────────────────
interface EarningStats {
  pendingEarnings?: number;
  totalEarnings?: number;
  totalPaidOut?: number;
  platformFees?: number;
  availableBalance?: number;
  lastMonthEarnings?: number;
  thisMonthEarnings?: number;
  totalCourses?: number;
  totalEnrollments?: number;
  averageEarningPerCourse?: number;
  monthlyBreakdown?: MonthlyBreakdown[];
}

interface MonthlyBreakdown {
  monthYear?: string;
  month?: string;
  netEarnings: number;
  enrollments: number;
}

interface Earning {
  id: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  amount: number;
  platformFee: number;
  platformFeePercentage?: number;
  netAmount: number;
  status: number;
  createdAt: string;
  paidAt?: string | null;
  payoutId?: string;
}

interface Payout {
  id: string;
  totalAmount: number;
  netAmount: number;
  payoutMethod: string;
  recipentNumber?: string;
  status: number;
  rejectionReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

interface Course {
  id: string;
  title: string;
}

interface Settings {
  minimumPayoutAmount?: number;
  platformFeePercentage?: number;
  payoutCooldownDays?: number;
}

interface MonthlyRevenueData {
  month: string;
  grossRevenue: number;
  newStudents: number;
}

// ── Constants ─────────────────────────────────────────────────────────
export const WALLET_METHODS = [
  { value: 'vodafone_cash', label: 'Vodafone Cash', hint: 'Send to Vodafone Cash wallet', placeholder: '01XXXXXXXXX', color: '#e2001a', abbr: 'VC' },
  { value: 'instapay',      label: 'InstaPay',      hint: 'Send via InstaPay',             placeholder: 'yourname@instapay', color: '#1a73e8', abbr: 'IP' },
  { value: 'orange_money',  label: 'Orange Money',  hint: 'Send to Orange Money wallet',   placeholder: '01XXXXXXXXX', color: '#ff6600', abbr: 'OM' },
  { value: 'etisalat_cash', label: 'Etisalat Cash', hint: 'Send to Etisalat Cash wallet',  placeholder: '01XXXXXXXXX', color: '#006633', abbr: 'EC' },
  { value: 'we_pay',        label: 'WE Pay',        hint: 'Send to WE Pay wallet',         placeholder: '01XXXXXXXXX', color: '#8b1a8b', abbr: 'WE' },
];

export const STATUS_MAP: Record<number, { color: string; label: string; tagColor: string }> = {
  0: { color: 'warning',    label: 'Pending',    tagColor: 'orange' },
  1: { color: 'processing', label: 'Processing', tagColor: 'blue'   },
  2: { color: 'success',    label: 'Completed',  tagColor: 'green'  },
  3: { color: 'error',      label: 'Failed',     tagColor: 'red'    },
};

@Component({
  selector: 'app-teacher-earnings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslocoModule,
    LucideAngularModule,
    NzSpinModule, NzTableModule, NzTagModule, NzTooltipModule,
    NzModalModule, NzSelectModule, NzInputModule, NzInputNumberModule,
    NzProgressModule, NzAvatarModule, NzAlertModule, NzDescriptionsModule,
    NzDividerModule, NzDrawerModule, NzButtonModule,
    NzFormModule, NzDatePickerModule,
  ],
  templateUrl: './teacher-earnings.html',
  styleUrls:   ['./teacher-earnings.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherEarnings' },
  ],
})
export class TeacherEarnings implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private notify    = inject(NzNotificationService);
  private msg       = inject(NzMessageService);
  private transloco = inject(TranslocoService);
  private fb        = inject(FormBuilder);

  private destroy$ = new Subject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon   = ArrowLeft;
  readonly RefreshIcon     = RefreshCw;
  readonly DownloadIcon    = Download;
  readonly WalletIcon      = Wallet;
  readonly DollarIcon      = DollarSign;
  readonly BarChartIcon    = BarChart2;
  readonly HistoryIcon     = History;
  readonly EyeIcon         = Eye;
  readonly CheckIcon       = CheckCircle;
  readonly ClockIcon       = Clock;
  readonly AlertIcon       = AlertCircle;
  readonly LoaderIcon      = Loader;
  readonly TrendUpIcon     = TrendingUp;
  readonly TrendDownIcon   = TrendingDown;
  readonly BuildingIcon    = Building2;
  readonly UsersIcon       = Users;
  readonly PhoneIcon       = Phone;
  readonly InfoIcon        = Info;
  readonly GlobeIcon       = Globe;
  readonly SendIcon        = Send;
  readonly XIcon           = X;
  readonly FilterIcon      = Filter;
  readonly ZapIcon         = Zap;
  readonly ChevRightIcon   = ChevronRight;

  // ── Constants exposed to template ─────────────────────────────────
  readonly walletMethods = WALLET_METHODS;
  readonly statusMap     = STATUS_MAP;

  // ── State ──────────────────────────────────────────────────────────
  loading         = signal(true);
  payoutLoading   = signal(false);
  detailLoading   = signal(false);

  stats           = signal<EarningStats>({});
  earnings        = signal<Earning[]>([]);
  payouts         = signal<Payout[]>([]);
  monthlyData     = signal<MonthlyRevenueData[]>([]);
  courses         = signal<Course[]>([]);
  settings        = signal<Settings>({});

  activeTab       = signal<'history' | 'payouts'>('history');
  sidebarOpen     = signal(false);

  // Filters
  filterSearch    = signal('');
  filterCourse    = signal<string>('all');
  filterStatus    = signal<string>('all');
  filterDateRange = signal<[Date, Date] | null>(null);

  // Modals
  payoutModalOpen   = signal(false);
  detailModalOpen   = signal(false);
  selectedEarning   = signal<Earning | null>(null);
  selectedMethod    = signal('vodafone_cash');

  // Payout form
  payoutForm!: FormGroup;

  // ── Computed ───────────────────────────────────────────────────────
  cv = computed(() => {
    const s    = this.stats();
    const sets = this.settings();
    const available = s.availableBalance ?? s.pendingEarnings ?? 0;
    const minimum   = sets.minimumPayoutAmount ?? 40;
    const canWithdraw = available >= minimum;
    const prev   = s.lastMonthEarnings ?? 0;
    const curr   = s.thisMonthEarnings ?? 0;
    const growth = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    return {
      available,
      total:      s.totalEarnings ?? 0,
      paidOut:    s.totalPaidOut  ?? 0,
      fees:       s.platformFees  ?? 0,
      minimum, canWithdraw, growth, curr, prev,
    };
  });

  progressPct = computed(() =>
    Math.min(100, Math.round((this.cv().available / this.cv().minimum) * 100))
  );

  showWelcome = computed(() =>
    this.cv().available === 0 && this.cv().total === 0
  );

  maxRevenue = computed(() => {
    const data = this.monthlyData();
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.grossRevenue), 1);
  });

  statCards = computed(() => {
    const s  = this.stats();
    const cv = this.cv();
    return [
      { icon: this.BuildingIcon, cls: 'blue',   label: this.t('total_courses',   'Your Courses'),     val: s.totalCourses ?? 0,               noMoney: true  },
      { icon: this.UsersIcon,    cls: 'green',   label: this.t('total_students',  'Total Students'),   val: s.totalEnrollments ?? 0,           noMoney: true  },
      { icon: this.BarChartIcon, cls: 'amber',   label: this.t('avg_per_course',  'Avg / Course'),     val: s.averageEarningPerCourse ?? 0,    noMoney: false },
      { icon: this.DollarIcon,   cls: 'red',     label: this.t('platform_fees',   'Platform Fees'),    val: s.platformFees ?? 0,               noMoney: false },
      {
        icon:   cv.growth >= 0 ? this.TrendUpIcon : this.TrendDownIcon,
        cls:    'purple',
        label:  this.t('this_month', 'This Month'),
        val:    s.thisMonthEarnings ?? 0,
        noMoney: false,
        sub:    cv.growth >= 0 ? `▲ +${cv.growth.toFixed(1)}%` : `▼ ${cv.growth.toFixed(1)}%`,
        subCls: cv.growth >= 0 ? 'up' : 'down',
      },
      { icon: this.WalletIcon, cls: 'cyan', label: this.t('total_earned', 'Total Earned'), val: cv.total, noMoney: false },
    ];
  });

  filteredEarnings = computed(() => {
    const search  = this.filterSearch().toLowerCase();
    const course  = this.filterCourse();
    const status  = this.filterStatus();
    const range   = this.filterDateRange();

    return this.earnings().filter(e => {
      if (course !== 'all' && e.courseId !== course) return false;
      if (status !== 'all' && String(e.status) !== status) return false;
      if (range?.[0] && range?.[1]) {
        const d  = new Date(e.createdAt).getTime();
        const s  = range[0].setHours(0, 0, 0, 0);
        const en = range[1].setHours(23, 59, 59, 999);
        if (d < s || d > en) return false;
      }
      if (search) {
        if (!e.courseTitle?.toLowerCase().includes(search) &&
            !e.studentName?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  });

  selectedMethodInfo = computed(() =>
    WALLET_METHODS.find(m => m.value === this.selectedMethod()) ?? WALLET_METHODS[0]
  );

  statusEntries = computed(() =>
    Object.entries(STATUS_MAP).map(([k, v]) => ({ key: k, label: v.label }))
  );

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.payoutForm = this.fb.group({
      amount:         [0, [Validators.required, Validators.min(1)]],
      method:         ['vodafone_cash', Validators.required],
      recipentNumber: ['', Validators.required],
      notes:          [''],
    });

    this.fetchAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data fetching ──────────────────────────────────────────────────
  async fetchAllData(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.fetchStats(),
        this.fetchEarnings(),
        this.fetchPayouts(),
        this.fetchCourses(),
        this.fetchSettings(),
        this.fetchMonthlyData(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchStats(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/earnings/summary`)
      );
      if (res?.success) this.stats.set(res.data ?? {});
    } catch { /* non-fatal */ }
  }

  async fetchEarnings(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/earnings/report?page=1&pageSize=200`)
      );
      if (res?.success) this.earnings.set(res.data?.earnings ?? []);
    } catch { /* non-fatal */ }
  }

  async fetchPayouts(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/earnings/payouts`)
      );
      if (res?.success) this.payouts.set(res.data ?? []);
    } catch { /* non-fatal */ }
  }

  async fetchCourses(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/courses/instructor-courses-list`)
      );
      if (res?.success) this.courses.set(res.data ?? []);
    } catch { /* non-fatal */ }
  }

  async fetchSettings(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/earnings/settings`)
      );
      if (res?.success) this.settings.set(res.data ?? {});
    } catch { /* non-fatal */ }
  }

  async fetchMonthlyData(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/TeacherEarning/monthly-revenue`)
      );
      if (res?.success) this.monthlyData.set(res.data ?? []);
    } catch { /* non-fatal */ }
  }

  // ── Handlers ───────────────────────────────────────────────────────
  onRefresh(): void {
    this.resetFilters();
    this.fetchAllData();
    this.msg.success(this.t('data_refreshed', 'Refreshed'));
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterCourse.set('all');
    this.filterStatus.set('all');
    this.filterDateRange.set(null);
  }

  openWithdrawal(): void {
    const cv = this.cv();
    this.payoutForm.patchValue({ amount: cv.available, method: 'vodafone_cash' });
    this.selectedMethod.set('vodafone_cash');
    this.payoutModalOpen.set(true);
  }

  closeWithdrawal(): void {
    this.payoutModalOpen.set(false);
    this.payoutForm.reset({ method: 'vodafone_cash' });
  }

  selectMethod(value: string): void {
    this.selectedMethod.set(value);
    this.payoutForm.patchValue({ method: value });
  }

  setQuickFill(pct: number): void {
    const amt = Math.floor((this.cv().available * pct) / 100);
    this.payoutForm.patchValue({ amount: amt });
  }

  async submitWithdrawal(): Promise<void> {
    if (this.payoutForm.invalid) {
      Object.values(this.payoutForm.controls).forEach(c => { c.markAsDirty(); c.updateValueAndValidity(); });
      return;
    }
    this.payoutLoading.set(true);
    try {
      const vals = this.payoutForm.value;
      const res  = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/teacher/earnings/payouts/request`, {
          amount:          vals.amount,
          payoutMethod:    vals.method,
          recipientNumber: vals.recipentNumber,
          notes:           vals.notes ?? '',
        })
      );
      if (res?.success) {
        this.msg.success(this.t('withdrawal_submitted', 'Withdrawal request submitted'));
        this.closeWithdrawal();
        this.fetchAllData();
      }
    } catch (err: any) {
      this.notify.error(
        this.t('error', 'Error'),
        err?.error?.message ?? this.t('withdrawal_failed', 'Failed')
      );
    } finally {
      this.payoutLoading.set(false);
    }
  }

  async viewDetails(id: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailModalOpen.set(true);
    this.selectedEarning.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/teacher/earnings/${id}`)
      );
      if (res?.success) this.selectedEarning.set(res.data);
    } catch {
      this.msg.error(this.t('could_not_load_details', 'Could not load details'));
      this.detailModalOpen.set(false);
    } finally {
      this.detailLoading.set(false);
    }
  }

  closeDetail(): void {
    this.detailModalOpen.set(false);
    this.selectedEarning.set(null);
  }

  exportCSV(): void {
    const rows = [
      ['Date', 'Course', 'Student', 'Gross', 'Fee', 'Net', 'Status'],
      ...this.filteredEarnings().map(e => [
        new Date(e.createdAt).toLocaleDateString(),
        e.courseTitle, e.studentName,
        String(e.amount), String(e.platformFee), String(e.netAmount),
        STATUS_MAP[e.status]?.label ?? String(e.status),
      ]),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `earnings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.msg.success(this.t('export_started', 'Export started'));
  }

  // ── Helpers ────────────────────────────────────────────────────────
  fmtMoney(n: number | null | undefined): string {
    return `EGP ${Number(n ?? 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatDateTime(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  initial(name: string): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  walletLabel(value: string): string {
    return WALLET_METHODS.find(m => m.value === value)?.label ?? value;
  }

  walletColor(value: string): string {
    return WALLET_METHODS.find(m => m.value === value)?.color ?? '#888';
  }

  walletAbbr(value: string): string {
    return WALLET_METHODS.find(m => m.value === value)?.abbr ?? '??';
  }

  statusLabel(status: number): string {
    return STATUS_MAP[status]?.label ?? String(status);
  }

  statusTagColor(status: number): string {
    return STATUS_MAP[status]?.tagColor ?? 'default';
  }

  goBack(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  // ── Amount Formatter/Parser for nz-input-number ────────────────────
  formatAmount = (value: number): string => {
    if (value === null || value === undefined) return '';
    return `EGP ${value.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  parseAmount = (value: string): number => {
    const cleaned = value?.replace(/EGP\s?|(,*)/g, '') || '';
    return cleaned ? Number(cleaned) : 0;
  };

  // ── TrackBy functions ──────────────────────────────────────────────
  trackById(_: number, item: { id: string | number }): string | number {
    return item.id;
  }

  trackByValue(_: number, item: { value: string }): string {
    return item.value;
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  // ── Translation helper ─────────────────────────────────────────────
  t(key: string, fallback = key): string {
    const result = this.transloco.translate(`teacherEarnings.${key}`);
    return result && result !== `teacherEarnings.${key}` ? result : fallback;
  }
}