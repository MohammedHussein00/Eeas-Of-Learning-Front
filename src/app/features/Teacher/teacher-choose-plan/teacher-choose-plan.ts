import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }   from '@angular/common';
import { Router }         from '@angular/router';
import { HttpClient }     from '@angular/common/http';
import { FormsModule }    from '@angular/forms';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RXJSubject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, Rocket, CheckCircle, Star, Flame,
  Info, Send, LayoutGrid, Image, Video,
  Crown, FileText, Check, AlertTriangle, X,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast }      from '../../../core/services/toast';

import { NzSpinModule }     from 'ng-zorro-antd/spin';
import { NzTagModule }      from 'ng-zorro-antd/tag';
import { NzSwitchModule }   from 'ng-zorro-antd/switch';
import { NzModalModule }    from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTooltipModule }  from 'ng-zorro-antd/tooltip';
import { NzAlertModule }    from 'ng-zorro-antd/alert';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
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
  activeDiscounts?: Discount[];
}

interface Feature {
  id: number;
  description: string;
  isPositive: boolean;
  isAvailable: boolean;
  displayOrder: number;
  icon?: string;
}

interface PlanResource {
  id: number;
  name: string;
  resourceKey: string;
  limitType: number | string;
  unit: number | string;
  maxCount?: number;
  maxSize?: number;
  maxDuration?: number;
  isUnlimited: boolean;
  isAllowed?: boolean;
  resetFrequency: string | number;
}

interface Discount {
  id: number;
  name: string;
  percentage: number;
  fixedAmount?: number;
  discountType: string;
  discountCode: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
}

/** Pending upgrade request returned by GET /api/subscription/upgrade-requests */
interface PendingUpgrade {
  id: string;
  newPlanId: number;
  newPlanName: string;
  currentPlanName: string;
  billingPeriod: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  canCancel: boolean;
  paymentUrl?: string;
}

export type BillingKey = 'monthly' | 'quarterly' | 'semiAnnual' | 'annual';

export interface BillingOption {
  key: BillingKey;
  en: string;
  ar: string;
  value: number;
}

interface SubscribeModal {
  visible: boolean;
  plan: Plan | null;
  loading: boolean;
  immediate: boolean;
  proRata: boolean;
}

