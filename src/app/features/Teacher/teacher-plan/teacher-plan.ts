import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }   from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }     from '@angular/common/http';
import { FormsModule }    from '@angular/forms';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RXJSubject } from 'rxjs';
import { APP_CONFIG }     from '../../../core/config/app.config';
import { Toast }          from '../../../core/services/toast';

import { NzSpinModule }     from 'ng-zorro-antd/spin';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule }      from 'ng-zorro-antd/tag';
import { NzSwitchModule }   from 'ng-zorro-antd/switch';
import { NzModalModule }    from 'ng-zorro-antd/modal';
import { NzAlertModule }    from 'ng-zorro-antd/alert';
import { NzInputModule }    from 'ng-zorro-antd/input';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: number;
  userId: string;
  subscriptionPlanId: number;
  subscriptionPlanName: string;
  billingPeriod: number | string;
  monthlyPrice: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  status: string;
  paymentStatus: string;
  autoRenew: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  isExpired?: boolean;
  isCancelled?: boolean;
}

interface PlanResource {
  id: number;
  name: string;
  resourceKey: string;
  limitType: number | string;
  unit: number | string;
  description: string;
  resetFrequency: number;
  maxCount: number;
  isAllowed: boolean;
  isUnlimited: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  limits: any[];
}

interface UsageData {
  resourceId: number;
  used: number;
  total: number;
  percentage: number;
  isUnlimited: boolean;
  nextResetTime?: string;
  lastUsed?: string;
}

interface DisplayResource extends PlanResource {
  used: number;
  total: number;
  percentage: number;
  nextResetTime?: string;
}

interface Feature {
  id: number;
  description: string;
  isPositive: boolean;
  isAvailable: boolean;
  displayOrder: number;
  icon?: string;
}

interface PlanDetail {
  id: number;
  name: string;
  description: string;
  planType: string;
  pricing: { monthly: number; quarterly: number; semiAnnual: number; annual: number };
  currency: string;
  isActive: boolean;
  forStudent: boolean;
  isDefault: boolean;
  features: Feature[];
  resources: PlanResource[];
  activeDiscounts: any[];
  createdAt: string;
}

/** Upgrade request from GET /api/subscription/upgrade-requests */
interface UpgradeRequest {
  id: string;
  currentPlanId: number | null;
  currentPlanName: string;
  newPlanId: number;
  newPlanName: string;
  billingPeriod: string;
  amount: number;
  currency: string;
  status: string;
  upgradeType: string;
  startImmediately: boolean;
  paymentDate: string | null;
  createdAt: string;
  canCancel: boolean;
  canRetry: boolean;
  invoiceKey: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string | number, { en: string; ar: string }> = {
  1:          { en: 'Monthly',     ar: 'شهري' },
  3:          { en: 'Quarterly',   ar: 'ربع سنوي' },
  6:          { en: 'Semi-Annual', ar: 'نصف سنوي' },
  12:         { en: 'Annual',      ar: 'سنوي' },
  Monthly:    { en: 'Monthly',     ar: 'شهري' },
  Quarterly:  { en: 'Quarterly',   ar: 'ربع سنوي' },
  SemiAnnual: { en: 'Semi-Annual', ar: 'نصف سنوي' },
  Annual:     { en: 'Annual',      ar: 'سنوي' },
};

const LIMIT_TYPE_LABELS: Record<string | number, string> = {
  0: 'Daily',  1: 'Weekly',  2: 'Monthly', 3: 'Total',
  4: 'Storage', 5: 'Duration', 6: 'Feature',
  DAILY_COUNT: 'Daily', WEEKLY_COUNT: 'Weekly', MONTHLY_COUNT: 'Monthly',
  TOTAL_COUNT: 'Total', SIZE: 'Storage', DURATION: 'Duration', BOOLEAN: 'Feature',
};

const UNIT_LABELS: Record<string | number, { en: string; ar: string }> = {
  0: { en: '',         ar: '' },
  1: { en: 'Calls',    ar: 'مكالمات' },
  2: { en: 'Messages', ar: 'رسائل' },
  5: { en: 'MB',       ar: 'م.ب' },
  6: { en: 'GB',       ar: 'ج.ب' },
  8: { en: 'Mins',     ar: 'دقيقة' },
  MB: { en: 'MB', ar: 'م.ب' }, GB: { en: 'GB', ar: 'ج.ب' },
  CALLS: { en: 'Calls', ar: 'مكالمات' }, MESSAGES: { en: 'Messages', ar: 'رسائل' },
  MINUTES: { en: 'Mins', ar: 'دقيقة' },
};

const RESOURCE_KEY_ICONS: Record<string, string> = {
  'course.create':                   '📚',
  'advertisement.submit':            '📢',
  'advertisement.max_duration_days': '⏳',
  'advertisement.active_slots':      '📋',
  CHAT_ACCESS:                       '💬',
  STORAGE:                           '☁️',
  AI_CALLS:                          '🤖',
  CHAT_MESSAGES:                     '💬',
  API_CALLS:                         '⚙️',
};

function getProgressColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#4f6ef7';
}

