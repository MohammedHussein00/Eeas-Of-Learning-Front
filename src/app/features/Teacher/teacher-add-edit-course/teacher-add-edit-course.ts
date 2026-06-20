import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }            from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject as RXJSubject, takeUntil } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, ArrowRight, BookOpen, CheckCircle, Clock, XCircle,
  Users, Rocket, AlertCircle, Save, Plus, Eye,
  ChevronRight, ChevronLeft, LayoutDashboard, SendHorizonal,
  AlertTriangle, Star, DollarSign, Image, List, Settings,
  BarChart2, Award
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast }      from '../../../core/services/toast';

// ── Ant Design ──────────────────────────────────────────────────────
import { NzSpinModule }        from 'ng-zorro-antd/spin';
import { NzProgressModule }    from 'ng-zorro-antd/progress';
import { NzSelectModule }      from 'ng-zorro-antd/select';
import { NzInputModule }       from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule }      from 'ng-zorro-antd/switch';
import { NzUploadModule }      from 'ng-zorro-antd/upload';
import { NzModalModule }       from 'ng-zorro-antd/modal';
import { NzTagModule }         from 'ng-zorro-antd/tag';
import { NzTooltipModule }     from 'ng-zorro-antd/tooltip';
import { NzDrawerModule }      from 'ng-zorro-antd/drawer';
import { NzAlertModule }       from 'ng-zorro-antd/alert';
import { NzCheckboxModule }    from 'ng-zorro-antd/checkbox';

// ── Types ────────────────────────────────────────────────────────────
type ProfileStatus = 'loading' | 'ok' | 'no-profile' | 'not-verified';
type PublishStatus = 'Approved' | 'Pending' | 'Rejected' | 'ChangesRequested' | '';

interface Subject   { id: string; name: string; }
interface AcademicStage   { id: string; name?: string; stageName?: string; nameInAr?: string; }
interface AcademicYear    { id: string; name?: string; yearName?: string; nameInAr?: string; }
interface AcademicSection { id: string; name?: string; sectionName?: string; nameInAr?: string; academicYearId?: string; }

interface PublishRequest {
  id: string;
  status: PublishStatus;
  teacherNotes?: string;
  adminNotes?: string;
  adminFeedback?: string;
  requestedAt: string;
  createdAt?: string;
}

interface CourseData {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  longDescription?: string;
  whatYouWillLearn?: string;
  requirements?: string;
  subjectId?: string;
  subject?: { id: string; name: string };
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  language?: string;
  price?: number;
  discountPrice?: number | null;
  isFree?: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;
  isPublished?: boolean;
  studentCount?: number;
  rating?: number;
  totalLectures?: number;
  totalHours?: number;
  latestPublishRequest?: PublishRequest;
  sectionsPreview?: any[];
  academicStageId?: string;
  academicYearId?: string;
  academicSectionId?: string;
}

interface PlanAccess {
  hasAccess: boolean;
  reason?: string;
  currentCount?: number;
  maxCount?: number;
  isAdmin?: boolean;
  isUnlimited?: boolean;
  subscriptionPlanName?: string;
  monthlyCreateLimit?: number;
  createdThisMonth?: number;
  remainingCreations?: number;
  activeSlotsUsed?: number;
  activeSlotsLimit?: number;
  quotaResetDate?: string;
}

// Aligned with React useCourseForm — must mirror TeacherCourseBuilder's
// CompletionChecklist so the readiness % matches across pages.
interface CompletionChecklist {
  hasThumbnail: boolean;
  hasPromoVideo: boolean;
  hasDescription: boolean;
  hasObjectives: boolean;
  hasSections: boolean;
  hasLectures: boolean;
  isPublishable: boolean;
}

type FormStep = 0 | 1 | 2 | 3;

