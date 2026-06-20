// plans-list.ts
import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject } from 'rxjs';
import {
  LucideAngularModule,
  Crown, Plus, Search, RefreshCw, MoreHorizontal,
  Eye, Pencil, Trash2, Copy, Star, CheckCircle, XCircle,
  AlertTriangle, X, Layers, Users, ChevronLeft, ChevronRight,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// Ant Design
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
interface Pricing {
  monthly: number;
  quarterly: number;
  semiAnnual: number;
  annual: number;
  savingsPercentage?: number;
}

interface Plan {
  id: number;
  name: string;
  nameInAr?: string;
  planType?: string;
  description?: string;
  descriptionInAr?: string;
  currency?: string;
  isActive?: boolean;
  isDefault?: boolean;
  forStudent?: boolean;
  createdAt?: string;
  pricing?: Pricing;
  resources?: any[];
  features?: any[];
  activeDiscounts?: any[];
}

interface StatisticsData {
  totalPlans: number;
  activePlans: number;
  inactivePlans: number;
  studentPlans: number;
}

interface DeleteState {
  visible: boolean;
  record: Plan | null;
  loading: boolean;
  error: string | null;
}

interface DropdownState {
  visible: boolean;
  recordId: number | null;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-plans-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'plansList' },
  ],
  templateUrl: './plans-list.html',
  styleUrls: ['./plans-list.scss'],
})
export class PlansList implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private config = inject(APP_CONFIG);
  private toast = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly CrownIcon = Crown;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly RefreshCwIcon = RefreshCw;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly EyeIcon = Eye;
  readonly PencilIcon = Pencil;
  readonly Trash2Icon = Trash2;
  readonly CopyIcon = Copy;
  readonly StarIcon = Star;
  readonly CheckCircleIcon = CheckCircle;
  readonly XCircleIcon = XCircle;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly XIcon = X;
  readonly LayersIcon = Layers;
  readonly UsersIcon = Users;
  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;

  // ── Constants ─────────────────────────────────────
  readonly PAGE_SIZE = 10;
  readonly skeletonRows = Array(5).fill(0);

  // ── State Signals ─────────────────────────────────
  initialLoading = signal(true);
  fatalError = signal(false);
  refreshing = signal(false);
  isLoading = signal(false);

  plans = signal<Plan[]>([]);
  filteredPlans = signal<Plan[]>([]);
  searchQuery = signal('');
  currentPage = signal(1);
  selectedIds = signal<number[]>([]);
  language = signal('en');

  statsData = signal<StatisticsData>({
    totalPlans: 0,
    activePlans: 0,
    inactivePlans: 0,
    studentPlans: 0,
  });

  deleteState = signal<DeleteState>({
    visible: false,
    record: null,
    loading: false,
    error: null,
  });

  dropdown = signal<DropdownState>({
    visible: false,
    recordId: null,
  });

  // ── Computed ──────────────────────────────────────
  pagedData = computed(() => {
    const p = this.currentPage();
    return this.filteredPlans().slice((p - 1) * this.PAGE_SIZE, p * this.PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPlans().length / this.PAGE_SIZE))
  );

  pageStart = computed(() =>
    this.filteredPlans().length > 0 ? (this.currentPage() - 1) * this.PAGE_SIZE + 1 : 0
  );

  pageEnd = computed(() =>
    Math.min(this.currentPage() * this.PAGE_SIZE, this.filteredPlans().length)
  );

  pageNumbers = computed<number[]>(() => {
    const tp = this.totalPages();
    const p = this.currentPage();
    const count = Math.min(tp, 7);
    return Array.from({ length: count }, (_, i) => {
      if (tp <= 7) return i + 1;
      if (p <= 4) return i + 1;
      if (p >= tp - 3) return tp - 6 + i;
      return p - 3 + i;
    });
  });

  isAllSelected = computed(() => {
    const data = this.pagedData();
    return data.length > 0 && this.selectedIds().length === data.length;
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    // Detect language (extend with your i18n service)
    // this.language.set(this.transloco.getActiveLang());

    // Close dropdown on outside click
    document.addEventListener('click', this.closeDropdownHandler);

    this.fetchPlans();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.closeDropdownHandler);
  }

  private closeDropdownHandler = () => {
    if (this.dropdown().visible) {
      this.dropdown.set({ visible: false, recordId: null });
    }
  };

  // ── Navigation ────────────────────────────────────
  navigateToAdd(): void {
    this.router.navigate(['/dash/add-plan']);
  }

  navigateToEdit(id: number): void {
    this.router.navigate([`/dash/plans/edit/${id}`]);
    this.closeDropdown();
  }

  navigateToDetails(id: number): void {
    this.router.navigate([`/dash/plan-details/${id}`]);
    this.closeDropdown();
  }

  // ── Data Fetching ─────────────────────────────────
  private get baseUrl(): string { return this.config.baseUrl; }

  async fetchPlans(): Promise<void> {
    this.isLoading.set(true);
    this.fatalError.set(false);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/subscriptionplans`)
      );
      const data: Plan[] = res.data || [];
      this.plans.set(data);
      this.filteredPlans.set(data);
      this.updateStats(data);
      this.initialLoading.set(false);
    } catch {
      this.fatalError.set(true);
      this.toast.error(this.t('errorFetchingPlans'));
    } finally {
      this.isLoading.set(false);
    }
  }

  private updateStats(data: Plan[]): void {
    this.statsData.set({
      totalPlans: data.length,
      activePlans: data.filter(p => p.isActive).length,
      inactivePlans: data.filter(p => !p.isActive).length,
      studentPlans: data.filter(p => p.forStudent).length,
    });
  }

  async handleRefresh(): Promise<void> {
    this.refreshing.set(true);
    await this.fetchPlans();
    this.refreshing.set(false);
    this.toast.success(this.t('dataRefreshed'));
  }

  // ── Search / Pagination ───────────────────────────
  onSearch(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    this.applyFilter();
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.applyFilter();
    this.currentPage.set(1);
  }

  private applyFilter(): void {
    const q = this.searchQuery().toLowerCase();
    if (!q) {
      this.filteredPlans.set(this.plans());
      return;
    }
    this.filteredPlans.set(
      this.plans().filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.nameInAr?.toLowerCase().includes(q) ||
        p.planType?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    );
  }

  setPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.currentPage.set(n);
  }

  // ── Selection ─────────────────────────────────────
  toggleSelection(id: number): void {
    this.selectedIds.update(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }

  toggleSelectAll(): void {
    const data = this.pagedData();
    if (this.selectedIds().length === data.length) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(data.map(p => p.id));
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  clearSelection(): void {
    this.selectedIds.set([]);
  }

  // ── Plan Actions ──────────────────────────────────
  async handleToggleActive(plan: Plan): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.baseUrl}/api/subscriptionplans/${plan.id}/active`, {
          isActive: !plan.isActive
        })
      );
      this.toast.success(plan.isActive ? this.t('planDeactivated') : this.t('planActivated'));
      await this.fetchPlans();
    } catch {
      this.toast.error(this.t('errorUpdatingStatus'));
    }
  }

  async handleSetDefault(plan: Plan): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/subscriptionplans/${plan.id}/default`, {})
      );
      this.toast.success(this.t('defaultPlanSet'));
      await this.fetchPlans();
    } catch {
      this.toast.error(this.t('errorSettingDefault'));
    }
    this.closeDropdown();
  }

  async handleDuplicate(plan: Plan): Promise<void> {
    try {
      const dup = {
        ...plan,
        name: `${plan.name} (Copy)`,
        nameInAr: `${plan.nameInAr || plan.name} (نسخة)`,
        isDefault: false,
      };
      delete (dup as any).id;
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/subscriptionplans`, dup)
      );
      this.toast.success(this.t('planDuplicated'));
      await this.fetchPlans();
    } catch {
      this.toast.error(this.t('errorDuplicatingPlan'));
    }
    this.closeDropdown();
  }

  async handleBulkDelete(): Promise<void> {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    try {
      await Promise.all(ids.map(id =>
        firstValueFrom(this.http.delete(`${this.baseUrl}/api/subscriptionplans/${id}`))
      ));
      this.toast.success(this.t('plansDeletedSuccessfully'));
      this.selectedIds.set([]);
      await this.fetchPlans();
    } catch {
      this.toast.error(this.t('errorDeletingPlans'));
    }
  }

  // ── Delete Modal ──────────────────────────────────
  openDeleteModal(record: Plan): void {
    this.deleteState.set({
      visible: true,
      record,
      loading: false,
      error: null,
    });
    this.closeDropdown();
  }

  closeDelete(): void {
    if (this.deleteState().loading) return;
    this.deleteState.set({
      visible: false,
      record: null,
      loading: false,
      error: null,
    });
  }

  async handleDelete(): Promise<void> {
    const state = this.deleteState();
    const record = state.record;
    if (!record) return;

    this.deleteState.update(p => ({ ...p, loading: true, error: null }));

    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/api/subscriptionplans/${record.id}`)
      );
      this.toast.success(this.t('planDeletedSuccessfully'));
      this.selectedIds.update(prev => prev.filter(id => id !== record.id));
      await this.fetchPlans();
      this.closeDelete();
    } catch (err: any) {
      this.deleteState.update(p => ({
        ...p,
        loading: false,
        error: err.error?.message || this.t('deleteFailed'),
      }));
    }
  }

  // ── Dropdown ──────────────────────────────────────
  toggleDropdown(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.dropdown.update(prev =>
      prev.recordId === id && prev.visible
        ? { visible: false, recordId: null }
        : { visible: true, recordId: id }
    );
  }

  closeDropdown(): void {
    this.dropdown.set({ visible: false, recordId: null });
  }

  // ── Display Helpers ──────────────────────────────
  displayName(record: Plan): string {
    if (!record) return '';
    return this.language() === 'ar'
      ? record.nameInAr || record.name
      : record.name;
  }

  // ── i18n ──────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`plansList.${key}`);
  }
}