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

// API resource from plan detail endpoint
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

// API usage from usage endpoint
interface UsageData {
  resourceId: number;
  used: number;
  total: number;
  percentage: number;
  isUnlimited: boolean;
  nextResetTime?: string;
  lastUsed?: string;
}

// Combined resource for display
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
  0: 'Daily',
  1: 'Weekly',
  2: 'Monthly',
  3: 'Total',
  4: 'Storage',
  5: 'Duration',
  6: 'Feature',
  DAILY_COUNT:   'Daily',
  WEEKLY_COUNT:  'Weekly',
  MONTHLY_COUNT: 'Monthly',
  TOTAL_COUNT:   'Total',
  SIZE:          'Storage',
  DURATION:      'Duration',
  BOOLEAN:       'Feature',
};

const UNIT_LABELS: Record<string | number, { en: string; ar: string }> = {
  0: { en: '',         ar: '' },
  1: { en: 'Calls',    ar: 'مكالمات' },
  2: { en: 'Messages', ar: 'رسائل' },
  5: { en: 'MB',       ar: 'م.ب' },
  6: { en: 'GB',       ar: 'ج.ب' },
  8: { en: 'Mins',     ar: 'دقيقة' },
  MB:       { en: 'MB',       ar: 'م.ب' },
  GB:       { en: 'GB',       ar: 'ج.ب' },
  CALLS:    { en: 'Calls',    ar: 'مكالمات' },
  MESSAGES: { en: 'Messages', ar: 'رسائل' },
  MINUTES:  { en: 'Mins',     ar: 'دقيقة' },
};

