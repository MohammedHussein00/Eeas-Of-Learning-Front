import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }    from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  GraduationCap, Calendar, Users, LayoutGrid,
  Plus, Search, RefreshCw, Eye, Pencil, Trash2,
  MoreHorizontal, Link2, AlertTriangle, X, Layers,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast }      from '../../../core/services/toast';

// Ant Design
import { NzSpinModule }    from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
export type TabKey = 'stages' | 'years' | 'sections';

export interface AcademicStage {
  id: number;
  name: string;
  nameInAr: string;
}

export interface AcademicYear {
  id: number;
  name: string;
  nameInAr: string;
  academicStageId: number;
  stage: AcademicStage | null;
}

export interface AcademicSection {
  id: number;
  name: string;
  nameInAr: string;
  academicYearId: number;
  academicYear: AcademicYear | null;
}

interface RelatedInfo {
  years?: number;
  sections?: number;
}

interface DeleteState {
  visible: boolean;
  type: TabKey | '';
  record: any;
  loading: boolean;
  relatedInfo: RelatedInfo | null;
  error: string | null;
}

interface DetailsState {
  visible: boolean;
  type: TabKey | '';
  data: any;
}

interface DropdownState {
  visible: boolean;
  recordId: number | null;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-academic-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  templateUrl: './academic-management.html',
  styleUrls:   ['./academic-management.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'academicManagement' },
  ],
})
export class AcademicManagement implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly GraduationCapIcon   = GraduationCap;
  readonly CalendarIcon        = Calendar;
  readonly UsersIcon           = Users;
  readonly LayoutGridIcon      = LayoutGrid;
  readonly PlusIcon            = Plus;
  readonly SearchIcon          = Search;
  readonly RefreshCwIcon       = RefreshCw;
  readonly EyeIcon             = Eye;
  readonly PencilIcon          = Pencil;
  readonly Trash2Icon          = Trash2;
  readonly MoreHorizontalIcon  = MoreHorizontal;
  readonly Link2Icon           = Link2;
  readonly AlertTriangleIcon   = AlertTriangle;
  readonly XIcon               = X;
  readonly LayersIcon          = Layers;

  // ── Constants ─────────────────────────────────────
  readonly PAGE_SIZE = 10;
  readonly skeletonRows = Array(5).fill(0);

  readonly editRoute: Record<TabKey, string> = {
    stages:   '/dash/stages/',
    years:    '/dash/years/',
    sections: '/dash/sections/',
  };

  readonly addRoute: Record<TabKey, string> = {
    stages:   '/dash/add-stage',
    years:    '/dash/add-years',
    sections: '/dash/add-sections',
  };

  // ── State Signals ─────────────────────────────────
  initialLoading  = signal(true);
  fatalError      = signal(false);
  refreshing      = signal(false);

  activeTab       = signal<TabKey>('stages');
  searchQuery     = signal('');
  currentPage     = signal(1);

  stages          = signal<AcademicStage[]>([]);
  years           = signal<AcademicYear[]>([]);
  sections        = signal<AcademicSection[]>([]);

  loadingTabs     = signal<Record<TabKey, boolean>>({ stages: false, years: false, sections: false });
  statsData       = signal({ stages: 0, years: 0, sections: 0 });
  language        = signal('en');

  deleteState     = signal<DeleteState>({
    visible: false, type: '', record: null,
    loading: false, relatedInfo: null, error: null,
  });
  detailsState    = signal<DetailsState>({ visible: false, type: '', data: null });
  dropdown        = signal<DropdownState>({ visible: false, recordId: null });

  // ── Computed ──────────────────────────────────────
  isLoading = computed(() => this.loadingTabs()[this.activeTab()]);

  currentData = computed<any[]>(() => {
    const q    = this.searchQuery().toLowerCase();
    const tab  = this.activeTab();
    const lang = this.language();

    if (tab === 'stages') {
      const list = this.stages();
      return !q ? list : list.filter(s =>
        s.name?.toLowerCase().includes(q) || s.nameInAr?.toLowerCase().includes(q));
    }
    if (tab === 'years') {
      const list = this.years();
      return !q ? list : list.filter(y =>
        y.name?.toLowerCase().includes(q) ||
        y.nameInAr?.toLowerCase().includes(q) ||
        y.stage?.name?.toLowerCase().includes(q) ||
        y.stage?.nameInAr?.toLowerCase().includes(q));
    }
    // sections
    const list = this.sections();
    return !q ? list : list.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.nameInAr?.toLowerCase().includes(q) ||
      s.academicYear?.name?.toLowerCase().includes(q) ||
      s.academicYear?.nameInAr?.toLowerCase().includes(q));
  });

  pagedData = computed<any[]>(() => {
    const p = this.currentPage();
    return this.currentData().slice((p - 1) * this.PAGE_SIZE, p * this.PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.currentData().length / this.PAGE_SIZE)));

  pageEnd = computed(() =>
    Math.min(this.currentPage() * this.PAGE_SIZE, this.currentData().length));

  pageNumbers = computed<number[]>(() => {
    const tp = this.totalPages();
    const p  = this.currentPage();
    const count = Math.min(tp, 7);
    return Array.from({ length: count }, (_, i) => {
      if (tp <= 7) return i + 1;
      if (p <= 4)  return i + 1;
      if (p >= tp - 3) return tp - 6 + i;
      return p - 3 + i;
    });
  });

  // Delete modal derived text
  deleteTitle = computed(() => {
    const map: Record<string, string> = {
      stages:   this.t('deleteStage'),
      years:    this.t('deleteYear'),
      sections: this.t('deleteSection'),
    };
    return map[this.deleteState().type] || this.t('delete');
  });

  deleteWarningText = computed(() => {
    const { type, relatedInfo } = this.deleteState();
    if (type === 'stages') {
      const parts = [];
      if (relatedInfo?.years)    parts.push(`${relatedInfo.years} ${this.t('years')}`);
      if (relatedInfo?.sections) parts.push(`${relatedInfo.sections} ${this.t('sections')}`);
      return `${this.t('stageDeleteWarn')} ${parts.join(` ${this.t('and')} `)}`;
    }
    if (type === 'years') {
      return `${this.t('yearDeleteWarn')} ${relatedInfo?.sections} ${this.t('sections')}`;
    }
    return '';
  });

  // Details modal derived text
  detailsTitle = computed(() => {
    const map: Record<string, string> = {
      stages:   this.t('stageDetails'),
      years:    this.t('yearDetails'),
      sections: this.t('sectionDetails'),
    };
    return map[this.detailsState().type] || '';
  });

  detailsRelatedYears = computed<number | null>(() => {
    const { type, data } = this.detailsState();
    if (!data || type !== 'stages') return null;
    return this.years().filter(y => y.academicStageId === data.id).length;
  });

  detailsRelatedSections = computed<number | null>(() => {
    const { type, data } = this.detailsState();
    if (!data) return null;
    if (type === 'stages') {
      const stageYearIds = this.years()
        .filter(y => y.academicStageId === data.id)
        .map(y => y.id);
      return this.sections().filter(s => stageYearIds.includes(s.academicYearId)).length;
    }
    if (type === 'years') {
      return this.sections().filter(s => s.academicYearId === data.id).length;
    }
    return null;
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    // Sync tab from URL query param
    const tab = this.route.snapshot.queryParamMap.get('tab') as TabKey;
    if (tab && ['stages', 'years', 'sections'].includes(tab)) {
      this.activeTab.set(tab);
    }

    // Detect language (extend this with your i18n service if needed)
    // this.language.set(this.transloco.getActiveLang());

    // Close dropdown on outside click
    document.addEventListener('click', this.closeDropdownHandler);

    this.fetchAll();
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

  // ── Tab Navigation ────────────────────────────────
  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  navigate(path: string): void {
    this.router.navigateByUrl(path);
    this.closeDropdown();
  }

  navigateToAdd(): void {
    this.navigate(this.addRoute[this.activeTab()]);
  }

  navigateToEdit(type: TabKey | '', id: number): void {
    if (!type) return;
    this.navigate(this.editRoute[type] + id);
  }

  // ── Data Fetching ─────────────────────────────────
  async fetchAll(): Promise<void> {
    this.fatalError.set(false);
    try {
      await Promise.allSettled([
        this.fetchStages(),
        this.fetchYears(),
        this.fetchSections(),
      ]);
    } catch {
      this.fatalError.set(true);
    } finally {
      this.initialLoading.set(false);
    }
  }

  async handleRefresh(): Promise<void> {
    this.refreshing.set(true);
    await this.fetchAll();
    this.refreshing.set(false);
  }

  private setLoading(tab: TabKey, val: boolean): void {
    this.loadingTabs.update(prev => ({ ...prev, [tab]: val }));
  }

  private get baseUrl(): string { return this.config.baseUrl; }

  async fetchStages(): Promise<void> {
    this.setLoading('stages', true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/academic/stages`)
      );
      const data: AcademicStage[] = (res?.data || []).map((s: any) => ({
        id: s.id,
        name: s.name || s.stageName || '',
        nameInAr: s.nameInAr || s.stageNameInAr || '',
      }));
      this.stages.set(data);
      this.statsData.update(p => ({ ...p, stages: data.length }));
    } catch {
      this.toast.error(this.t('errorFetchingStages'));
    } finally {
      this.setLoading('stages', false);
    }
  }

  async fetchYears(): Promise<void> {
    this.setLoading('years', true);
    try {
      const [yr, st]: any[] = await Promise.all([
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/years`)),
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/stages`)),
      ]);
      const allStages: AcademicStage[] = (st?.data || []).map((s: any) => ({
        id: s.id, name: s.name || s.stageName || '', nameInAr: s.nameInAr || s.stageNameInAr || '',
      }));
      const data: AcademicYear[] = (yr?.data || []).map((y: any) => ({
        id: y.id,
        name: y.name || y.yearName || '',
        nameInAr: y.nameInAr || y.yearNameInAr || '',
        academicStageId: y.academicStageId,
        stage: allStages.find(s => s.id === y.academicStageId) ?? null,
      }));
      this.years.set(data);
      this.statsData.update(p => ({ ...p, years: data.length }));
    } catch {
      this.toast.error(this.t('errorFetchingYears'));
    } finally {
      this.setLoading('years', false);
    }
  }

  async fetchSections(): Promise<void> {
    this.setLoading('sections', true);
    try {
      const [sc, yr, st]: any[] = await Promise.all([
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/sections`)),
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/years`)),
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/stages`)),
      ]);
      const allStages: AcademicStage[] = (st?.data || []).map((s: any) => ({
        id: s.id, name: s.name || s.stageName || '', nameInAr: s.nameInAr || s.stageNameInAr || '',
      }));
      const allYears: AcademicYear[] = (yr?.data || []).map((y: any) => ({
        id: y.id, name: y.name || y.yearName || '', nameInAr: y.nameInAr || y.yearNameInAr || '',
        academicStageId: y.academicStageId,
        stage: allStages.find(s => s.id === y.academicStageId) ?? null,
      }));
      const data: AcademicSection[] = (sc?.data || []).map((s: any) => ({
        id: s.id,
        name: s.name || s.sectionName || '',
        nameInAr: s.nameInAr || s.sectionNameInAr || '',
        academicYearId: s.academicYearId,
        academicYear: allYears.find(y => y.id === s.academicYearId) ?? null,
      }));
      this.sections.set(data);
      this.statsData.update(p => ({ ...p, sections: data.length }));
    } catch {
      this.toast.error(this.t('errorFetchingSections'));
    } finally {
      this.setLoading('sections', false);
    }
  }

  // ── Search / Pagination ───────────────────────────
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

  // ── Cross-tab filter shortcuts ────────────────────
  filterToYears(stage: AcademicStage): void {
    this.setTab('years');
    this.searchQuery.set(stage.name);
  }

  filterToSections(year: AcademicYear): void {
    this.setTab('sections');
    this.searchQuery.set(year.name);
  }

  // ── Delete Modal ──────────────────────────────────
  openDeleteModal(type: TabKey, record: any): void {
    let relatedInfo: RelatedInfo | null = null;
    if (type === 'stages') {
      const relYears = this.years().filter(y => y.academicStageId === record.id);
      relatedInfo = {
        years: relYears.length,
        sections: this.sections().filter(s => relYears.some(y => y.id === s.academicYearId)).length,
      };
    } else if (type === 'years') {
      relatedInfo = { sections: this.sections().filter(s => s.academicYearId === record.id).length };
    }
    this.deleteState.set({ visible: true, type, record, loading: false, relatedInfo, error: null });
    this.closeDropdown();
  }

  closeDelete(): void {
    if (this.deleteState().loading) return;
    this.deleteState.set({ visible: false, type: '', record: null, loading: false, relatedInfo: null, error: null });
  }

  async handleDelete(): Promise<void> {
    const { type, record } = this.deleteState();
    if (!record) return;
    this.deleteState.update(p => ({ ...p, loading: true, error: null }));

    const endpoints: Record<string, string> = {
      stages:   `${this.baseUrl}/api/academic/stages/${record.id}`,
      years:    `${this.baseUrl}/api/academic/years/${record.id}`,
      sections: `${this.baseUrl}/api/academic/sections/${record.id}`,
    };

    try {
      await firstValueFrom(this.http.delete(endpoints[type]));
      this.toast.success(this.t('deletedSuccessfully'));
      await this.fetchAll();
      this.closeDelete();
    } catch (err: any) {
      const msg = err?.error?.message || this.t('deleteFailed');
      this.deleteState.update(p => ({ ...p, loading: false, error: msg }));
    }
  }

  // ── Details Modal ─────────────────────────────────
  openDetails(type: TabKey, data: any): void {
    this.detailsState.set({ visible: true, type, data });
    this.closeDropdown();
  }

  closeDetails(): void {
    this.detailsState.set({ visible: false, type: '', data: null });
  }

  // ── Display Helpers ───────────────────────────────
  displayName(record: any): string {
    if (!record) return '';
    return this.language() === 'ar'
      ? record.nameInAr || record.name
      : record.name;
  }

  // ── i18n ──────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`academicManagement.${key}`);
  }
}