/** State for the "you already have an active request" conflict modal */
interface ConflictModal {
  visible: boolean;
  pendingUpgrade: PendingUpgrade | null;
  cancelLoading: boolean;
  /** The plan the user originally wanted to subscribe to, held for retry */
  pendingPlan: Plan | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const BILLING_OPTIONS: BillingOption[] = [
  { key: 'monthly',    en: 'Monthly',      ar: 'شهري',        value: 1  },
  { key: 'quarterly',  en: 'Quarterly',    ar: 'ربع سنوي',    value: 3  },
  { key: 'semiAnnual', en: 'Semi-Annual',  ar: 'نصف سنوي',   value: 6  },
  { key: 'annual',     en: 'Annual',       ar: 'سنوي',        value: 12 },
];

const MONTHS_MAP: Record<string, number> = {
  quarterly: 3, semiAnnual: 6, annual: 12,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function calcSaving(plan: Plan, key: BillingKey): number | null {
  if (key === 'monthly' || plan.pricing.monthly === 0) return null;
  const months = MONTHS_MAP[key] || 1;
  const monthlyTotal = plan.pricing.monthly * months;
  const actual = plan.pricing[key];
  if (monthlyTotal === 0 || actual === 0) return null;
  return Math.round(((monthlyTotal - actual) / monthlyTotal) * 100);
}

export function getPrice(plan: Plan, billing: BillingKey): number {
  return plan.pricing[billing] ?? plan.pricing.monthly;
}

export function isFreePlan(plan: Plan): boolean {
  return (
    plan.pricing.monthly    === 0 &&
    plan.pricing.quarterly  === 0 &&
    plan.pricing.semiAnnual === 0 &&
    plan.pricing.annual     === 0
  );
}

export function getUniqueResources(resources: PlanResource[]): PlanResource[] {
  const seen = new Set<string>();
  const result: PlanResource[] = [];
  for (const r of resources) {
    if (!seen.has(r.resourceKey)) { seen.add(r.resourceKey); result.push(r); }
  }
  return result;
}

export function formatResourceDisplay(resource: PlanResource, lang: 'en' | 'ar'): string {
  if (resource.isUnlimited) return lang === 'ar' ? 'غير محدود' : 'Unlimited';
  const c = resource.maxCount || 0;
  const d = resource.maxDuration || 0;
  switch (resource.resourceKey) {
    case 'advertisement.submit':
      return lang === 'ar' ? `${c} تقديم/شهر` : `${c} submissions/month`;
    case 'advertisement.active_slots':
      return lang === 'ar' ? `${c} فتحات نشطة` : `${c} active slots`;
    case 'advertisement.image_allowed':
      return resource.isAllowed !== false
        ? (lang === 'ar' ? 'رفع الصور مسموح' : 'Image upload allowed')
        : (lang === 'ar' ? 'لا يُسمح برفع الصور' : 'No image upload');
    case 'advertisement.video_allowed':
      return resource.isAllowed !== false
        ? (lang === 'ar' ? `رفع الفيديو (${d} ث)` : `Video upload (${d}s)`)
        : (lang === 'ar' ? 'لا يُسمح برفع الفيديو' : 'No video upload');
    case 'course.create':
      return lang === 'ar' ? `${c} دورات/شهر` : `${c} courses/month`;
    case 'CHAT_ACCESS':
      return resource.isUnlimited
        ? (lang === 'ar' ? 'دردشة غير محدودة' : 'Unlimited chat')
        : (lang === 'ar' ? 'وصول للدردشة' : 'Chat access');
    case 'COURSE_ROOM_CREATE':
      return lang === 'ar' ? 'غرف الدورة' : 'Course rooms';
    default:
      return resource.name;
  }
}

export function getResourceIcon(key: string): string {
  const map: Record<string, string> = {
    'advertisement.submit':        '📤',
    'advertisement.active_slots':  '📊',
    'advertisement.image_allowed': '🖼️',
    'advertisement.video_allowed': '🎬',
    'course.create':               '👑',
    'CHAT_ACCESS':                 '📋',
    'COURSE_ROOM_CREATE':          '📊',
  };
  return map[key] ?? '✓';
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-teacher-choose-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTagModule,
    NzSwitchModule,
    NzModalModule,
    NzProgressModule,
    NzTooltipModule,
    NzAlertModule,
  ],
  templateUrl: './teacher-choose-plan.html',
  styleUrls:   ['./teacher-choose-plan.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherChoosePlan' },
  ],
})
export class TeacherChoosePlan implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RXJSubject<void>();

  // ── Icons ──────────────────────────────────────────────────────────────────
  readonly ArrowLeftIcon      = ArrowLeft;
  readonly RocketIcon         = Rocket;
  readonly CheckCircleIcon    = CheckCircle;
  readonly StarIcon           = Star;
  readonly FlameIcon          = Flame;
  readonly InfoIcon           = Info;
  readonly SendIcon           = Send;
  readonly GridIcon           = LayoutGrid;
  readonly ImageIcon          = Image;
  readonly VideoIcon          = Video;
  readonly CrownIcon          = Crown;
  readonly FileTextIcon       = FileText;
  readonly CheckIcon          = Check;
  readonly AlertTriangleIcon  = AlertTriangle;
  readonly XIcon              = X;

  // ── State signals ──────────────────────────────────────────────────────────
  loading    = signal(true);
  plans      = signal<Plan[]>([]);
  billing    = signal<BillingKey>('monthly');
  currentSub = signal<{ planId: number } | null>(null);

  modal = signal<SubscribeModal>({
    visible: false, plan: null, loading: false, immediate: true, proRata: true,
  });

  /**
   * Conflict modal — shown when the backend returns
   * "You already have an active upgrade request".
   */
  conflictModal = signal<ConflictModal>({
    visible: false, pendingUpgrade: null, cancelLoading: false, pendingPlan: null,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  lang = computed<'en' | 'ar'>(() =>
    this.transloco.getActiveLang() === 'ar' ? 'ar' : 'en'
  );

  dir = computed(() => this.lang() === 'ar' ? 'rtl' : 'ltr');

  billingOptions = BILLING_OPTIONS;

  gridClass = computed(() => {
    const n = Math.min(this.plans().length, 3);
    return `cp-plans-grid cols-${n}`;
  });

  billedPrice = computed(() => {
    const p = this.modal().plan;
    return p ? getPrice(p, this.billing()) : 0;
  });

  isModalFree = computed(() => {
    const p = this.modal().plan;
    return p ? isFreePlan(p) : false;
  });

  // ── Expose pure helpers to template ───────────────────────────────────────
  readonly getPrice           = getPrice;
  readonly calcSaving         = calcSaving;
  readonly isFreePlan         = isFreePlan;
  readonly getUniqueResources = getUniqueResources;
  readonly getResourceIcon    = getResourceIcon;

  formatResource(resource: PlanResource): string {
    return formatResourceDisplay(resource, this.lang());
  }

  getAdResources(plan: Plan): PlanResource[] {
    const unique = getUniqueResources(plan.resources || []);
    return unique.filter(r =>
      r.resourceKey.startsWith('advertisement.') ||
      ['course.create', 'CHAT_ACCESS', 'COURSE_ROOM_CREATE'].includes(r.resourceKey)
    );
  }

  getOtherCount(plan: Plan): number {
    const unique = getUniqueResources(plan.resources || []);
    return unique.length - this.getAdResources(plan).length;
  }

  getPlanRibbonClass(plan: Plan, isCurrent: boolean): string {
    if (isCurrent)       return 'cp-ribbon current';
    if (isFreePlan(plan)) return 'cp-ribbon free';
    if (plan.isDefault)  return 'cp-ribbon';
    return '';
  }

  getPlanRibbonLabel(plan: Plan, isCurrent: boolean): string {
    const l = this.lang();
    if (isCurrent)        return l === 'ar' ? '✓ خطتك الحالية'    : '✓ Current Plan';
    if (isFreePlan(plan)) return l === 'ar' ? '⭐ خطة مجانية'     : '⭐ Free Plan';
    if (plan.isDefault)   return l === 'ar' ? '⭐ الأكثر شيوعاً'  : '⭐ Most Popular';
    return '';
  }

  getSelectBtnClass(plan: Plan, isCurrent: boolean): string {
    if (isCurrent)        return 'cp-select-btn current';
    if (isFreePlan(plan)) return 'cp-select-btn free';
    if (plan.isDefault)   return 'cp-select-btn featured';
    return 'cp-select-btn';
  }

  getSelectBtnLabel(plan: Plan, isCurrent: boolean): string {
    const l = this.lang();
    if (isCurrent)        return l === 'ar' ? 'خطتك الحالية'  : 'Your Current Plan';
    if (isFreePlan(plan)) return l === 'ar' ? 'ابدأ مجاناً'   : 'Get Started Free';
    return l === 'ar' ? 'اشترك الآن' : 'Subscribe Now';
  }

  getPlanCardClass(plan: Plan, isCurrent: boolean): string {
    let cls = 'cp-plan-card';
    if (plan.isDefault) cls += ' featured';
    if (isCurrent)      cls += ' current';
    return cls;
  }

  isCurrent(plan: Plan): boolean {
    return this.currentSub()?.planId === plan.id;
  }

  getBillingLabel(key: BillingKey): string {
    const opt = BILLING_OPTIONS.find(b => b.key === key);
    return opt ? (this.lang() === 'ar' ? opt.ar : opt.en) : '';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void { this.fetchData(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  async fetchData(): Promise<void> {
    this.loading.set(true);
    try {
      const base = this.config.baseUrl;
      const l    = this.lang();

      const meRes = await firstValueFrom(
        this.http.get<any>(`${base}/api/auth/me`)
      ).catch(() => null);

      const userRole: string = meRes?.role || meRes?.data?.role || 'Teacher';
      const isTeacher        = userRole.toLowerCase() === 'teacher';
      const endpoint         = isTeacher
        ? `${base}/api/subscriptionplans/teacher`
        : `${base}/api/subscriptionplans/student`;

      const [plansRes, subRes] = await Promise.all([
        firstValueFrom(
          this.http.get<any>(endpoint, { headers: { 'X-Language': l } })
        ).catch(() => null),
        firstValueFrom(
          this.http.get<any>(`${base}/api/subscription/current`)
        ).catch(() => null),
      ]);

      let plansList: Plan[] = [];
      if (plansRes?.success) {
        plansList = plansRes.data || [];
      } else if (Array.isArray(plansRes)) {
        plansList = plansRes;
      } else if (plansRes?.data && Array.isArray(plansRes.data)) {
        plansList = plansRes.data;
      }

      const filtered = plansList.filter(
        p => (isTeacher ? !p.forStudent : p.forStudent) || p.isDefault
      );
      this.plans.set(filtered.length > 0 ? filtered : plansList.filter(p => p.isActive));

      if (subRes?.success && subRes.data) {
        this.currentSub.set({ planId: subRes.data.subscriptionPlanId });
      }
    } catch {
      this.toast.error(
        this.lang() === 'ar' ? 'خطأ في تحميل الخطط' : 'Error loading plans'
      );
    } finally {
      this.loading.set(false);
    }
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────
  async handleSubscribe(): Promise<void> {
    const plan = this.modal().plan;
    if (!plan) return;

    this.modal.update(p => ({ ...p, loading: true }));
    try {
      const billingValue = BILLING_OPTIONS.find(b => b.key === this.billing())?.value ?? 1;
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/subscription/request-upgrade`, {
          newPlanId:        plan.id,
          newBillingPeriod: billingValue,
          proRata:          this.modal().proRata,
          immediate:        this.modal().immediate,
          paymentMethod:    'fawaterk',
        })
      );

      if (res.success) {
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          this.toast.success(
            this.lang() === 'ar' ? 'تم تفعيل الخطة بنجاح!' : 'Plan activated successfully!'
          );
          this.closeModal();
          this.router.navigate(['/teacher/plans/my-plan']);
        }
      } else {
        // ── Detect "active upgrade request" conflict ────────────────
        if (this.isActiveUpgradeConflict(res.message)) {
          this.modal.update(p => ({ ...p, loading: false }));
          await this.openConflictModal(plan);
        } else {
          this.toast.error(res.message || this.t('errorUpdating'));
          this.modal.update(p => ({ ...p, loading: false }));
        }
      }
    } catch (err: any) {
      const serverMessage: string = err?.error?.message || '';
      if (this.isActiveUpgradeConflict(serverMessage)) {
        this.modal.update(p => ({ ...p, loading: false }));
        await this.openConflictModal(plan);
      } else {
        this.toast.error(serverMessage || this.t('errorUpdating'));
        this.modal.update(p => ({ ...p, loading: false }));
      }
    }
  }

  /** True when the backend message indicates a pending upgrade conflict */
  private isActiveUpgradeConflict(message: string): boolean {
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
      lower.includes('active upgrade request') ||
      lower.includes('complete or cancel') ||
      lower.includes('pending upgrade')
    );
  }

  /**
   * Fetch the active upgrade request and open the conflict resolution modal.
   */
  private async openConflictModal(planToRetry: Plan): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/subscription/upgrade-requests`)
      ).catch(() => null);

      const requests: PendingUpgrade[] = res?.data?.requests || res?.data || [];
      // Find the first non-completed, non-cancelled request
      const active = requests.find(r =>
        !['Completed', 'Cancelled', 'Expired', 'Refunded'].includes(r.status)
      ) ?? requests[0] ?? null;

      this.conflictModal.set({
        visible: true,
        pendingUpgrade: active,
        cancelLoading: false,
        pendingPlan: planToRetry,
      });
    } catch {
      // Fallback: show conflict modal without specific pending-request details
      this.conflictModal.set({
        visible: true,
        pendingUpgrade: null,
        cancelLoading: false,
        pendingPlan: planToRetry,
      });
    }
  }

  closeConflictModal(): void {
    this.conflictModal.set({
      visible: false, pendingUpgrade: null, cancelLoading: false, pendingPlan: null,
    });
  }

  /**
   * Cancel the pending upgrade then retry subscribing to the originally
   * selected plan.
   */
  async handleCancelConflictAndRetry(): Promise<void> {
    const conflict = this.conflictModal();
    if (!conflict.pendingUpgrade?.id) {
      // No specific request ID — just close and let the user retry manually
      this.closeConflictModal();
      return;
    }

    this.conflictModal.update(s => ({ ...s, cancelLoading: true }));
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/subscription/cancel-upgrade`, {
          upgradeRequestId: conflict.pendingUpgrade!.id,
        })
      );

      if (res.success) {
        this.toast.success(
          this.lang() === 'ar'
            ? 'تم إلغاء الطلب السابق. جارٍ إعادة المحاولة…'
            : 'Previous request cancelled. Retrying…'
        );
        this.closeConflictModal();

        // Re-open the subscribe modal for the originally requested plan
        const plan = conflict.pendingPlan;
        if (plan) {
          this.openModal(plan);
        }
      } else {
        this.toast.error(
          res.message ||
          (this.lang() === 'ar' ? 'فشل إلغاء الطلب' : 'Failed to cancel request')
        );
        this.conflictModal.update(s => ({ ...s, cancelLoading: false }));
      }
    } catch {
      this.toast.error(
        this.lang() === 'ar' ? 'حدث خطأ أثناء الإلغاء' : 'Error cancelling request'
      );
      this.conflictModal.update(s => ({ ...s, cancelLoading: false }));
    }
  }

  /**
   * User chose to resume the pending payment instead of cancelling it.
   */
  resumePendingPayment(): void {
    const url = this.conflictModal().pendingUpgrade?.paymentUrl;
    if (url) {
      window.location.href = url;
    } else {
      this.closeConflictModal();
      this.router.navigate(['/teacher/plans/my-plan']);
    }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  openModal(plan: Plan): void {
    this.modal.set({ visible: true, plan, loading: false, immediate: true, proRata: true });
  }

  closeModal(): void {
    this.modal.set({ visible: false, plan: null, loading: false, immediate: true, proRata: true });
  }

  setImmediate(v: boolean): void { this.modal.update(p => ({ ...p, immediate: v })); }
  setProRata(v: boolean):   void { this.modal.update(p => ({ ...p, proRata:   v })); }
  setBilling(key: BillingKey): void { this.billing.set(key); }

  // ── Conflict modal helpers ─────────────────────────────────────────────────
  conflictStatusLabel(status: string): string {
    const map: Record<string, { en: string; ar: string }> = {
      PendingPayment:   { en: 'Pending Payment',    ar: 'في انتظار الدفع' },
      PaymentPending:   { en: 'Payment Pending',    ar: 'الدفع معلّق' },
      PaymentCompleted: { en: 'Payment Completed',  ar: 'تم الدفع' },
      Processing:       { en: 'Processing',         ar: 'قيد المعالجة' },
      Scheduled:        { en: 'Scheduled',          ar: 'مجدول' },
    };
    const entry = map[status];
    return entry ? (this.lang() === 'ar' ? entry.ar : entry.en) : status;
  }

  hasPendingPaymentUrl(): boolean {
    const u = this.conflictModal().pendingUpgrade;
    return !!(u?.paymentUrl);
  }

  // ── i18n helper ────────────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`myPlan.${key}`);
  }
}