const RESOURCE_KEY_ICONS: Record<string, string> = {
  'course.create':                      '📚',
  'advertisement.submit':               '📢',
  'advertisement.max_duration_days':    '⏳',
  'advertisement.active_slots':         '📋',
  'CHAT_ACCESS':                        '💬',
  STORAGE:                              '☁️',
  AI_CALLS:                             '🤖',
  CHAT_MESSAGES:                        '💬',
  API_CALLS:                            '⚙️',
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

/**
 * Calculate days remaining from endDate string.
 * The backend may return daysRemaining: 0 even for active subscriptions
 * so we always derive it from endDate when it is available.
 */
function calcDaysRemaining(endDateStr: string): number {
  const end  = new Date(endDateStr);
  const now  = new Date();
  // Zero out time components to compare whole days
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  return Math.max(0, diff);
}

/**
 * Returns true when a resource acts as a hard cap / allowance value
 * rather than a consumable quota. limitType === 3 (Total/capacity)
 * resources like max_duration_days and active_slots display their
 * maxCount as a ceiling, not a usage bar.
 */
function isCapResource(resource: PlanResource): boolean {
  return resource.limitType === 3
    || String(resource.limitType).toUpperCase() === 'TOTAL_COUNT'
    || String(resource.limitType).toUpperCase() === 'TOTAL';
}

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
  loading      = signal(true);
  subscription = signal<Subscription | null>(null);
  resources    = signal<DisplayResource[]>([]);
  planDetail   = signal<PlanDetail | null>(null);
  togglingAR   = signal(false);

  cancelModal = signal<{ visible: boolean; loading: boolean; reason: string }>({
    visible: false, loading: false, reason: '',
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  lang = computed<'en' | 'ar'>(() =>
    (this.transloco.getActiveLang() === 'ar') ? 'ar' : 'en'
  );

  dir = computed(() => this.lang() === 'ar' ? 'rtl' : 'ltr');

  billingLabel = computed(() => {
    const sub = this.subscription();
    return sub ? (BILLING_LABELS[sub.billingPeriod]?.[this.lang()] || '-') : '-';
  });

  /**
   * Always derive daysLeft from endDate so the UI stays accurate
   * even when the backend returns daysRemaining: 0 for active subs.
   */
  daysLeft = computed(() => {
    const sub = this.subscription();
    if (!sub) return 0;
    if (sub.endDate) return calcDaysRemaining(sub.endDate);
    return sub.daysRemaining ?? 0;
  });

  isExpiring = computed(() => {
    const d = this.daysLeft();
    return d <= 7 && this.subscription()?.status === 'Active'
      && !(this.subscription()?.isExpired ?? false)
      && !(this.subscription()?.isCancelled ?? false);
  });

  isExpired = computed(() => {
    const sub = this.subscription();
    if (!sub) return false;
    // Trust the server-side isExpired flag first; fall back to days calculation
    if (sub.isExpired === true) return true;
    if (sub.status === 'Expired') return true;
    return this.daysLeft() <= 0 && sub.status !== 'Active';
  });

  sortedFeatures = computed(() =>
    [...(this.planDetail()?.features ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
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

      // 1. Get current subscription
      const subRes = await firstValueFrom(
        this.http.get<any>(`${base}/api/subscription/current`)
      ).catch(() => null);

      const sub: Subscription | null = subRes?.success ? subRes.data : null;
      this.subscription.set(sub);

      // 2. If subscription exists, get plan details
      if (sub) {
        const planRes = await firstValueFrom(
          this.http.get<any>(`${base}/api/subscriptionplans/${sub.subscriptionPlanId}`)
        ).catch(() => null);

        if (planRes?.success || planRes?.id) {
          const planData: PlanDetail = planRes?.data ?? planRes;
          this.planDetail.set(planData);

          // 3. Attempt to get usage data (non-fatal if endpoint is unavailable)
          const usageRes = await firstValueFrom(
            this.http.get<any>(`${base}/api/subscription/usage`)
          ).catch(() => null);

          // Build usage map keyed by resourceId
          const usageMap = new Map<number, UsageData>();
          if (usageRes?.success && Array.isArray(usageRes.data)) {
            (usageRes.data as UsageData[]).forEach(u => usageMap.set(u.resourceId, u));
          }

          // 4. Combine plan resources with usage data
          const planResources: PlanResource[] = planData.resources ?? [];
          const combinedResources: DisplayResource[] = planResources.map((r: PlanResource) => {
            const usage = usageMap.get(r.id);

            let used       = 0;
            let total      = r.isUnlimited ? 0 : (r.maxCount ?? 0);
            let percentage = 0;

            if (!r.isUnlimited && !isCapResource(r)) {
              // Consumable quota — track actual usage vs limit
              used       = usage?.used  ?? 0;
              total      = usage?.total ?? r.maxCount ?? 0;
              percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            } else if (isCapResource(r)) {
              // Cap / allowance — show the ceiling value; usage isn't meaningful here
              used       = usage?.used ?? 0;
              total      = r.maxCount ?? 0;
              // Show how many slots are occupied vs total cap
              percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            }

            return {
              ...r,
              used,
              total,
              percentage,
              nextResetTime: usage?.nextResetTime,
            };
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

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  // ── Status config ──────────────────────────────────────────────────────────
  getStatusCls(status: string): string {
    const map: Record<string, string> = {
      Active: 'active',
      Expired: 'expired',
      Cancelled: 'cancelled',
      PendingCancellation: 'pending',
    };
    return map[status] ?? 'active';
  }

  getStatusLabel(status: string): string {
    if (this.lang() === 'ar') {
      const map: Record<string, string> = {
        Active: 'نشط',
        Expired: 'منتهي',
        Cancelled: 'ملغى',
        PendingCancellation: 'قيد الإلغاء',
      };
      return map[status] ?? status;
    }
    return status;
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      Active: '✓',
      Expired: '✗',
      Cancelled: '⊘',
      PendingCancellation: '⏱',
    };
    return map[status] ?? '✓';
  }

  // ── Resource helpers ──────────────────────────────────────────────────────
  getResourceIcon(key: string): string {
    const normalized = key?.toUpperCase?.() ?? '';
    const icon = RESOURCE_KEY_ICONS[key] ?? RESOURCE_KEY_ICONS[normalized];
    return icon ?? '🗄️';
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

  /** Boolean feature flag — limitType 6 / BOOLEAN */
  isBoolean(resource: DisplayResource): boolean {
    return resource.limitType === 6
      || resource.limitType === 'BOOLEAN'
      || String(resource.limitType).toUpperCase() === 'BOOLEAN';
  }

  /**
   * Cap resource — shows a ceiling value, not a consumable quota.
   * limitType 3 / Total resources like max_duration_days and active_slots.
   * When the usage endpoint hasn't provided real used counts (used === 0),
   * we display the cap as a plain value rather than a progress bar.
   */
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