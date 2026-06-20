// academic-stage-form.ts
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
  GraduationCap, ArrowLeft, Save, RefreshCw, X,
  CheckCircle, AlertTriangle,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

// Ant Design
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

// ── Types ─────────────────────────────────────────────
interface StagePayload {
  nameInEn: string;
  nameInAr: string;
  id?: number;
}

// ── Component ─────────────────────────────────────────
@Component({
  selector: 'app-academic-stage-form',
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
  templateUrl: './academic-stage-form.html',
  styleUrls: ['./academic-stage-form.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'academicStageForm' },
  ],
})
export class AcademicStageForm implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private config = inject(APP_CONFIG);
  private toast = inject(Toast);
  private transloco = inject(TranslocoService);

  private destroy$ = new RxSubject<void>();

  // ── Icons ──────────────────────────────────────────
  readonly GraduationCapIcon = GraduationCap;
  readonly ArrowLeftIcon = ArrowLeft;
  readonly SaveIcon = Save;
  readonly RefreshCwIcon = RefreshCw;
  readonly XIcon = X;
  readonly CheckCircleIcon = CheckCircle;
  readonly AlertTriangleIcon = AlertTriangle;

  // ── State Signals ─────────────────────────────────
  pageLoading = signal(false);
  apiError = signal<string | null>(null);
  success = signal(false);
  language = signal('en');
  isEdit = signal(false);
  stageId = signal<number | null>(null);

  // ── Form ──────────────────────────────────────────
  form!: FormGroup;

  // ── Computed ──────────────────────────────────────
  showPreview = computed(() => {
    return !!this.form?.get('nameInEn')?.value || !!this.form?.get('nameInAr')?.value;
  });

  hasErrors = computed(() => {
    return this.form?.invalid && (this.form?.dirty || this.form?.touched);
  });

  // ── Lifecycle ─────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.stageId.set(parseInt(id, 10));
    }

    this.initForm();
    this.loadLanguage();

    if (this.isEdit() && this.stageId()) {
      this.fetchStage();
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
      nameInAr: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    });
  }

  private loadLanguage(): void {
    // Sync with your i18n service if available
    // this.language.set(this.transloco.getActiveLang());
  }

  // ── Data Fetching ─────────────────────────────────
  async fetchStage(): Promise<void> {
    this.pageLoading.set(true);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/academic/stages/${this.stageId()}`)
      );
      const s = res?.data || res;
      this.form.patchValue({
        nameInEn: s.nameInEn || '',
        nameInAr: s.nameInAr || '',
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

    const payload: StagePayload = {
      nameInEn: values.nameInEn,
      nameInAr: values.nameInAr,
    };

    try {
      if (this.isEdit() && this.stageId()) {
        await firstValueFrom(
          this.http.put(`${this.baseUrl}/api/academic/stages`, { ...payload, id: this.stageId() })
        );
      } else {
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/api/academic/stages`, payload)
        );
      }
      this.success.set(true);
      this.toast.success(this.t('savedSuccessfully'));
      setTimeout(() => this.navigateToList(), 1200);
    } catch (err: any) {
      if (err?.status === 409) {
        this.apiError.set(this.t('stageExists'));
      } else {
        this.apiError.set(err?.error?.message || this.t('submitError'));
      }
    }
  }

  // ── Navigation ────────────────────────────────────
  navigateToList(): void {
    this.router.navigate(['/dash/academics'], { queryParams: { tab: 'stages' } });
  }

  navigateToAcademics(): void {
    this.router.navigate(['/dash/academics']);
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
    return this.transloco.translate(`academicStageForm.${key}`);
  }
}