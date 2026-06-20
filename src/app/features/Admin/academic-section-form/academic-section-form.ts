import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }    from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  Users, ArrowLeft, Save, RefreshCw, X,
  CheckCircle, AlertTriangle, GraduationCap, Calendar, ChevronDown, Layers,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast }      from '../../../core/services/toast';

// Ant Design
import { NzSpinModule }    from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
interface Stage {
  id: number;
  name: string;
  nameInAr: string;
  nameInEn?: string;
}

interface Year {
  id: number;
  name: string;
  nameInAr: string;
  nameInEn?: string;
  academicStageId: number;
  stage: Stage | null;
}

interface SectionPayload {
  nameInEn: string;
  nameInAr: string;
  academicYearId: number;
  language: string;
  id?: number;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-academic-section-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzTooltipModule,
  ],
  templateUrl: './academic-section-form.html',
  styleUrls:   ['./academic-section-form.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'academicSectionForm' },
  ],
})
export class AcademicSectionForm implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private fb        = inject(FormBuilder);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly UsersIcon           = Users;
  readonly ArrowLeftIcon         = ArrowLeft;
  readonly SaveIcon              = Save;
  readonly RefreshCwIcon         = RefreshCw;
  readonly XIcon                 = X;
  readonly CheckCircleIcon       = CheckCircle;
  readonly AlertTriangleIcon     = AlertTriangle;
  readonly GraduationCapIcon     = GraduationCap;
  readonly CalendarIcon          = Calendar;
  readonly ChevronDownIcon       = ChevronDown;
  readonly LayersIcon            = Layers;

  // ── State Signals ─────────────────────────────────
  pageLoading     = signal(false);
  yearsLoading    = signal(false);
  years           = signal<Year[]>([]);
  stages          = signal<Stage[]>([]);
  filterStageId   = signal<number | null>(null);
  apiError        = signal<string | null>(null);
  success         = signal(false);
  language        = signal('en');
  isEdit          = signal(false);
  sectionId       = signal<number | null>(null);

  // ── Form ──────────────────────────────────────────
  form!: FormGroup;

  // ── Computed ──────────────────────────────────────
  uniqueStages = computed(() => {
    const map = new Map<number, Stage>();
    this.stages().forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  });

  filteredYears = computed(() => {
    const fid = this.filterStageId();
    if (fid === null) return this.years();
    return this.years().filter(y => y.academicStageId === fid);
  });

  selectedYear = computed(() => {
    const yearId = this.form?.get('academicYearId')?.value;
    if (!yearId) return null;
    return this.years().find(y => y.id.toString() === yearId.toString()) || null;
  });

  showPreview = computed(() => {
    return !!this.form?.get('nameInEn')?.value || !!this.form?.get('academicYearId')?.value;
  });

  hasErrors = computed(() => {
    return this.form?.invalid && (this.form?.dirty || this.form?.touched);
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.sectionId.set(parseInt(id, 10));
    }

    this.initForm();
    this.loadLanguage();
    this.fetchStagesAndYears();

    if (this.isEdit() && this.sectionId()) {
      this.fetchSection();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private get baseUrl(): string { return this.config.baseUrl; }

  private initForm(): void {
    this.form = this.fb.group({
      nameInEn: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      nameInAr: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(150)]],
      academicYearId: ['', [Validators.required]],
    });
  }

  private loadLanguage(): void {
    // Sync with your i18n service if available
    // this.language.set(this.transloco.getActiveLang());
  }

  // ── Data Fetching ─────────────────────────────────
  async fetchStagesAndYears(): Promise<void> {
    this.yearsLoading.set(true);
    try {
      const [yr, st]: any[] = await Promise.all([
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/years`)),
        firstValueFrom(this.http.get(`${this.baseUrl}/api/academic/stages`)),
      ]);

      const allStages: Stage[] = (st?.data || []).map((s: any) => ({
        id: s.id,
        name: s.name || '',
        nameInAr: s.nameInAr || '',
        nameInEn: s.nameInEn || s.name || '',
      }));
      this.stages.set(allStages);

      const allYears: Year[] = (yr?.data || []).map((y: any) => ({
        id: y.id,
        name: y.name || '',
        nameInAr: y.nameInAr || '',
        nameInEn: y.nameInEn || y.name || '',
        academicStageId: y.academicStageId,
        stage: allStages.find(s => s.id === y.academicStageId) ?? null,
      }));
      this.years.set(allYears);
    } catch {
      this.apiError.set(this.t('errorFetchingYears'));
    } finally {
      this.yearsLoading.set(false);
    }
  }

  async fetchSection(): Promise<void> {
    this.pageLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/academic/sections/${this.sectionId()}`)
      );
      const s = res?.data || res;
      this.form.patchValue({
        nameInEn: s.nameInEn || '',
        nameInAr: s.nameInAr || '',
        academicYearId: s.academicYearId?.toString() || '',
      });
    } catch (err: any) {
      if (err?.status === 404) {
        this.navigateToList();
        return;
      }
      this.apiError.set(this.t('errorFetchingData'));
    } finally {
      this.pageLoading.set(false);
    }
  }

  // ── Submit ────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.apiError.set(null);
    const values = this.form.value;

    const payload: SectionPayload = {
      nameInEn: values.nameInEn,
      nameInAr: values.nameInAr,
      academicYearId: parseInt(values.academicYearId, 10),
      language: this.language(),
    };

    try {
      if (this.isEdit() && this.sectionId()) {
        await firstValueFrom(
          this.http.put(`${this.baseUrl}/api/academic/sections`, { ...payload, id: this.sectionId() })
        );
      } else {
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/api/academic/sections`, payload)
        );
      }
      this.success.set(true);
      this.toast.success(this.t('savedSuccessfully'));
      setTimeout(() => this.navigateToList(), 1200);
    } catch (err: any) {
      if (err?.status === 409) {
        this.apiError.set(this.t('sectionExistsInYear'));
      } else {
        this.apiError.set(err?.error?.message || this.t('submitError'));
      }
    }
  }

  // ── Navigation ────────────────────────────────────
  navigateToList(): void {
    this.router.navigate(['/dash/academics'], { queryParams: { tab: 'sections' } });
  }

  navigateToAcademics(): void {
    this.router.navigate(['/dash/academics']);
  }

  // ── Filter ────────────────────────────────────────
  setFilterStageId(id: number | null): void {
    this.filterStageId.set(id);
    this.form.get('academicYearId')?.setValue('');
  }

  // ── Display Helpers ───────────────────────────────
  displayStageName(s: Stage | null): string {
    if (!s) return '';
    return this.language() === 'ar'
      ? s.nameInAr || s.name
      : s.nameInEn || s.name;
  }

  displayYearName(y: Year | null): string {
    if (!y) return '';
    return this.language() === 'ar'
      ? y.nameInAr || y.name
      : y.nameInEn || y.name;
  }

  // ── Error Helpers ─────────────────────────────────
  hasFieldError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  getFieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) return this.t('fieldRequired');
    if (ctrl.errors['minlength']) return this.t('nameMinLength');
    if (ctrl.errors['maxlength']) return this.t('nameMaxLength');
    return '';
  }

  // ── i18n ──────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`academicSectionForm.${key}`);
  }
}