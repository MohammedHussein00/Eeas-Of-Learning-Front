import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject } from 'rxjs';
import {
  LucideAngularModule,
  Crown, ArrowLeft, Save, RefreshCw, X,
  CheckCircle, AlertTriangle, Settings, DollarSign, Globe, FileText,
  Star, Tag, Bell, BookOpen, BarChart, Lock, Unlock,
  Layers, ChevronDown, ChevronUp, Info, Plus, Trash2,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { FormsModule } from '@angular/forms';

// ── Types ─────────────────────────────────────────────

export interface ResourceLimit {
  _uid: string;
  id: number;
  limitType: number;
  maxCount: number | null;
  maxSize: number | null;
  maxDuration: number | null;
  isAllowed: boolean;
  resetFrequency: number;
  label: string;
  description: string;
  displayOrder: number;
}

export interface Resource {
  _uid: string;
  id: number;
  name: string;
  resourceKey: string;
  limitType: number;
  unit: number;
  description: string;
  resetFrequency: number;
  maxCount: number | null;
  maxSize: number | null;
  maxDuration: number | null;
  isAllowed: boolean;
  isActive: boolean;
  isUnlimited: boolean;
  limits: ResourceLimit[];
  expanded: boolean;
}

export interface Feature {
  _uid: string;
  id: number;
  description: string;
  descriptionInAr: string;
  isPositive: boolean;
  isAvailable: boolean;
  displayOrder: number;
  icon: string;
}

export interface Discount {
  _uid: string;
  id: number;
  name: string;
  nameInAr: string;
  percentage: number;
  fixedAmount: number;
  discountType: string;
  discountCode: string;
  validFrom: string;
  validTo: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  description: string;
  descriptionInAr: string;
}

export interface BasicInfo {
  name: string;
  nameInAr: string;
  planType: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  semiAnnualPrice: number;
  annualPrice: number;
  currency: string;
  isActive: boolean;
  forStudent: boolean;
  displayOrder: number;
  description: string;
  descriptionInAr: string;
}

// ── Constants ─────────────────────────────────────────

export const LIMIT_TYPES = [
  { value: 0, label: 'Daily Count',    isCount: true,  defaultReset: 1 },
  { value: 1, label: 'Weekly Count',   isCount: true,  defaultReset: 2 },
  { value: 2, label: 'Monthly Count',  isCount: true,  defaultReset: 3 },
  { value: 3, label: 'Total Count',    isCount: true,  defaultReset: 0 },
  { value: 4, label: 'Size (MB)',       isCount: false, defaultReset: 0 },
  { value: 5, label: 'Duration (min)', isCount: false, defaultReset: 0 },
  { value: 6, label: 'Boolean',        isCount: false, defaultReset: 0 },
];

export const RESET_FREQUENCIES = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Daily' },
  { value: 2, label: 'Weekly' },
  { value: 3, label: 'Monthly' },
  { value: 4, label: 'Quarterly' },
];

export const PLAN_TYPES  = ['Free', 'Basic', 'Standard', 'Premium', 'Enterprise', 'Pro'];
export const CURRENCIES  = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'];
export const DISCOUNT_TYPES = ['Percentage', 'FixedAmount'];

