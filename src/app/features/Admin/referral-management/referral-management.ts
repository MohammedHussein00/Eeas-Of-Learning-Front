import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject, timeout } from 'rxjs';
import {
  LucideAngularModule,
  Gift, Users, CheckCircle, Clock, Coins, TrendingUp,
  Search, RefreshCw, Eye, Pencil, AlertTriangle, X,
  Layers, ToggleLeft, ToggleRight, Save, XCircle,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// Ant Design
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types (mirroring the C# DTOs) ────────────────────────────────────────────

export type TabKey = 'referrals' | 'completed' | 'pending';
export type ReferralStatus = 0 | 1 | 2; // 0 = Pending, 1 = Completed, 2 = Rejected

export interface ReferralRecord {
  id: number;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referredUserId: string;
  referredName: string;
  referredEmail: string;
  referralCode: string;
  rewardAmount: number;
  status: ReferralStatus;
  createdAt: string;
  rewardedAt: string | null;
  referredDeviceId?: string;
  failReason?: string;
}

export interface ReferralSettingDto {
  rewardAmount: number;
  isActive: boolean;
  updatedAt: string;
}

// ── Modal state shapes ────────────────────────────────────────────────────────

interface DetailsState {
  visible: boolean;
  data: ReferralRecord | null;
}

interface EditRewardState {
  visible: boolean;
  value: number;
  loading: boolean;
  error: string | null;
  originalValue: number;
}

interface ToggleState {
  visible: boolean;
  loading: boolean;
  error: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-referral-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  templateUrl: './referral-management.html',
  styleUrls: ['./referral-management.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'referralManagement' },
  ],
})
export class ReferralManagement implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private config = inject(APP_CONFIG);
  private toast = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();
  private updateVersion = 0; // For race condition handling
  private refreshTimeout: any = null;

  // ── Icons ──────────────────────────────────────────────────────────────────
  readonly GiftIcon = Gift;
  readonly UsersIcon = Users;
  readonly CheckCircleIcon = CheckCircle;
  readonly ClockIcon = Clock;
  readonly CoinsIcon = Coins;
  readonly TrendingUpIcon = TrendingUp;
  readonly SearchIcon = Search;
  readonly RefreshCwIcon = RefreshCw;
  readonly EyeIcon = Eye;
  readonly PencilIcon = Pencil;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly XIcon = X;
  readonly LayersIcon = Layers;
  readonly ToggleLeftIcon = ToggleLeft;
  readonly ToggleRightIcon = ToggleRight;
  readonly SaveIcon = Save;
  readonly XCircleIcon = XCircle;

  // ── Constants ──────────────────────────────────────────────────────────────
  readonly PAGE_SIZE = 10;
  readonly skeletonRows = Array(5).fill(0);

  // ── State signals ──────────────────────────────────────────────────────────
  initialLoading = signal(true);
  fatalError = signal(false);
  refreshing = signal(false);

  activeTab = signal<TabKey>('referrals');
  searchQuery = signal('');
  currentPage = signal(1);

  /** All referral records from the server */
  allReferrals = signal<ReferralRecord[]>([]);
  /** Admin program settings */
  setting = signal<ReferralSettingDto | null>(null);

  loadingReferrals = signal(false);
  loadingSetting = signal(false);

  // Modal states
  detailsState = signal<DetailsState>({ visible: false, data: null });

  editRewardState = signal<EditRewardState>({
    visible: false,
    value: 0,
    loading: false,
    error: null,
    originalValue: 0,
  });

  toggleState = signal<ToggleState>({
    visible: false,
    loading: false,
    error: null,
  });

  // ── Computed ───────────────────────────────────────────────────────────────

  isLoading = computed(() => this.loadingReferrals() || this.loadingSetting());

  /**
   * Non-null shortcut used in the details modal template.
   * Safe because the modal is only rendered when detailsState().data is truthy.
   */
  detailsData = computed(() => this.detailsState().data as ReferralRecord);

  /** Stats derived from allReferrals + setting */
  statsData = computed(() => {
    const refs = this.allReferrals();
    const totalRewards = refs
      .filter(r => r.status === 1)
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    return {
      totalReferrals: refs.length,
      completedReferrals: refs.filter(r => r.status === 1).length,
      pendingReferrals: refs.filter(r => r.status === 0).length,
      totalRewardsGiven: totalRewards,
    };
  });

  /** Tab-filtered then search-filtered list */
  currentData = computed<ReferralRecord[]>(() => {
    const tab = this.activeTab();
    const q = this.searchQuery().toLowerCase();

    let list = this.allReferrals();

    // Tab filter
    if (tab === 'completed') list = list.filter(r => r.status === 1);
    if (tab === 'pending') list = list.filter(r => r.status === 0);

    // Search filter
    if (!q) return list;
    return list.filter(r =>
      r.referrerName?.toLowerCase().includes(q) ||
      r.referrerEmail?.toLowerCase().includes(q) ||
      r.referredName?.toLowerCase().includes(q) ||
      r.referredEmail?.toLowerCase().includes(q) ||
      r.referralCode?.toLowerCase().includes(q)
    );
  });

  pagedData = computed<ReferralRecord[]>(() => {
    const p = this.currentPage();
    return this.currentData().slice((p - 1) * this.PAGE_SIZE, p * this.PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.currentData().length / this.PAGE_SIZE))
  );

  pageEnd = computed(() =>
    Math.min(this.currentPage() * this.PAGE_SIZE, this.currentData().length)
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

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Sync tab from URL - this is the key fix
    this.syncTabFromUrl();
    
    // Subscribe to route changes to update tab when URL changes
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as TabKey;
      if (tab && ['referrals', 'completed', 'pending'].includes(tab)) {
        // Only update if different to avoid loops
        if (this.activeTab() !== tab) {
          this.activeTab.set(tab);
          this.currentPage.set(1);
          this.searchQuery.set('');
        }
      }
    });

    this.fetchAll();
  }

  ngOnDestroy(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncTabFromUrl(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as TabKey;
    if (tab && ['referrals', 'completed', 'pending'].includes(tab)) {
      this.activeTab.set(tab);
      // Reset pagination and search when tab is set from URL
      this.currentPage.set(1);
      this.searchQuery.set('');
    }
  }

  // ── Data Fetching ──────────────────────────────────────────────────────────

  async fetchAll(): Promise<void> {
    // Don't fetch if we're already loading initially
    if (this.initialLoading() && this.fatalError()) {
      // Allow retry
    }

    this.fatalError.set(false);
    try {
      await Promise.all([
        this.fetchReferrals(),
        this.fetchSetting(),
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      this.fatalError.set(true);
    } finally {
      this.initialLoading.set(false);
    }
  }

  async handleRefresh(): Promise<void> {
    if (this.refreshing()) return;

    this.refreshing.set(true);
    try {
      await Promise.all([
        this.fetchReferrals(),
        this.fetchSetting(),
      ]);
      this.toast.success(this.t('refreshSuccess'));
    } catch (error) {
      this.toast.error(this.t('refreshFailed'));
    } finally {
      this.refreshing.set(false);
    }
  }

  private get baseUrl(): string { return this.config.baseUrl; }

  private async fetchReferrals(): Promise<void> {
    this.loadingReferrals.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/admin/referral/referrals`).pipe(timeout(30000))
      );
      // Expect res.data to be an array of referral records.
      // Map server fields → local interface (handle both camelCase and PascalCase APIs)
      const raw: any[] = res?.data ?? res ?? [];
      this.allReferrals.set(raw.map(r => ({
        id: r.id,
        referrerId: r.referrerId ?? r.ReferrerId ?? '',
        referrerName: r.referrerName ?? r.ReferrerName ?? r.referrer?.name ?? '',
        referrerEmail: r.referrerEmail ?? r.ReferrerEmail ?? r.referrer?.email ?? '',
        referredUserId: r.referredUserId ?? r.ReferredUserId ?? '',
        referredName: r.referredName ?? r.ReferredName ?? r.referredUser?.name ?? '',
        referredEmail: r.referredEmail ?? r.ReferredEmail ?? r.referredUser?.email ?? '',
        referralCode: r.referralCode ?? r.ReferralCode ?? '',
        rewardAmount: r.rewardAmount ?? r.RewardAmount ?? 0,
        status: r.status ?? r.Status ?? 0,
        createdAt: r.createdAt ?? r.CreatedAt ?? '',
        rewardedAt: r.rewardedAt ?? r.RewardedAt ?? null,
        referredDeviceId: r.referredDeviceId ?? r.ReferredDeviceId,
        failReason: r.failReason ?? r.FailReason,
      } as ReferralRecord)));
    } catch (error) {
      console.error('Error fetching referrals:', error);
      this.toast.error(this.t('errorFetchingReferrals'));
      throw error;
    } finally {
      this.loadingReferrals.set(false);
    }
  }

  private async fetchSetting(): Promise<void> {
    this.loadingSetting.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/admin/referral/settings`).pipe(timeout(30000))
      );
      const raw = res?.data ?? res;
      const newSetting: ReferralSettingDto = {
        rewardAmount: raw.rewardAmount ?? raw.RewardAmount ?? 0,
        isActive: raw.isActive ?? raw.IsActive ?? false,
        updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? '',
      };
      this.setting.set(newSetting);
    } catch (error) {
      console.error('Error fetching setting:', error);
      this.toast.error(this.t('errorFetchingSetting'));
      throw error;
    } finally {
      this.loadingSetting.set(false);
    }
  }

  // ── Tab / Search / Pagination ──────────────────────────────────────────────

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.currentPage.set(1);
    
    // Update URL with the tab parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  setPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.currentPage.set(n);
  }

  // ── Details Modal ──────────────────────────────────────────────────────────

  openDetails(row: ReferralRecord): void {
    this.detailsState.set({ visible: true, data: row });
  }

  closeDetails(): void {
    this.detailsState.set({ visible: false, data: null });
  }

  // ── Edit Reward Modal ──────────────────────────────────────────────────────

  openEditRewardModal(): void {
    const currentReward = this.setting()?.rewardAmount ?? 0;
    this.editRewardState.set({
      visible: true,
      value: currentReward,
      originalValue: currentReward,
      loading: false,
      error: null,
    });
  }

  closeEditReward(): void {
    if (this.editRewardState().loading) return;
    this.editRewardState.set({
      visible: false,
      value: 0,
      originalValue: 0,
      loading: false,
      error: null
    });
  }

  onRewardInput(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    const newValue = isNaN(val) ? 0 : val;

    // Clear error when user starts typing
    if (this.editRewardState().error) {
      this.editRewardState.update(p => ({ ...p, error: null }));
    }

    this.editRewardState.update(p => ({ ...p, value: newValue }));
  }

  async handleUpdateReward(): Promise<void> {
    // Prevent double-submit (e.g. double-click) from desyncing updateVersion
    // and leaving `loading` stranded at `true` forever.
    if (this.editRewardState().loading) return;

    const currentVersion = ++this.updateVersion;
    const currentState = this.editRewardState();
    const { value, originalValue } = currentState;

    // Validation
    if (!value || value <= 0) {
      this.editRewardState.update(p => ({ ...p, error: this.t('rewardRequired') }));
      return;
    }

    if (value > 1000000) {
      this.editRewardState.update(p => ({ ...p, error: this.t('rewardTooHigh') }));
      return;
    }

    // Check if value changed
    if (Math.abs(value - originalValue) < 0.01) {
      this.editRewardState.update(p => ({ ...p, error: this.t('noChange') }));
      // Auto close after 2 seconds
      setTimeout(() => {
        if (this.editRewardState().visible && this.editRewardState().error === this.t('noChange')) {
          this.closeEditReward();
        }
      }, 2000);
      return;
    }

    this.editRewardState.update(p => ({ ...p, loading: true, error: null }));

    try {
      const currentSetting = this.setting();
      const response: any = await firstValueFrom(
        this.http.put(`${this.baseUrl}/api/admin/referral/settings`, {
          rewardAmount: value,
          isActive: currentSetting?.isActive ?? true,
        }).pipe(timeout(15000))
      );

      // Only process if this is the latest request
      if (currentVersion === this.updateVersion) {
        const raw = response?.data ?? response;
        const newSetting: ReferralSettingDto = {
          rewardAmount: raw.rewardAmount ?? raw.RewardAmount ?? value,
          isActive: raw.isActive ?? raw.IsActive ?? (currentSetting?.isActive ?? true),
          updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? new Date().toISOString(),
        };

        this.setting.set(newSetting);
        this.toast.success(this.t('rewardUpdated'));
        // Clear `loading` first — closeEditReward() refuses to close the
        // modal while loading is still true, which left it stuck on
        // "saving" forever even though the request succeeded.
        this.editRewardState.update(p => ({ ...p, loading: false }));
        this.closeEditReward();

        // Optional: Refresh referrals to ensure consistency
        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
          this.fetchReferrals();
        }, 1000);
      }
    } catch (err: any) {
      if (currentVersion === this.updateVersion) {
        let msg = this.t('saveFailed');
        if (err?.error?.message) {
          msg = err.error.message;
        } else if (err?.message?.includes('timeout')) {
          msg = this.t('timeoutError');
        } else if (err?.status === 400) {
          msg = this.t('invalidAmount');
        } else if (err?.status === 403) {
          msg = this.t('permissionDenied');
        }
        this.editRewardState.update(p => ({ ...p, loading: false, error: msg }));
      }
    }
  }

  // ── Toggle Active Modal ────────────────────────────────────────────────────

  openToggleModal(): void {
    this.toggleState.set({ visible: true, loading: false, error: null });
  }

  closeToggle(): void {
    if (this.toggleState().loading) return;
    this.toggleState.set({ visible: false, loading: false, error: null });
  }

  async handleToggleActive(): Promise<void> {
    // Prevent double-submit from desyncing updateVersion and stranding `loading`.
    if (this.toggleState().loading) return;

    const currentVersion = ++this.updateVersion;
    const current = this.setting();
    if (!current) return;

    this.toggleState.update(p => ({ ...p, loading: true, error: null }));

    try {
      const response: any = await firstValueFrom(
        this.http.put(`${this.baseUrl}/api/admin/referral/settings`, {
          rewardAmount: current.rewardAmount,
          isActive: !current.isActive,
        }).pipe(timeout(15000))
      );

      if (currentVersion === this.updateVersion) {
        const raw = response?.data ?? response;
        const newSetting: ReferralSettingDto = {
          rewardAmount: raw.rewardAmount ?? raw.RewardAmount ?? current.rewardAmount,
          isActive: raw.isActive ?? raw.IsActive ?? !current.isActive,
          updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? new Date().toISOString(),
        };

        this.setting.set(newSetting);
        this.toast.success(
          !current.isActive ? this.t('programActivated') : this.t('programDeactivated')
        );
        // Same fix as in handleUpdateReward: closeToggle() refuses to close
        // while loading is true, so clear it first.
        this.toggleState.update(p => ({ ...p, loading: false }));
        this.closeToggle();
      }
    } catch (err: any) {
      if (currentVersion === this.updateVersion) {
        let msg = this.t('saveFailed');
        if (err?.error?.message) {
          msg = err.error.message;
        } else if (err?.message?.includes('timeout')) {
          msg = this.t('timeoutError');
        }
        this.toggleState.update(p => ({ ...p, loading: false, error: msg }));
      }
    }
  }

  // ── Display Helpers ────────────────────────────────────────────────────────

  /** Returns the first letter of a name for the avatar circle */
  avatarLetter(name: string): string {
    return name?.trim()?.[0]?.toUpperCase() ?? '?';
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  // ── i18n ──────────────────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`referralManagement.${key}`);
  }
}