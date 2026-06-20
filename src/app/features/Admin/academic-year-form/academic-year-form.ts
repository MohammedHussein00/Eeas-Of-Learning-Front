// academic-year-form.ts
import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RxSubject } from 'rxjs';
import {
  LucideAngularModule,
  Calendar, ArrowLeft, Save, RefreshCw, X,
  CheckCircle, AlertTriangle, GraduationCap, ChevronDown,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// Ant Design
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
interface Stage {
  id: number;
  name: string;
  nameInAr: string;
  nameInEn?: string;
}

interface YearPayload {
  nameInEn: string;
  nameInAr: string;
  academicStageId: number;
  language: string;
  id?: number;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-academic-year-form',
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
  templateUrl: './academic-year-form.html',
  styleUrls: ['./academic-year-form.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'academicYearForm' },
  ],
})
export class AcademicYearForm implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private config = inject(APP_CONFIG);
  private toast = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly CalendarIcon = Calendar;
  readonly ArrowLeftIcon = ArrowLeft;
  readonly SaveIcon = Save;
  readonly RefreshCwIcon = RefreshCw;
  readonly XIcon = X;
  readonly CheckCircleIcon = CheckCircle;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly GraduationCapIcon = GraduationCap;
  readonly ChevronDownIcon = ChevronDown;

  // ── State Signals ─────────────────────────────────
  pageLoading = signal(false);
  stagesLoading = signal(false);
  stages = signal<Stage[]>([]);
  apiError = signal<string | null>(null);
  success = signal(false);
  language = signal('en');
  isEdit = signal(false);
  yearId = signal<number | null>(null);

  // ── Form ──────────────────────────────────────────  form!: FormGroup;
  form!: FormGroup;

  // ── Computed ──────────────────────────────────────
  selectedStage = computed(() => {
    const stageId = this.form?.get('academicStageId')?.value;
    if (!stageId) return null;
    return this.stages().find(s => s.id.toString() === stageId.toString()) || null;
  });

  showPreview = computed(() => {
    return !!this.form?.get('nameInEn')?.value || !!this.form?.get('academicStageId')?.value;
  });

  hasErrors = computed(() => {
    return this.form?.invalid && (this.form?.dirty || this.form?.touched);
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.yearId.set(parseInt(id, 10));
    }

    this.initForm();
    this.loadLanguage();
    this.fetchStages();

    if (this.isEdit() && this.yearId()) {
      this.fetchYear();
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
      academicStageId: ['', [Validators.required]],
    });
  }

  private loadLanguage(): void {
    // Sync with your i18n service if available
    // this.language.set(this.transloco.getActiveLang());
  }

  // ── Data Fetching ─────────────────────────────────
  async fetchStages(): Promise<void> {
    this.stagesLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/academic/stages`)
      );
      const stages: Stage[] = (res?.data || []).map((s: any) => ({
        id: s.id,
        name: s.name || '',
        nameInAr: s.nameInAr || '',
        nameInEn: s.nameInEn || s.name || '',
      }));
      this.stages.set(stages);
    } catch {
      this.apiError.set(this.t('errorFetchingStages'));
    } finally {
      this.stagesLoading.set(false);
    }
  }

  async fetchYear(): Promise<void> {
    this.pageLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/academic/years/${this.yearId()}`)
      );
      const y = res?.data || res;
      this.form.patchValue({
        nameInEn: y.nameInEn || '',
        nameInAr: y.nameInAr || '',
        academicStageId: y.academicStageId?.toString() || '',
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

    const payload: YearPayload = {
      nameInEn: values.nameInEn,
      nameInAr: values.nameInAr,
      academicStageId: parseInt(values.academicStageId, 10),
      language: this.language(),
    };

    try {
      if (this.isEdit() && this.yearId()) {
        await firstValueFrom(
          this.http.put(`${this.baseUrl}/api/academic/years`, { ...payload, id: this.yearId() })
        );
      } else {
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/api/academic/years`, payload)
        );
      }
      this.success.set(true);
      this.toast.success(this.t('savedSuccessfully'));
      setTimeout(() => this.navigateToList(), 1200);
    } catch (err: any) {
      if (err?.status === 409) {
        this.apiError.set(this.t('yearExists'));
      } else {
        this.apiError.set(err?.error?.message || this.t('submitError'));
      }
    }
  }

  // ── Navigation ────────────────────────────────────
  navigateToList(): void {
    this.router.navigate(['/dash/academics'], { queryParams: { tab: 'years' } });
  }

  navigateToAcademics(): void {
    this.router.navigate(['/dash/academics']);
  }

  // ── Display Helpers ───────────────────────────────
  displayStageName(s: Stage | null): string {
    if (!s) return '';
    return this.language() === 'ar'
      ? s.nameInAr || s.name
      : s.nameInEn || s.name;
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
    return this.transloco.translate(`academicYearForm.${key}`);
  }
}