function formatCountdown(dateStr: string | undefined, lang: 'en' | 'ar'): string {
  if (!dateStr) return '';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return lang === 'ar' ? 'قريباً' : 'Soon';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return lang === 'ar' ? `خلال ${d} يوم` : `in ${d}d`;
  return lang === 'ar' ? `خلال ${h} ساعة` : `in ${h}h`;
}

function getLimitTypeDisplay(limitType: number | string): string {
  const type = typeof limitType === 'number' ? limitType : String(limitType).toUpperCase();
  return LIMIT_TYPE_LABELS[type] ?? String(limitType);
}

function calcDaysRemaining(endDateStr: string): number {
  const end = new Date(endDateStr);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

function isCapResource(resource: PlanResource): boolean {
  return (
    resource.limitType === 3 ||
    String(resource.limitType).toUpperCase() === 'TOTAL_COUNT' ||
    String(resource.limitType).toUpperCase() === 'TOTAL'
  );
}

// ── Upgrade-request status helpers ────────────────────────────────────────────

const UPGRADE_STATUS_CONFIG: Record<string, {
  cls: string; icon: string;
  en: string; ar: string;
}> = {
  PendingPayment:   { cls: 'amber',  icon: '💳', en: 'Pending Payment',   ar: 'في انتظار الدفع' },
  PaymentPending:   { cls: 'amber',  icon: '⏳', en: 'Payment Pending',   ar: 'الدفع معلّق' },
  PaymentCompleted: { cls: 'blue',   icon: '✓',  en: 'Payment Completed', ar: 'تم الدفع' },
  Processing:       { cls: 'blue',   icon: '⚙️', en: 'Processing',        ar: 'قيد المعالجة' },
  Scheduled:        { cls: 'purple', icon: '📅', en: 'Scheduled',         ar: 'مجدول' },
  Completed:        { cls: 'green',  icon: '✓',  en: 'Completed',         ar: 'مكتمل' },
  Cancelled:        { cls: 'grey',   icon: '⊘',  en: 'Cancelled',         ar: 'ملغى' },
  PaymentFailed:    { cls: 'red',    icon: '✗',  en: 'Payment Failed',    ar: 'فشل الدفع' },
  Refunded:         { cls: 'grey',   icon: '↩',  en: 'Refunded',          ar: 'مسترجع' },
};

const UPGRADE_TYPE_CONFIG: Record<string, { en: string; ar: string }> = {
  New:           { en: 'New Subscription', ar: 'اشتراك جديد' },
  Upgrade:       { en: 'Upgrade',          ar: 'ترقية' },
  Downgrade:     { en: 'Downgrade',        ar: 'تخفيض' },
  Switch:        { en: 'Plan Switch',      ar: 'تغيير الخطة' },
  BillingChange: { en: 'Billing Change',   ar: 'تغيير فترة الفوترة' },
};

/** Statuses that represent an in-progress / actionable request */
const ACTIVE_STATUSES = new Set([
  'PendingPayment', 'PaymentPending', 'PaymentCompleted', 'Processing', 'Scheduled',
]);

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-my-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    NzSpinModule,
    NzProgressModule,
    NzTagModule,
    NzSwitchModule,
    NzModalModule,
    NzAlertModule,
    NzInputModule,
  ],
  templateUrl: './teacher-plan.html',
  styleUrls: ['./teacher-plan.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherPlan' },
  ],
})
export class TeacherPlan implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RXJSubject<void>();

  // ── State signals ──────────────────────────────────────────────────────────
  loading         = signal(true);
  subscription    = signal<Subscription | null>(null);
  resources       = signal<DisplayResource[]>([]);
  planDetail      = signal<PlanDetail | null>(null);
  togglingAR      = signal(false);
  upgradeRequests = signal<UpgradeRequest[]>([]);

  cancelModal = signal<{ visible: boolean; loading: boolean; reason: string }>({
    visible: false, loading: false, reason: '',
  });

  cancelUpgradeModal = signal<{
    visible: boolean; loading: boolean; requestId: string | null;
  }>({ visible: false, loading: false, requestId: null });

  // ── Derived ────────────────────────────────────────────────────────────────
  lang = computed<'en' | 'ar'>(() =>
    (this.transloco.getActiveLang() === 'ar') ? 'ar' : 'en'
  );

  dir = computed(() => this.lang() === 'ar' ? 'rtl' : 'ltr');

  billingLabel = computed(() => {
    const sub = this.subscription();
    return sub ? (BILLING_LABELS[sub.billingPeriod]?.[this.lang()] || '-') : '-';
  });

  daysLeft = computed(() => {
    const sub = this.subscription();
    if (!sub) return 0;
    if (sub.endDate) return calcDaysRemaining(sub.endDate);
    return sub.daysRemaining ?? 0;
  });

  isExpiring = computed(() => {
    const d = this.daysLeft();
    return d <= 7
      && this.subscription()?.status === 'Active'
      && !(this.subscription()?.isExpired ?? false)
      && !(this.subscription()?.isCancelled ?? false);
  });

  isExpired = computed(() => {
    const sub = this.subscription();
    if (!sub) return false;
    if (sub.isExpired === true) return true;
    if (sub.status === 'Expired') return true;
    return this.daysLeft() <= 0 && sub.status !== 'Active';
  });

  sortedFeatures = computed(() =>
    [...(this.planDetail()?.features ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  );

  /** Requests that are not yet terminal (completed / cancelled / expired) */
  activeUpgradeRequests = computed(() =>
    this.upgradeRequests().filter(r => ACTIVE_STATUSES.has(r.status))
  );

  // ── Payment-success from query-param ──────────────────────────────────────
  paymentOk = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.paymentOk = qp.get('payment') === 'success';
    this.fetchData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  async fetchData(): Promise<void> {
    this.loading.set(true);
    try {
      const base = this.config.baseUrl;

      // 1. Current subscription + upgrade requests in parallel
      const [subRes, upgradeRes] = await Promise.all([
        firstValueFrom(
          this.http.get<any>(`${base}/api/subscription/current`)
        ).catch(() => null),
        firstValueFrom(
          this.http.get<any>(`${base}/api/subscription/upgrade-requests`)
        ).catch(() => null),
      ]);

      const sub: Subscription | null = subRes?.success ? subRes.data : null;
      this.subscription.set(sub);

      // Store upgrade requests — all of them, filtering is done in the template
      const requestsList: UpgradeRequest[] =
        upgradeRes?.data?.requests ?? upgradeRes?.data ?? [];
      this.upgradeRequests.set(requestsList);

      // 2. Plan detail + usage (only when subscription exists)
      if (sub) {
        const planRes = await firstValueFrom(
          this.http.get<any>(`${base}/api/subscriptionplans/${sub.subscriptionPlanId}`)
        ).catch(() => null);

        if (planRes?.success || planRes?.id) {
          const planData: PlanDetail = planRes?.data ?? planRes;
          this.planDetail.set(planData);

          const usageRes = await firstValueFrom(
            this.http.get<any>(`${base}/api/subscription/usage`)
          ).catch(() => null);

          const usageMap = new Map<number, UsageData>();
          if (usageRes?.success && Array.isArray(usageRes.data)) {
            (usageRes.data as UsageData[]).forEach(u => usageMap.set(u.resourceId, u));
          }

          const planResources: PlanResource[] = planData.resources ?? [];
          const combinedResources: DisplayResource[] = planResources.map(r => {
            const usage = usageMap.get(r.id);
            let used = 0, total = r.isUnlimited ? 0 : (r.maxCount ?? 0), percentage = 0;

            if (!r.isUnlimited && !isCapResource(r)) {
              used       = usage?.used  ?? 0;
              total      = usage?.total ?? r.maxCount ?? 0;
              percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            } else if (isCapResource(r)) {
              used       = usage?.used ?? 0;
              total      = r.maxCount ?? 0;
              percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            }

            return { ...r, used, total, percentage, nextResetTime: usage?.nextResetTime };
          });

          combinedResources.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          this.resources.set(combinedResources);
        } else {
          this.resources.set([]);
        }
      } else {
        this.resources.set([]);
        this.planDetail.set(null);
      }

    } catch (error) {
      console.error('Error fetching plan data:', error);
      this.toast.error(this.t('errorLoading'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Auto-renew ─────────────────────────────────────────────────────────────
  async handleToggleAutoRenew(): Promise<void> {
    const sub = this.subscription();
    if (!sub) return;
    this.togglingAR.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/subscription/toggle-auto-renew`, {
          autoRenew: !sub.autoRenew,
        })
      );
      if (res.success) {
        this.subscription.update(s => s ? { ...s, autoRenew: !s.autoRenew } : s);
        this.toast.success(this.t('autoRenewUpdated'));
      }
    } catch {
      this.toast.error(this.t('errorUpdating'));
    } finally {
      this.togglingAR.set(false);
    }
  }

  // ── Cancel subscription modal ──────────────────────────────────────────────
  openCancelModal(): void {
    this.cancelModal.set({ visible: true, loading: false, reason: '' });
  }

  closeCancelModal(): void {
    this.cancelModal.set({ visible: false, loading: false, reason: '' });
  }

  updateCancelReason(reason: string): void {
    this.cancelModal.update(p => ({ ...p, reason }));
  }

  async handleCancel(): Promise<void> {
    const reason = this.cancelModal().reason.trim();
    if (!reason || reason.length < 10) {
      this.toast.warning(
        this.lang() === 'ar'
          ? 'يجب أن يكون السبب 10 أحرف على الأقل'
          : 'Reason must be at least 10 characters'
      );
      return;
    }
    this.cancelModal.update(p => ({ ...p, loading: true }));
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/subscription/cancel`, {
          reason, immediate: false,
        })
      );
      if (res.success) {
        this.toast.success(this.t('cancelSuccess'));
        this.closeCancelModal();
        await this.fetchData();
      } else {
        this.toast.error(res.message);
        this.cancelModal.update(p => ({ ...p, loading: false }));
      }
    } catch {
      this.cancelModal.update(p => ({ ...p, loading: false }));
    }
  }

  // ── Cancel upgrade-request modal ──────────────────────────────────────────
  openCancelUpgradeModal(requestId: string): void {
    this.cancelUpgradeModal.set({ visible: true, loading: false, requestId });
  }

  closeCancelUpgradeModal(): void {
    this.cancelUpgradeModal.set({ visible: false, loading: false, requestId: null });
  }

  async handleCancelUpgradeRequest(): Promise<void> {
    const requestId = this.cancelUpgradeModal().requestId;
    if (!requestId) return;

    this.cancelUpgradeModal.update(s => ({ ...s, loading: true }));
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/subscription/cancel-upgrade`, {
          upgradeRequestId: requestId,
        })
      );
      if (res.success) {
        this.toast.success(
          this.lang() === 'ar' ? 'تم إلغاء الطلب بنجاح' : 'Request cancelled successfully'
        );
        this.closeCancelUpgradeModal();
        // Refresh to reflect the new status
        await this.fetchData();
      } else {
        this.toast.error(
          res.message ||
          (this.lang() === 'ar' ? 'فشل إلغاء الطلب' : 'Failed to cancel request')
        );
        this.cancelUpgradeModal.update(s => ({ ...s, loading: false }));
      }
    } catch {
      this.toast.error(
        this.lang() === 'ar' ? 'حدث خطأ' : 'An error occurred'
      );
      this.cancelUpgradeModal.update(s => ({ ...s, loading: false }));
    }
  }

  resumePayment(request: UpgradeRequest): void {
    if (request.invoiceKey) {
      // invoiceKey holds the payment URL in the current backend implementation
      window.location.href = request.invoiceKey;
    } else {
      this.toast.warning(
        this.lang() === 'ar' ? 'رابط الدفع غير متاح' : 'Payment link not available'
      );
    }
  }

  // ── Upgrade-request display helpers ───────────────────────────────────────
  getUpgradeStatusCls(status: string): string {
    return UPGRADE_STATUS_CONFIG[status]?.cls ?? 'grey';
  }

  getUpgradeStatusIcon(status: string): string {
    return UPGRADE_STATUS_CONFIG[status]?.icon ?? '•';
  }

  getUpgradeStatusLabel(status: string): string {
    const cfg = UPGRADE_STATUS_CONFIG[status];
    if (!cfg) return status;
    return this.lang() === 'ar' ? cfg.ar : cfg.en;
  }

  getUpgradeTypeLabel(type: string): string {
    const cfg = UPGRADE_TYPE_CONFIG[type];
    if (!cfg) return type;
    return this.lang() === 'ar' ? cfg.ar : cfg.en;
  }

  isActiveRequest(request: UpgradeRequest): boolean {
    return ACTIVE_STATUSES.has(request.status);
  }

  isPendingPayment(request: UpgradeRequest): boolean {
    return request.status === 'PendingPayment' || request.status === 'PaymentPending';
  }

  formatUpgradeDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(
      this.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' }
    );
  }

  // ── Status config (subscription) ──────────────────────────────────────────
  getStatusCls(status: string): string {
    const map: Record<string, string> = {
      Active: 'active', Expired: 'expired',
      Cancelled: 'cancelled', PendingCancellation: 'pending',
    };
    return map[status] ?? 'active';
  }

  getStatusLabel(status: string): string {
    if (this.lang() === 'ar') {
      const map: Record<string, string> = {
        Active: 'نشط', Expired: 'منتهي',
        Cancelled: 'ملغى', PendingCancellation: 'قيد الإلغاء',
      };
      return map[status] ?? status;
    }
    return status;
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      Active: '✓', Expired: '✗', Cancelled: '⊘', PendingCancellation: '⏱',
    };
    return map[status] ?? '✓';
  }

  // ── Resource helpers ──────────────────────────────────────────────────────
  getResourceIcon(key: string): string {
    const normalized = key?.toUpperCase?.() ?? '';
    return RESOURCE_KEY_ICONS[key] ?? RESOURCE_KEY_ICONS[normalized] ?? '🗄️';
  }

  getProgressColor(pct: number): string { return getProgressColor(pct); }

  getProgressPercent(resource: DisplayResource): number {
    if (resource.isUnlimited) return 0;
    return Math.min(100, Math.round(resource.percentage || 0));
  }

  getUnitLabel(unit: number | string): string {
    return UNIT_LABELS[unit]?.[this.lang()] ?? '';
  }

  getLimitTypeLabel(limitType: number | string): string {
    return getLimitTypeDisplay(limitType);
  }

  isBoolean(resource: DisplayResource): boolean {
    return (
      resource.limitType === 6 ||
      resource.limitType === 'BOOLEAN' ||
      String(resource.limitType).toUpperCase() === 'BOOLEAN'
    );
  }

  isCap(resource: DisplayResource): boolean {
    return isCapResource(resource);
  }

  getCountdown(resource: DisplayResource): string {
    return formatCountdown(resource.nextResetTime, this.lang());
  }

  isResourceWarning(resource: DisplayResource): boolean {
    if (resource.isUnlimited || this.isCap(resource)) return false;
    return this.getProgressPercent(resource) >= 70;
  }

  isResourceNearLimit(resource: DisplayResource): boolean {
    if (resource.isUnlimited || this.isCap(resource)) return false;
    return this.getProgressPercent(resource) >= 90;
  }

  // ── End date formatting ────────────────────────────────────────────────────
  formatEndDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(
      this.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' }
    );
  }

  // ── i18n helper ────────────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`myPlan.${key}`);
  }
}