export const RESOURCE_TEMPLATES = [
  {
    category: 'Course', color: '#6366f1',
    items: [
      { key: 'course.create',                label: 'Course Creations',          limitType: 0, unit: 0,  limits: [{ lt: 2, maxCount: 3 }] },
      { key: 'course.active_slots',          label: 'Active Course Slots',       limitType: 3, unit: 0,  limits: [{ lt: 3, maxCount: 5 }] },
      { key: 'course.max_hours',             label: 'Course Duration (hours)',   limitType: 3, unit: 9,  limits: [{ lt: 3, maxCount: 0 }] },
      { key: 'course.max_students_per_course', label: 'Max Students / Course',   limitType: 3, unit: 11, limits: [{ lt: 3, maxCount: 0 }] },
    ],
  },
  {
    category: 'Advertisement', color: '#8b5cf6',
    items: [
      { key: 'advertisement.submit',         label: 'Ad Submissions',            limitType: 2, unit: 0,  limits: [{ lt: 2, maxCount: 3 }] },
      { key: 'advertisement.active_slots',   label: 'Active Ad Slots',           limitType: 3, unit: 0,  limits: [{ lt: 3, maxCount: 2 }] },
      { key: 'advertisement.image_allowed',  label: 'Image Upload',              limitType: 6, unit: 0,  limits: [] },
      { key: 'advertisement.video_allowed',  label: 'Video Upload',              limitType: 6, unit: 10, limits: [] },
      { key: 'advertisement.max_duration_days', label: 'Max Campaign Duration',  limitType: 3, unit: 0,  limits: [{ lt: 3, maxCount: 30 }] },
    ],
  },
  {
    category: 'AI / Model', color: '#14b8a6',
    items: [
      { key: 'ai.gpt4_calls',  label: 'GPT-4 Calls',    limitType: 0, unit: 1, limits: [{ lt: 0, maxCount: 5 }, { lt: 2, maxCount: 30 }, { lt: 3, maxCount: 50 }] },
      { key: 'ai.gpt3_calls',  label: 'GPT-3 Calls',    limitType: 0, unit: 1, limits: [{ lt: 0, maxCount: 20 }, { lt: 2, maxCount: 100 }] },
      { key: 'ai.summaries',   label: 'AI Summaries',   limitType: 0, unit: 1, limits: [{ lt: 0, maxCount: 3 }, { lt: 2, maxCount: 20 }] },
    ],
  },
  {
    category: 'Storage', color: '#f59e0b',
    items: [
      { key: 'storage.total',   label: 'Total Storage',  limitType: 4, unit: 5,  limits: [{ lt: 4, maxSize: 500 }] },
      { key: 'storage.uploads', label: 'Upload Count',   limitType: 0, unit: 25, limits: [{ lt: 0, maxCount: 50 }, { lt: 2, maxCount: 200 }] },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────

let _uidCounter = 0;
export function uid(): string {
  return `new_${Date.now()}_${++_uidCounter}`;
}

export function ltLabel(v: number): string {
  return LIMIT_TYPES.find(l => l.value === v)?.label ?? String(v);
}

export function blankLimit(limitType = 0): ResourceLimit {
  return {
    _uid: uid(), id: 0, limitType,
    maxCount: null, maxSize: null, maxDuration: null,
    isAllowed: true,
    resetFrequency: LIMIT_TYPES.find(l => l.value === limitType)?.defaultReset ?? 0,
    label: '', description: '', displayOrder: 0,
  };
}

export function blankResource(): Resource {
  return {
    _uid: uid(), id: 0, name: '', resourceKey: '', limitType: 0, unit: 0,
    description: '', resetFrequency: 1, maxCount: null, maxSize: null,
    maxDuration: null, isAllowed: true, isActive: true, isUnlimited: false,
    limits: [blankLimit(0)], expanded: true,
  };
}

export function resourceFromTemplate(item: any): Resource {
  return {
    ...blankResource(),
    name: item.label,
    resourceKey: item.key,
    limitType: item.limitType,
    unit: item.unit ?? 0,
    limits: (item.limits ?? []).map((l: any) => ({
      ...blankLimit(l.lt),
      maxCount: l.maxCount ?? null,
      maxSize: l.maxSize ?? null,
      maxDuration: l.maxDuration ?? null,
      label: ltLabel(l.lt) + ' limit',
    })),
  };
}

export function blankFeature(): Feature {
  return {
    _uid: uid(), id: 0, description: '', descriptionInAr: '',
    isPositive: true, isAvailable: true, displayOrder: 0, icon: '',
  };
}

export function blankDiscount(): Discount {
  const now = new Date();
  const later = new Date(Date.now() + 30 * 86400000);
  return {
    _uid: uid(), id: 0, name: '', nameInAr: '', percentage: 10, fixedAmount: 0,
    discountType: 'Percentage', discountCode: '',
    validFrom: now.toISOString().split('T')[0],
    validTo: later.toISOString().split('T')[0],
    maxUses: 100, usedCount: 0, isActive: true, description: '', descriptionInAr: '',
  };
}

// ── Component ─────────────────────────────────────────

@Component({
  selector: 'app-add-edit-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  templateUrl: './add-edit-plan.html',
  styleUrls: ['./add-edit-plan.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'addEditPlan' },
  ],
})
export class AddEditPlan implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly CrownIcon         = Crown;
  readonly ArrowLeftIcon     = ArrowLeft;
  readonly SaveIcon          = Save;
  readonly RefreshCwIcon     = RefreshCw;
  readonly XIcon             = X;
  readonly CheckCircleIcon   = CheckCircle;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly SettingsIcon      = Settings;
  readonly DollarSignIcon    = DollarSign;
  readonly GlobeIcon         = Globe;
  readonly FileTextIcon      = FileText;
  readonly StarIcon          = Star;
  readonly TagIcon           = Tag;
  readonly BookOpenIcon      = BookOpen;
  readonly BarChartIcon      = BarChart;
  readonly LockIcon          = Lock;
  readonly UnlockIcon        = Unlock;
  readonly LayersIcon        = Layers;
  readonly ChevronDownIcon   = ChevronDown;
  readonly ChevronUpIcon     = ChevronUp;
  readonly InfoIcon          = Info;
  readonly PlusIcon          = Plus;
  readonly Trash2Icon        = Trash2;

  // ── Constants (exposed for template) ──────────────
  readonly limitTypes       = LIMIT_TYPES;
  readonly resetFrequencies = RESET_FREQUENCIES;
  readonly planTypes        = PLAN_TYPES;
  readonly currencies       = CURRENCIES;
  readonly discountTypes    = DISCOUNT_TYPES;
  readonly resourceTemplates = RESOURCE_TEMPLATES;

  // ── State Signals ─────────────────────────────────
  pageLoading = signal(false);
  saving      = signal(false);
  activeTab   = signal<'basic' | 'resources' | 'features' | 'discounts'>('basic');
  apiError    = signal<string | null>(null);
  success     = signal(false);
  isEdit      = signal(false);
  planId      = signal<string | null>(null);

  basic = signal<BasicInfo>({
    name: '', nameInAr: '', planType: 'Basic',
    monthlyPrice: 0, quarterlyPrice: 0, semiAnnualPrice: 0, annualPrice: 0,
    currency: 'EGP', isActive: true, forStudent: false,
    displayOrder: 1, description: '', descriptionInAr: '',
  });

  resources = signal<Resource[]>([]);
  features  = signal<Feature[]>([]);
  discounts = signal<Discount[]>([]);

  // ── Computed ──────────────────────────────────────
  existingKeys = computed(() => this.resources().map(r => r.resourceKey));

  totalTiers = computed(() =>
    this.resources().reduce((s, r) => s + r.limits.length, 0)
  );

  sidebarChecks = computed(() => {
    const b = this.basic();
    const res = this.resources();
    const feat = this.features();
    return [
      { label: 'Plan name (EN)',       ok: b.name.trim().length >= 2 },
      { label: 'Plan name (AR)',       ok: b.nameInAr.trim().length >= 2 },
      { label: 'At least 1 resource', ok: res.length > 0 },
      { label: 'At least 1 feature',  ok: feat.length > 0 },
      { label: 'Limits defined',      ok: res.every(r => r.isUnlimited || r.limits.length > 0) },
      { label: 'All limits have cap', ok: res.every(r =>
          r.isUnlimited || r.limits.every(l =>
            l.limitType === 6 || l.maxCount != null || l.maxSize != null || l.maxDuration != null
          )
        )
      },
    ];
  });

  completionPct = computed(() => {
    const checks = this.sidebarChecks();
    return Math.round(checks.filter(c => c.ok).length / checks.length * 100);
  });

  tabs = computed(() => [
    { key: 'basic'     as const, label: 'Basic Info',  badge: null },
    { key: 'resources' as const, label: 'Resources',   badge: this.resources().length },
    { key: 'features'  as const, label: 'Features',    badge: this.features().length },
    { key: 'discounts' as const, label: 'Discounts',   badge: this.discounts().length },
  ]);

  private get baseUrl(): string { return this.config.baseUrl; }

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.planId.set(id);
      this.fetchPlan(id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Fetching ─────────────────────────────────
  async fetchPlan(id: string): Promise<void> {
    this.pageLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/subscriptionplans/for-edit/${id}`)
      );
      const p = res?.data || res;
      this.basic.set({
        name: p.name || '', nameInAr: p.nameInAr || '', planType: p.planType || 'Basic',
        monthlyPrice:    p.pricing?.monthly    ?? 0,
        quarterlyPrice:  p.pricing?.quarterly  ?? 0,
        semiAnnualPrice: p.pricing?.semiAnnual ?? 0,
        annualPrice:     p.pricing?.annual     ?? 0,
        currency: p.currency || 'EGP', isActive: p.isActive ?? true,
        forStudent: p.forStudent ?? false, displayOrder: p.displayOrder || 1,
        description: p.description || '', descriptionInAr: p.descriptionInAr || '',
      });
      this.resources.set(
        (p.resources || []).map((r: any) => ({
          ...r, _uid: uid(), expanded: false,
          limits: (r.limits || []).map((l: any) => ({ ...l, _uid: uid() })),
        }))
      );
      this.features.set((p.features || []).map((f: any) => ({ ...f, _uid: uid() })));
      this.discounts.set(
        (p.activeDiscounts || []).map((d: any) => ({
          ...d, _uid: uid(),
          validFrom: d.validFrom?.split('T')[0] || '',
          validTo:   d.validTo?.split('T')[0]   || '',
        }))
      );
    } catch {
      this.apiError.set('Failed to load plan data');
    } finally {
      this.pageLoading.set(false);
    }
  }

  // ── Basic Info Mutators ───────────────────────────
  updateBasic<K extends keyof BasicInfo>(field: K, value: BasicInfo[K]): void {
    this.basic.update(b => ({ ...b, [field]: value }));
  }

  // ── Resource Mutators ─────────────────────────────
  addResource(): void {
    this.resources.update(list => [...list, blankResource()]);
  }

  addFromTemplate(item: any): void {
    if (this.existingKeys().includes(item.key)) {
      this.toast.warning(`"${item.label}" already added`);
      return;
    }
    this.resources.update(list => [...list, resourceFromTemplate(item)]);
    this.activeTab.set('resources');
  }

  updateResource(rUid: string, field: keyof Resource, value: any): void {
    this.resources.update(list =>
      list.map(r => r._uid === rUid ? { ...r, [field]: value } : r)
    );
  }

  removeResource(rUid: string): void {
    this.resources.update(list => list.filter(r => r._uid !== rUid));
  }

  addLimit(rUid: string): void {
    this.resources.update(list =>
      list.map(r => r._uid !== rUid ? r : {
        ...r,
        limits: [...r.limits, blankLimit(r.limitType)],
      })
    );
  }

  updateLimit(rUid: string, lUid: string, field: keyof ResourceLimit, value: any): void {
    this.resources.update(list =>
      list.map(r => r._uid !== rUid ? r : {
        ...r,
        limits: r.limits.map(l => l._uid === lUid ? { ...l, [field]: value } : l),
      })
    );
  }

  updateLimitType(rUid: string, lUid: string, limitType: number): void {
    this.resources.update(list =>
      list.map(r => r._uid !== rUid ? r : {
        ...r,
        limits: r.limits.map(l => l._uid === lUid
          ? { ...l, limitType, resetFrequency: LIMIT_TYPES.find(x => x.value === limitType)?.defaultReset ?? 0 }
          : l
        ),
      })
    );
  }

  removeLimit(rUid: string, lUid: string): void {
    this.resources.update(list =>
      list.map(r => r._uid !== rUid ? r : {
        ...r,
        limits: r.limits.filter(l => l._uid !== lUid),
      })
    );
  }

  // ── Feature Mutators ──────────────────────────────
  addFeature(): void {
    this.features.update(list => [...list, blankFeature()]);
  }

  updateFeature(fUid: string, field: keyof Feature, value: any): void {
    this.features.update(list =>
      list.map(f => f._uid === fUid ? { ...f, [field]: value } : f)
    );
  }

  removeFeature(fUid: string): void {
    this.features.update(list => list.filter(f => f._uid !== fUid));
  }

  // ── Discount Mutators ─────────────────────────────
  addDiscount(): void {
    this.discounts.update(list => [...list, blankDiscount()]);
  }

  updateDiscount(dUid: string, field: keyof Discount, value: any): void {
    this.discounts.update(list =>
      list.map(d => d._uid === dUid ? { ...d, [field]: value } : d)
    );
  }

  removeDiscount(dUid: string): void {
    this.discounts.update(list => list.filter(d => d._uid !== dUid));
  }

  // ── Save ──────────────────────────────────────────
  async handleSave(): Promise<void> {
    const b = this.basic();
    if (!b.name.trim()) {
      this.toast.error('Plan name (EN) is required');
      this.activeTab.set('basic');
      return;
    }
    if (!b.nameInAr.trim()) {
      this.toast.error('Plan name (AR) is required');
      this.activeTab.set('basic');
      return;
    }
    for (const r of this.resources()) {
      if (!r.name.trim() || !r.resourceKey.trim()) {
        this.toast.error('All resources need a name and key');
        this.activeTab.set('resources');
        return;
      }
    }

    const payload = {
      ...b,
      resources: this.resources().map(({ _uid, expanded, limits, ...r }) => ({
        ...r,
        limits: limits.map(({ _uid: lu, ...l }) => l),
      })),
      features: this.features().map(({ _uid, ...f }) => f),
      activeDiscounts: this.discounts().map(({ _uid, ...d }) => ({
        ...d,
        validFrom: d.validFrom ? new Date(d.validFrom).toISOString() : null,
        validTo:   d.validTo   ? new Date(d.validTo).toISOString()   : null,
      })),
    };

    this.saving.set(true);
    this.apiError.set(null);
    try {
      if (this.isEdit() && this.planId()) {
        await firstValueFrom(
          this.http.put(`${this.baseUrl}/api/subscriptionplans/${this.planId()}`, payload)
        );
      } else {
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/api/subscriptionplans`, payload)
        );
      }
      this.success.set(true);
      this.toast.success(this.isEdit() ? 'Plan updated successfully' : 'Plan created successfully');
      setTimeout(() => this.navigateToList(), 1200);
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        Object.values(err?.error?.errors || {}).flat().join(', ') ||
        'Save failed';
      this.apiError.set(String(msg));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Navigation ────────────────────────────────────
  navigateToList(): void {
    this.router.navigate(['/dash/plans']);
  }

  // ── Display Helpers ───────────────────────────────
  ltLabel(v: number): string { return ltLabel(v); }

  tierSummary(resource: Resource): string {
    if (resource.limits.length === 0) return resource.isUnlimited ? 'Unlimited' : 'No limits set';
    const parts = resource.limits
      .filter(l => l.maxCount || l.maxSize || l.maxDuration)
      .map(l => `${l.maxCount ?? l.maxSize ?? l.maxDuration}/${ltLabel(l.limitType).split(' ')[0].toLowerCase()}`);
    return parts.join(' · ') || 'No limits set';
  }

  tierCapDisplay(l: ResourceLimit): string {
    const val = l.maxCount ?? l.maxSize ?? l.maxDuration;
    const unit = l.limitType === 4 ? 'MB' : l.limitType === 5 ? 'min' : 'uses';
    const reset = RESET_FREQUENCIES.find(r => r.value === l.resetFrequency)?.label ?? '';
    return `${val} ${unit} · ${reset}`;
  }

  resetLabel(v: number): string {
    return RESET_FREQUENCIES.find(r => r.value === v)?.label ?? '';
  }

  completionColor(): string {
    const pct = this.completionPct();
    return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#6366f1';
  }

  conicGradient(): string {
    const pct = this.completionPct();
    const color = this.completionColor();
    return `conic-gradient(${color} ${pct * 3.6}deg, #f0f3fa 0)`;
  }

  trackByUid(_: number, item: { _uid: string }): string {
    return item._uid;
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  trackByCategory(_: number, group: { category: string }): string {
    return group.category;
  }
}