@Component({
  selector: 'app-teacher-add-edit-course',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzProgressModule,
    NzSelectModule,
    NzInputModule,
    NzInputNumberModule,
    NzSwitchModule,
    NzUploadModule,
    NzModalModule,
    NzTagModule,
    NzTooltipModule,
    NzDrawerModule,
    NzAlertModule,
    NzCheckboxModule,
  ],
  templateUrl: './teacher-add-edit-course.html',
  styleUrls:   ['./teacher-add-edit-course.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherAddEditCourse' },
  ],
})
export class TeacherAddEditCourse implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private fb        = inject(FormBuilder);

  private destroy$ = new RXJSubject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon       = ArrowLeft;
  readonly ArrowRightIcon      = ArrowRight;
  readonly BookOpenIcon        = BookOpen;
  readonly CheckCircleIcon     = CheckCircle;
  readonly ClockIcon           = Clock;
  readonly XCircleIcon         = XCircle;
  readonly UsersIcon           = Users;
  readonly RocketIcon          = Rocket;
  readonly AlertCircleIcon     = AlertCircle;
  readonly SaveIcon            = Save;
  readonly PlusIcon            = Plus;
  readonly EyeIcon             = Eye;
  readonly ChevronRightIcon    = ChevronRight;
  readonly ChevronLeftIcon     = ChevronLeft;
  readonly DashboardIcon       = LayoutDashboard;
  readonly SendIcon            = SendHorizonal;
  readonly AlertTriangleIcon   = AlertTriangle;
  readonly StarIcon            = Star;
  readonly DollarIcon          = DollarSign;
  readonly ImageIcon           = Image;
  readonly ListIcon            = List;
  readonly SettingsIcon        = Settings;
  readonly BarChartIcon        = BarChart2;
  readonly AwardIcon           = Award;

  // ── RTL Detection ──────────────────────────────────────────────────
  /** Returns true when the active language is RTL (Arabic). */
  get isRtl(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  /** Back-arrow: ArrowRight in RTL, ArrowLeft in LTR. */
  get backArrowIcon() {
    return this.isRtl ? this.ArrowRightIcon : this.ArrowLeftIcon;
  }

  /** "Previous step" chevron: ChevronRight in RTL, ChevronLeft in LTR. */
  get prevChevronIcon() {
    return this.isRtl ? this.ChevronRightIcon : this.ChevronLeftIcon;
  }

  /** "Next step" chevron: ChevronLeft in RTL, ChevronRight in LTR. */
  get nextChevronIcon() {
    return this.isRtl ? this.ChevronLeftIcon : this.ChevronRightIcon;
  }

  // ── State signals ──────────────────────────────────────────────────
  profileStatus       = signal<ProfileStatus>('loading');
  planAccess          = signal<PlanAccess | null>(null);
  planAccessLoaded    = signal(false);
  loading             = signal(false);
  submitting          = signal(false);
  networkError        = signal(false);
  sidebarDrawerOpen   = signal(false);
  showSuccessModal    = signal(false);
  showPublishModal    = signal(false);
  publishNotes        = signal('');

  subjects            = signal<Subject[]>([]);
  subjectsLoading     = signal(false);
  currentStep         = signal<FormStep>(0);
  courseData          = signal<CourseData | null>(null);
  createdCourseId     = signal<string | null>(null);
  existingThumbnail   = signal<string | null>(null);
  thumbnailFile       = signal<File | null>(null);
  thumbnailPreview    = signal<string | null>(null);
  isFree              = signal(false);

  // Academic classification
  academicStages      = signal<AcademicStage[]>([]);
  academicYears       = signal<AcademicYear[]>([]);
  academicSections    = signal<AcademicSection[]>([]);
  academicLoading     = signal(false);

  // Publish requests list (for history / resubmit)
  publishRequests     = signal<PublishRequest[]>([]);
  publishLoading      = signal(false);
  publishSubmitting   = signal(false);

  // Completion checklist — aligned with React useCourseForm
  completionChecklist = signal<CompletionChecklist>({
    hasThumbnail:   false,
    hasPromoVideo:  false,
    hasDescription: false,
    hasObjectives:  false,
    hasSections:    false,
    hasLectures:    false,
    isPublishable:  false,
  });

  // ── Derived ────────────────────────────────────────────────────────
  get courseId(): string | null {
    return this.route.snapshot.paramMap.get('id');
  }

  get isEditMode(): boolean {
    return !!this.courseId;
  }

  get completionPercent(): number {
    const c = this.completionChecklist();
    const checks = [
      c.hasThumbnail,
      c.hasDescription,
      c.hasObjectives,
      c.hasSections,
      c.hasLectures,
      c.hasPromoVideo,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  get thumbnailDisplayUrl(): string | null {
    return this.thumbnailPreview() ?? this.existingThumbnail();
  }

  // ── Reactive form ──────────────────────────────────────────────────
  form!: FormGroup;

  readonly steps = [
    { key: 'basics',     labelKey: 'stepBasics'     },
    { key: 'curriculum', labelKey: 'stepCurriculum'  },
    { key: 'pricing',    labelKey: 'stepPricing'     },
    { key: 'media',      labelKey: 'stepMedia'       },
  ] as const;

  readonly levels    = ['Beginner', 'Intermediate', 'Advanced'] as const;
  readonly languages = ['English', 'Arabic', 'French', 'Spanish', 'German'] as const;

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForm();
    this.checkProfileStatus();
    this.watchFreeToggle();
    this.watchAcademicCascade();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form init ──────────────────────────────────────────────────────
  private buildForm(): void {
    this.form = this.fb.group({
      // Step 0 – Basics
      title:            ['', [Validators.required, Validators.minLength(10)]],
      subtitle:         ['', [Validators.maxLength(500)]],
      description:      ['', [Validators.required, Validators.minLength(100)]],
      subjectId:        ['', Validators.required],
      language:         ['English', Validators.required],
      // Academic (optional)
      academicStageId:  [null],
      academicYearId:   [null],
      academicSectionId:[null],

      // Step 1 – Curriculum
      whatYouWillLearn: ['', [Validators.required, Validators.minLength(50)]],
      requirements:     [''],
      longDescription:  [''],

      // Step 2 – Pricing
      isFree:           [false],
      price:            [0, [Validators.min(0)]],
      discountPrice:    [null],

      // Step 3 – Media  (thumbnail handled separately via File signal)
    });
  }

  private watchFreeToggle(): void {
    this.form.get('isFree')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val: boolean) => {
        this.isFree.set(val);
        const priceCtrl = this.form.get('price')!;
        if (val) {
          priceCtrl.setValue(0);
          priceCtrl.clearValidators();
        } else {
          priceCtrl.setValidators([Validators.required, Validators.min(1)]);
        }
        priceCtrl.updateValueAndValidity();
      });
  }

  // Cascade: stage → years, year → sections
  private watchAcademicCascade(): void {
    this.form.get('academicStageId')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(stageId => {
        this.academicYears.set([]);
        this.academicSections.set([]);
        this.form.patchValue({ academicYearId: null, academicSectionId: null });
        if (stageId) this.fetchAcademicYears(stageId);
      });

    this.form.get('academicYearId')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(yearId => {
        this.academicSections.set([]);
        this.form.patchValue({ academicSectionId: null });
        if (yearId) this.fetchAcademicSections(yearId);
      });
  }

  // ── Profile & plan checks ──────────────────────────────────────────
  private async checkProfileStatus(): Promise<void> {
    try {
      // React version uses /api/Teacher/profile
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/Teacher/profile`)
      );
      if (res?.success && res?.data) {
        const isVerified = res.data?.isVerified;
        this.profileStatus.set(isVerified ? 'ok' : 'not-verified');
      } else {
        this.profileStatus.set('no-profile');
      }
      if (this.profileStatus() === 'ok') {
        await Promise.all([
          this.fetchSubjects(),
          this.fetchAcademicStages(),
          this.isEditMode ? this.fetchCourse() : this.checkPlanAccess(),
        ]);
      }
    } catch (err: any) {
      this.profileStatus.set(err?.status === 404 ? 'no-profile' : 'ok');
    }
  }

  private async checkPlanAccess(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/courses/plan-access`)
      );
      if (res?.success) this.planAccess.set(res.data);
      else              this.planAccess.set({ hasAccess: true });
    } catch {
      this.planAccess.set({ hasAccess: true });
    } finally {
      this.planAccessLoaded.set(true);
    }
  }

  // ── Data loading ───────────────────────────────────────────────────
  private async fetchSubjects(): Promise<void> {
    this.subjectsLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/subjects`)
      );
      const list = res?.success && Array.isArray(res.data) ? res.data
                 : Array.isArray(res?.data) ? res.data
                 : Array.isArray(res)       ? res
                 : [];
      this.subjects.set(list);
    } catch {
      this.toast.error(this.t('loadCategoriesError'));
    } finally {
      this.subjectsLoading.set(false);
    }
  }

  private async fetchAcademicStages(): Promise<void> {
    this.academicLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/academic/stages`)
      );
      const list = res?.success && Array.isArray(res.data) ? res.data
                 : Array.isArray(res) ? res : [];
      this.academicStages.set(list);
    } catch {
      // academic is optional; silently ignore
    } finally {
      this.academicLoading.set(false);
    }
  }

  private async fetchAcademicYears(stageId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/academic/stages/${stageId}/years`)
      );
      const list = res?.success && Array.isArray(res.data) ? res.data
                 : Array.isArray(res) ? res : [];
      this.academicYears.set(list);
    } catch { /* ignore */ }
  }

  private async fetchAcademicSections(yearId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/academic/sections`)
      );
      const all: AcademicSection[] = res?.data || res || [];
      this.academicSections.set(all.filter(s => s.academicYearId === yearId));
    } catch { /* ignore */ }
  }

  private async fetchCourse(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/courses/admin/${this.courseId}`)
      );
      if (res?.success) {
        const c: CourseData = res.data;
        this.courseData.set(c);

        const imgUrl = c.imageUrl || c.thumbnailUrl || null;
        this.existingThumbnail.set(this.config.baseUrl +imgUrl);

        this.form.patchValue({
          title:             c.title            ?? '',
          subtitle:          c.subtitle         ?? '',
          description:       c.description      ?? '',
          longDescription:   c.longDescription  ?? '',
          whatYouWillLearn:  c.whatYouWillLearn ?? '',
          requirements:      c.requirements     ?? '',
          subjectId:         (c.subject as any)?.id ?? c.subjectId ?? '',
          language:          c.language  ?? 'English',
          price:             c.price     ?? 0,
          discountPrice:     c.discountPrice ?? null,
          isFree:            c.isFree    ?? false,
          academicStageId:   c.academicStageId   ?? null,
          academicYearId:    c.academicYearId    ?? null,
          academicSectionId: c.academicSectionId ?? null,
        });

        this.isFree.set(c.isFree ?? false);
        this.updateCompletionChecklist(c);
        await this.refineSectionsChecklist();

        // Fetch publish requests for history
        await this.fetchPublishRequests();
      }
    } catch (err: any) {
      if (err?.code === 'ERR_NETWORK' || err?.status === 0) {
        this.networkError.set(true);
      } else {
        this.toast.error(this.t('loadingCourseError'));
      }
    } finally {
      this.loading.set(false);
      this.planAccessLoaded.set(true);
    }
  }

  // ── Completion checklist — mirrors React useCourseForm ─────────────
  private updateCompletionChecklist(c: CourseData): void {
const hasLectures = (c.totalLectures ?? 0) > 0;


    const check: CompletionChecklist = {
      hasThumbnail:   !!(c.imageUrl || c.thumbnailUrl),
      hasPromoVideo:  !!c.promoVideoUrl,
      hasDescription: !!(c.description) && c.description.length >= 100,
      hasObjectives:  !!(c.whatYouWillLearn) && c.whatYouWillLearn.length >= 50,
      hasSections:    (c.sectionsPreview?.length ?? 0) > 0,
      hasLectures,
      isPublishable:  false,
    };
    check.isPublishable = check.hasThumbnail && check.hasDescription && check.hasObjectives
      && check.hasSections && check.hasLectures;
    this.completionChecklist.set(check);
  }

  // The "admin" course payload's sectionsPreview is often empty even when the
  // course has sections (the Course Builder loads sections from this endpoint
  // instead). Re-check section count the same way the builder does so the
  // "Has Sections" status — and the overall %  — matches across pages.
  private async refineSectionsChecklist(): Promise<void> {
    if (!this.courseId) return;
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/coursesections?courseId=${this.courseId}`)
      );
      const data = res?.success ? res.data : res;
      const sections: any[] = Array.isArray(data) ? data : [];
      const hasSections = sections.length > 0;

      this.completionChecklist.update(c => {
        const updated = { ...c, hasSections };
        updated.isPublishable = updated.hasThumbnail && updated.hasDescription && updated.hasObjectives
          && updated.hasSections && updated.hasLectures;
        return updated;
      });
    } catch { /* keep checklist value derived from course payload */ }
  }

  // ── Publish requests ───────────────────────────────────────────────
  async fetchPublishRequests(): Promise<void> {
    if (!this.courseId) return;
    this.publishLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/TeacherCoursePublish/course/${this.courseId}/requests`)
      );
      if (res?.success) this.publishRequests.set(res.data || []);
    } catch { /* ignore */ }
    finally { this.publishLoading.set(false); }
  }

  get latestPublishRequest(): PublishRequest | null {
    const reqs = this.publishRequests();
    return reqs.length > 0 ? reqs[0] : (this.courseData()?.latestPublishRequest ?? null);
  }

  openPublishModal(): void  { this.showPublishModal.set(true); }
  closePublishModal(): void { this.showPublishModal.set(false); this.publishNotes.set(''); }

  async submitPublishRequest(): Promise<void> {
    if (!this.courseId) return;
    this.publishSubmitting.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/TeacherCoursePublish/request`, {
          courseId: this.courseId,
          teacherNotes: this.publishNotes(),
        })
      );
      if (res?.success) {
        this.toast.success(this.t('submitReviewSuccess'));
        this.closePublishModal();
        await this.fetchPublishRequests();
      }
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.t('submitRequestError'));
    } finally {
      this.publishSubmitting.set(false);
    }
  }

  // ── Step navigation ────────────────────────────────────────────────
  async goToStep(idx: number): Promise<void> {
    if (idx === this.currentStep()) return;
    if (idx < this.currentStep()) { this.currentStep.set(idx as FormStep); return; }
    if (await this.validateStep(this.currentStep())) {
      this.currentStep.set(idx as FormStep);
    }
  }

  async nextStep(): Promise<void> {
    if (await this.validateStep(this.currentStep()) && this.currentStep() < 3) {
      this.currentStep.set((this.currentStep() + 1) as FormStep);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set((this.currentStep() - 1) as FormStep);
    }
  }

  // Map every field name to a DOM ref for scroll-to behaviour
  private fieldRefs: Record<string, HTMLElement | null> = {};

  /** Call from template: [attr.data-field]="'title'" (or use registerFieldEl) */
  registerFieldEl(name: string, el: HTMLElement | null): void {
    this.fieldRefs[name] = el;
  }

  private stepFields: Record<FormStep, string[]> = {
    0: ['title', 'description', 'subjectId', 'language'],
    1: ['whatYouWillLearn'],
    2: [], // price validated dynamically
    3: [],
  };

  // Fields that have a minLength validator (so we show the error on blur+dirty, not just touched)
  readonly minLengthFields = new Set(['title', 'description', 'whatYouWillLearn']);

  // Returns true when we should show ANY error message for a field
  showError(name: string): boolean {
    const ctrl = this.form.get(name);
    if (!ctrl || ctrl.valid) return false;
    // Required: show as soon as touched (user left the field empty)
    if (ctrl.errors?.['required'] && ctrl.touched) return true;
    // MinLength / other: show only after user has typed something and left the field
    if (!ctrl.errors?.['required'] && ctrl.touched && ctrl.dirty) return true;
    return false;
  }

  // Returns the right error message key for a field
  errorKey(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl) return '';
    if (ctrl.errors?.['required'])   return `${name}Required`;
    if (ctrl.errors?.['minlength'])  return `${name}MinLength`;
    if (ctrl.errors?.['maxlength'])  return `${name}MaxLength`;
    if (ctrl.errors?.['min'])        return 'priceMin';
    return `${name}Invalid`;
  }

  // True when the field itself should have a red border
  isFieldInvalid(name: string): boolean {
    return this.showError(name);
  }

  private getStepFields(step: FormStep): string[] {
    if (step === 2) return this.isFree() ? [] : ['price'];
    return this.stepFields[step] ?? [];
  }

  private async validateStep(step: FormStep): Promise<boolean> {
    const fields = this.getStepFields(step);

    // Touch + dirty every field so all errors surface at once
    fields.forEach(name => {
      const ctrl = this.form.get(name);
      if (ctrl) { ctrl.markAsTouched(); ctrl.markAsDirty(); }
    });

    const invalid = fields.filter(name => this.form.get(name)?.invalid);
    if (invalid.length === 0) return true;

    // Scroll to the first invalid field
    this.scrollToField(invalid[0]);
    return false;
  }

  private scrollToField(name: string): void {
    // Prefer an explicit ref; fall back to data-field attribute selector
    const el: HTMLElement | null =
      this.fieldRefs[name] ??
      document.querySelector<HTMLElement>(`[data-field="${name}"]`);

    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief red ring flash to draw attention
        el.style.transition = 'box-shadow 0.3s ease';
        el.style.boxShadow  = '0 0 0 3px rgba(220,38,38,0.35)';
        el.style.borderRadius = '8px';
        setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      }, 60);
    }
  }

  hasStepError(step: number): boolean {
    return this.getStepFields(step as FormStep).some(name => {
      const c = this.form.get(name);
      return c?.invalid && c?.touched;
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────
  async handleSubmit(): Promise<void> {
    const { title, description, subjectId } = this.form.value;
    if (!title || !description || !subjectId) {
      this.toast.error(this.t('validationRequired'));
      return;
    }
    this.submitting.set(true);
    try {
      const fd = this.buildFormData();
      let res: any;
      const headers = { 'Content-Type': 'multipart/form-data' };

      if (this.isEditMode) {
        res = await firstValueFrom(
          this.http.put<any>(`${this.config.baseUrl}/api/courses/${this.courseId}`, fd)
        );
      } else {
        res = await firstValueFrom(
          this.http.post<any>(`${this.config.baseUrl}/api/courses`, fd)
        );
      }

      if (res?.success) {
        this.toast.success(this.isEditMode ? this.t('updateSuccess') : this.t('createSuccess'));
        if (!this.isEditMode && res.data?.id) {
          this.createdCourseId.set(res.data.id);
          this.showSuccessModal.set(true);
        }
      }
    } catch (err: any) {
      if (err?.status === 403) {
        const pa = err.error?.data ?? {};
        this.planAccess.set({ hasAccess: false, reason: err.error?.message, ...pa });
      } else {
        this.toast.error(err?.error?.message || this.t('saveFailed'));
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async handleSubmitWithValidation(): Promise<void> {
    // Validate all steps
    for (let step = 0 as FormStep; step <= 2; step++) {
      const fields = step === 2
        ? (this.isFree() ? [] : ['price'])
        : this.stepFields[step as FormStep];
      fields.forEach(name => this.form.get(name)?.markAsTouched());
      const valid = fields.every(name => this.form.get(name)?.valid !== false);
      if (!valid) {
        this.currentStep.set(step as FormStep);
        this.toast.error(this.t('validationError'));
        return;
      }
    }
    await this.handleSubmit();
  }

  // ── FormData — PascalCase keys matching React buildFormData ─────────
  private buildFormData(): FormData {
    const v = this.form.value;
    const fd = new FormData();
    const append = (key: string, val: any) => {
      if (val !== null && val !== undefined && val !== '') fd.append(key, String(val));
    };

    // Required
    fd.append('Title',       v.title);
    fd.append('Description', v.description);
    fd.append('Language',    v.language || 'English');
    fd.append('WhatYouWillLearn', v.whatYouWillLearn || '');
    fd.append('SubjectId',   String(v.subjectId));
    fd.append('Level',       v.level || 'Beginner');
    fd.append('IsFree',      String(v.isFree || false));
    fd.append('Price',       String(v.isFree ? 0 : (v.price || 0)));

    // Optional
    append('Subtitle',        v.subtitle);
    append('LongDescription', v.longDescription);
    append('Requirements',    v.requirements);
    if (v.discountPrice && !v.isFree) append('DiscountPrice', v.discountPrice);

    // Academic classification (optional)
    append('AcademicStageId',   v.academicStageId);
    append('AcademicYearId',    v.academicYearId);
    append('AcademicSectionId', v.academicSectionId);

    // Thumbnail
    if (this.thumbnailFile()) {
      fd.append('ThumbnailFile', this.thumbnailFile()!);
    } else if (this.isEditMode && this.existingThumbnail()) {
      fd.append('KeepExistingThumbnail', 'true');
    }

    return fd;
  }

  // ── Thumbnail handling ────────────────────────────────────────────
  onThumbnailSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) {
      this.toast.error(this.t('thumbnailImagesOnly'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error(this.t('thumbnailMaxSize'));
      return;
    }
    this.thumbnailFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.thumbnailPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeThumbnail(): void {
    this.thumbnailFile.set(null);
    this.thumbnailPreview.set(null);
  }

  // ── Publish status helper ──────────────────────────────────────────
  publishStatusMeta(status: PublishStatus): { color: string; labelKey: string } {
    const map: Record<string, { color: string; labelKey: string }> = {
      Approved:         { color: 'success',    labelKey: 'statusPublished'        },
      Pending:          { color: 'processing', labelKey: 'statusPendingReview'    },
      Rejected:         { color: 'error',      labelKey: 'statusRejected'         },
      ChangesRequested: { color: 'warning',    labelKey: 'statusChangesRequested' },
    };
    return map[status] ?? { color: 'default', labelKey: 'statusDraft' };
  }

  // ── Plan access helpers ────────────────────────────────────────────
  get planIsUnlimited(): boolean {
    return !!(this.planAccess() as any)?.isUnlimited;
  }

  get planLimitReached(): boolean {
    const pa = this.planAccess();
    return !this.planIsUnlimited
      && (pa?.remainingCreations === 0 && (pa?.monthlyCreateLimit ?? 0) > 0);
  }

  get planSlotFull(): boolean {
    const pa = this.planAccess();
    return !this.planIsUnlimited
      && (pa?.activeSlotsUsed ?? 0) >= (pa?.activeSlotsLimit ?? 0)
      && (pa?.activeSlotsLimit ?? 0) > 0;
  }

  planQuotaPercent(): number {
    const pa = this.planAccess();
    if (!pa?.monthlyCreateLimit) return 0;
    return Math.round(((pa.createdThisMonth ?? 0) / pa.monthlyCreateLimit) * 100);
  }

  // ── Academic name helper ───────────────────────────────────────────
  getAcademicName(item: any, currentLanguage = 'en'): string {
    if (currentLanguage === 'ar' && item?.nameInAr?.trim()) return item.nameInAr;
    return item?.name || item?.stageName || item?.yearName || item?.sectionName || '';
  }

  // ── Navigation ─────────────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/teacher/courses']); }

  goToBuilder(): void {
    const id = this.createdCourseId() ?? this.courseId;
    if (id) this.router.navigate(['/teacher/courses', id, 'builder']);
  }

  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
    this.router.navigate(['/teacher/courses']);
  }

  priceFormatter = (value: number | null): string =>
    value != null ? `EGP ${value.toLocaleString('en-US')}` : '';

  priceParser = (value: string): number => {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return Number(cleaned) || 0;
  };

  // ── i18n helper ────────────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`teacherAddEditCourse.${key}`);
  }
}