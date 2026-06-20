import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  LucideAngularModule, User, Camera, CreditCard, BookOpen, Shield,
  Upload, Eye, ArrowLeft, ArrowRight, ChevronRight, ChevronLeft, Save, CheckCircle,
  AlertCircle, AlertTriangle, Info, Clock, Star, Rocket, RefreshCw,
  Trash2, FileText, ArrowLeftRight, ClipboardCheck, X
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzProgressModule } from 'ng-zorro-antd/progress';

// ── Types ───────────────────────────────────────────────────────────
interface ProfileData {
  id: string;
  fullName: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  yearsOfExperience: number;
  teachingSubjectId: string;
  teachingLevel: string;
  profilePictureUrl: string;
  idDocumentUrl: string;
  idDocumentBackUrl: string;
  degreeDocumentUrl: string;
  certificateUrl: string;
  isVerified: boolean;
  verificationStatus: number; // 0=Pending 1=UnderReview 2=Approved 3=Rejected
  rejectionReason?: string;
}

interface Subject   { id: string; name: string; }
interface PageError { message: string; detail?: string; }
interface StepConfig { key: string; icon: any; titleKey: string; descKey: string; }

type DocFileKey = 'identityFront' | 'identityBack' | 'degreeDocument' | 'certificate';
type DocUrlKey  = 'idDocument' | 'idDocumentBack' | 'degreeDocument' | 'certificate';

interface DocFiles    { identityFront: File|null; identityBack: File|null; degreeDocument: File|null; certificate: File|null; }
interface DocErrors   { identityFront: string; identityBack: string; degreeDocument: string; certificate: string; }
interface DocProgress { identityFront: number; identityBack: number; degreeDocument: number; certificate: number; }
interface DocUploading{ identityFront: boolean; identityBack: boolean; degreeDocument: boolean; certificate: boolean; }
interface DocPreviews { identityFront: string; identityBack: string; degreeDocument: string; certificate: string; }


interface DocMimeTypes { idDocument: string; idDocumentBack: string; degreeDocument: string; certificate: string; }

/** Value sent as `DocumentType` in the multipart form for uploads */
const DOC_TYPE: Record<DocFileKey, string> = {
  identityFront:  'IdDocument',
  identityBack:   'IdDocumentBack',
  degreeDocument: 'DegreeDocument',
  certificate:    'Certificate',
};

/** Path segment used for DELETE /api/Teacher/files/{fileType} */
const DEL_TYPE: Record<DocUrlKey, string> = {
  idDocument:     'id',
  idDocumentBack: 'idback',
  degreeDocument: 'degree',
  certificate:    'certificate',
};

/** Maps DocFileKey → DocUrlKey so we can update docMimeTypes after upload */
const FILE_TO_URL_KEY: Record<DocFileKey, DocUrlKey> = {
  identityFront:  'idDocument',
  identityBack:   'idDocumentBack',
  degreeDocument: 'degreeDocument',
  certificate:    'certificate',
};

/** Returns true for any MIME type or URL that represents a raster/vector image */
function mimeIsImage(mime: string): boolean {
  return /^image\//i.test(mime);
}

/**
 * Fallback: sniff the URL itself for a known image extension.
 * Strips query strings and fragments before checking.
 * Used only when no MIME type is stored (e.g. on first load from server).
 */
function urlLooksLikeImage(url: string): boolean {
  try {
    const clean = url.split('?')[0].split('#')[0];
    return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(clean);
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslocoModule, LucideAngularModule,
    NzSpinModule, NzModalModule, NzFormModule, NzInputModule,
    NzInputNumberModule, NzDatePickerModule, NzSelectModule,
    NzProgressModule, NzUploadModule,
  ],
  templateUrl: './teacher-profile.html',
  styleUrls: ['./teacher-profile.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'teacherProfile' }],
})
export class TeacherProfile implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private router    = inject(Router);
  private fb        = inject(FormBuilder);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private cdr       = inject(ChangeDetectorRef);
  private zone      = inject(NgZone);

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  // ── Icons ────────────────────────────────────────────
  readonly UserIcon           = User;
  readonly CameraIcon         = Camera;
  readonly CreditCardIcon     = CreditCard;
  readonly BookOpenIcon       = BookOpen;
  readonly ShieldIcon         = Shield;
  readonly UploadIcon         = Upload;
  readonly EyeIcon            = Eye;
  readonly ArrowLeftIcon      = ArrowLeft;
  readonly ArrowRightIcon     = ArrowRight;
  readonly ChevronRightIcon   = ChevronRight;
  readonly ChevronLeftIcon    = ChevronLeft;
  readonly SaveIcon           = Save;
  readonly CheckCircleIcon    = CheckCircle;
  readonly AlertCircleIcon    = AlertCircle;
  readonly AlertTriangleIcon  = AlertTriangle;
  readonly InfoIcon           = Info;
  readonly ClockIcon          = Clock;
  readonly StarIcon           = Star;
  readonly RocketIcon         = Rocket;
  readonly RefreshCwIcon      = RefreshCw;
  readonly Trash2Icon         = Trash2;
  readonly FileTextIcon       = FileText;
  readonly ArrowLeftRightIcon = ArrowLeftRight;
  readonly ClipboardCheckIcon = ClipboardCheck;
  readonly XIcon              = X;

  // ── RTL Detection ────────────────────────────────────
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

  // ── Page state ───────────────────────────────────────
  loading         = signal(true);
  pageError       = signal<PageError | null>(null);
  hasProfile      = signal(false);
  profileData     = signal<ProfileData | null>(null);
  subjects        = signal<Subject[]>([]);
  currentStep     = signal(0);
  savingProfile   = signal(false);
  creatingProfile = signal(false);
  submitSuccess   = signal(false);
  submitError     = signal('');
  showVerifModal  = signal(false);
  submittingVerif = signal(false);
  verifStatus     = signal({ isEligible: false, requirements: [] as string[] });

  // ── Photo state ──────────────────────────────────────
  photoPreviewUrl = signal<string | null>(null);
  selectedFile    = signal<File | null>(null);
  uploading       = signal(false);
  uploadProgress  = signal(0);
  uploadError     = signal('');
  photoZoom       = signal(false);

  hasImageChanges = computed(() => this.selectedFile() !== null);

  displayImage = computed(() => {
    const preview = this.photoPreviewUrl();
    if (preview) return preview;
    const url = this.profileData()?.profilePictureUrl;
    if (!url) return null;
    return this.resolveUrl(url);
  });

  // ── Document state ───────────────────────────────────
  selectedDocFiles = signal<DocFiles>({
    identityFront: null, identityBack: null, degreeDocument: null, certificate: null,
  });
  docErrors    = signal<DocErrors>({
    identityFront: '', identityBack: '', degreeDocument: '', certificate: '',
  });
  docProgress  = signal<DocProgress>({
    identityFront: 0, identityBack: 0, degreeDocument: 0, certificate: 0,
  });
  docUploading = signal<DocUploading>({
    identityFront: false, identityBack: false, degreeDocument: false, certificate: false,
  });
  docPreviews = signal<DocPreviews>({
    identityFront: '', identityBack: '', degreeDocument: '', certificate: '',
  });
  docZoomUrl = signal<string | null>(null);

  /**
   * Stores the MIME type for each document slot.
   * Set when the user selects a file (from File.type) and retained after
   * a successful upload so the template can decide image vs PDF display
   * without relying on the server URL having a file extension.
   * Also populated on initial load by sniffing the URL extension as a
   * best-effort fallback (see syncMimeTypesFromUrls).
   */
  docMimeTypes = signal<DocMimeTypes>({
    idDocument: '', idDocumentBack: '', degreeDocument: '', certificate: '',
  });

  docUrls = computed(() => ({
    idDocument:     this.profileData()?.idDocumentUrl     ?? '',
    idDocumentBack: this.profileData()?.idDocumentBackUrl ?? '',
    degreeDocument: this.profileData()?.degreeDocumentUrl ?? '',
    certificate:    this.profileData()?.certificateUrl    ?? '',
  }));

  // ── Steps ────────────────────────────────────────────
  readonly steps: StepConfig[] = [
    { key: 'profile', icon: User,       titleKey: 'stepProfile', descKey: 'stepProfileDesc' },
    { key: 'photo',   icon: Camera,     titleKey: 'stepPhoto',   descKey: 'stepPhotoDesc'   },
    { key: 'docs',    icon: CreditCard, titleKey: 'stepDocs',    descKey: 'stepDocsDesc'    },
  ];

  // ── Form ─────────────────────────────────────────────
  profileForm: FormGroup = this.fb.group({
    fullName:          ['', [Validators.required, Validators.maxLength(100)]],
    gender:            [''],
    dateOfBirth:       [null],
    yearsOfExperience: [0, [Validators.min(0), Validators.max(60)]],
    bio:               ['', [Validators.required, Validators.maxLength(200)]],
    teachingSubjectId: [''],
    teachingLevel:     [''],
  });

  // ── Lifecycle ────────────────────────────────────────
  ngOnInit(): void  { this.loadProfile(); }
  ngOnDestroy(): void {
    const prev = this.photoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
  }

  // ════════════════════════════════════════════════════
  //  URL helpers
  // ════════════════════════════════════════════════════

  /**
   * Resolves a raw URL from the server into an absolute URL the browser
   * can fetch. Handles three cases:
   *   1. Already absolute (http/https) → return as-is
   *   2. Protocol-relative (//host/path) → return as-is
   *   3. Relative path → prepend baseUrl, normalising double slashes
   */
  resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('//')) return url;
    const base = this.config.baseUrl.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  getDocUrl(key: DocUrlKey): string { return this.docUrls()[key]; }

  getFullDocUrl(key: DocUrlKey): string | null {
    const url = this.getDocUrl(key);
    if (!url) return null;
    return this.resolveUrl(url);
  }

  /**
   * Determines whether a document slot should render as an <img> or a
   * PDF/file placeholder.
   *
   * Priority order:
   *   1. A stored MIME type (set when user selected the file or on prev upload)
   *   2. URL extension sniffing as last resort
   *
   * The old implementation only did (2), which broke for extensionless
   * server URLs (blob storage, signed URLs, API proxy routes).
   */
  isDocImage(key: DocUrlKey): boolean {
    const mime = this.docMimeTypes()[key];
    if (mime) return mimeIsImage(mime);
    // Fallback: sniff the saved URL for a known image extension
    return urlLooksLikeImage(this.getDocUrl(key));
  }

  /**
   * Called after loadProfile() to back-fill MIME type hints from the URL
   * for any slot that doesn't already have a stored MIME type.
   * This covers the first page load when no file has been selected in
   * this session yet.
   */
  private syncMimeTypesFromUrls(): void {
    const urls = this.docUrls();
    this.docMimeTypes.update(m => ({
      idDocument:     m.idDocument     || (urlLooksLikeImage(urls.idDocument)     ? 'image/jpeg' : m.idDocument),
      idDocumentBack: m.idDocumentBack || (urlLooksLikeImage(urls.idDocumentBack) ? 'image/jpeg' : m.idDocumentBack),
      degreeDocument: m.degreeDocument || (urlLooksLikeImage(urls.degreeDocument) ? 'image/jpeg' : m.degreeDocument),
      certificate:    m.certificate    || (urlLooksLikeImage(urls.certificate)    ? 'image/jpeg' : m.certificate),
    }));
  }

  openDocZoom(key: DocUrlKey): void {
    const url = this.getFullDocUrl(key);
    if (url && this.isDocImage(key)) this.docZoomUrl.set(url);
  }
  closeDocZoom(): void { this.docZoomUrl.set(null); }

  // ════════════════════════════════════════════════════
  //  LOAD
  //  Does NOT set loading(true) on refresh calls that happen silently
  //  after an upload — avoids unmounting the whole page mid-interaction.
  // ════════════════════════════════════════════════════
  async retryLoad(): Promise<void> { await this.loadProfile(true); }

  /**
   * @param showSpinner  true = full-page spinner (initial load, retry)
   *                     false = silent background refresh (after upload/delete)
   */
  private async loadProfile(showSpinner = true): Promise<void> {
    if (showSpinner) this.loading.set(true);
    this.pageError.set(null);
    try {
      const [profileRes, subjectsRes] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/Teacher/profile`)),
        firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/Subjects`)),
      ]);
      this.subjects.set(subjectsRes?.data ?? []);
      if (profileRes?.data) {
        const p: ProfileData = profileRes.data;
        this.hasProfile.set(true);
        this.profileData.set(p);
        this.patchForm(p);
        this.checkVerificationStatus(p);
        // Back-fill MIME hints from URLs for slots not yet touched this session
        this.syncMimeTypesFromUrls();
      } else {
        this.hasProfile.set(false);
      }
    } catch (err: any) {
      this.pageError.set({
        message: err?.error?.message || this.t('loadFailed'),
        detail:  err?.error?.detail,
      });
    } finally {
      if (showSpinner) this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private patchForm(p: ProfileData): void {
    this.profileForm.patchValue({
      fullName:          p.fullName,
      gender:            p.gender,
      dateOfBirth:       p.dateOfBirth ? new Date(p.dateOfBirth) : null,
      yearsOfExperience: p.yearsOfExperience,
      bio:               p.bio,
      teachingSubjectId: p.teachingSubjectId,
      teachingLevel:     p.teachingLevel,
    });
  }

  private checkVerificationStatus(p: ProfileData): void {
    const reqs: string[] = [];
    if (!p.profilePictureUrl) reqs.push('photo');
    if (!p.idDocumentUrl)     reqs.push('idFront');
    if (!p.idDocumentBackUrl) reqs.push('idBack');
    if (!p.degreeDocumentUrl) reqs.push('degree');
    if (!p.certificateUrl)    reqs.push('certificate');
    if (!p.bio || p.bio.length < 20) reqs.push('bio');
    const pending = p.verificationStatus === 0 || p.verificationStatus === 1;
    this.verifStatus.set({
      isEligible:   reqs.length === 0 && !p.isVerified && !pending,
      requirements: reqs,
    });
  }

  // ════════════════════════════════════════════════════
  //  PROFILE CRUD
  // ════════════════════════════════════════════════════
  async handleCreateProfile(): Promise<void> {
    this.creatingProfile.set(true);
    try {
      await firstValueFrom(this.http.post(`${this.config.baseUrl}/api/Teacher`, {}));
      this.toast.success(this.t('createSuccess'));
      await this.loadProfile(true);
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.t('createFailed'));
    } finally { this.creatingProfile.set(false); }
  }

  async onSubmitProfile(): Promise<void> {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    this.submitError.set('');
    try {
      const raw = this.profileForm.value;
      const form = new FormData();
      form.append('fullName',          raw.fullName ?? '');
      form.append('gender',            raw.gender   ?? '');
      form.append('bio',               raw.bio      ?? '');
      form.append('yearsOfExperience', String(raw.yearsOfExperience ?? 0));
      form.append('teachingSubjectId', raw.teachingSubjectId ?? '');
      form.append('teachingLevel',     raw.teachingLevel ?? '');
      if (raw.dateOfBirth instanceof Date) {
        form.append('dateOfBirth', raw.dateOfBirth.toISOString().split('T')[0]);
      } else if (raw.dateOfBirth) {
        form.append('dateOfBirth', raw.dateOfBirth);
      }
      await firstValueFrom(this.http.put(`${this.config.baseUrl}/api/Teacher/profile`, form));
      this.toast.success(this.t('saveSuccess'));
      this.submitSuccess.set(true);
      setTimeout(() => this.submitSuccess.set(false), 3000);
      await this.loadProfile(false); // silent refresh — don't flash the spinner
    } catch (err: any) {
      this.submitError.set(err?.error?.message || this.t('saveFailed'));
      this.toast.error(this.submitError());
    } finally { this.savingProfile.set(false); }
  }

  // ════════════════════════════════════════════════════
  //  PHOTO
  // ════════════════════════════════════════════════════
  triggerPhotoInput(): void { this.photoInput.nativeElement.click(); }

  onPhotoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.uploadError.set(this.t('invalidImage')); input.value = ''; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set(this.t('imageTooLarge')); input.value = ''; return;
    }
    this.uploadError.set('');
    const prev = this.photoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.photoPreviewUrl.set(URL.createObjectURL(file));
    this.selectedFile.set(file);
    input.value = '';
    this.cdr.markForCheck();
  }

  async handleImageUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;
    this.uploading.set(true);
    this.uploadProgress.set(0);
    try {
      const form = new FormData();
      form.append('ProfileImage', file, file.name);
      await firstValueFrom(this.http.put(`${this.config.baseUrl}/api/Teacher/profile`, form));
      this.toast.success(this.t('uploadSuccess'));
      this.cancelImageSelect();
      await this.loadProfile(false);
    } catch (err: any) {
      this.uploadError.set(err?.error?.message || this.t('uploadFailed'));
      this.toast.error(this.uploadError());
    } finally { this.uploading.set(false); this.uploadProgress.set(0); }
  }

  cancelImageSelect(): void {
    const prev = this.photoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.photoPreviewUrl.set(null);
    this.selectedFile.set(null);
    this.uploadError.set('');
  }

  openPhotoZoom(): void  { this.photoZoom.set(true); }
  closePhotoZoom(): void { this.photoZoom.set(false); }

  // ════════════════════════════════════════════════════
  //  DOCUMENTS
  // ════════════════════════════════════════════════════
  /** Valid MIME types for document uploads — using Set for O(1) lookup */
  private readonly DOC_ACCEPT = new Set([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);
  private readonly DOC_MAX_SIZE = 10 * 1024 * 1024;

  /**
   * Dummy custom request that prevents ng-zorro from making any HTTP calls.
   * We handle uploads manually via handleDocUpload() so we need nz-upload
   * to act purely as a file picker without auto-upload behaviour.
   * Using nzAction="" was unreliable — nzCustomRequest is the correct hook.
   *
   * Must return a Subscription to satisfy NzUploadXHRArgs type signature.
   */
  readonly noopCustomRequest = (): Subscription => new Subscription();

  /**
   * Handles file selection from nz-upload's beforeUpload hook.
   * Validates type and size, stores the file, generates preview, and
   * records the MIME type so the template can render image vs PDF correctly.
   *
   * FIX: Replaced nzAction="" with nzCustomRequest for reliable file picking.
   * FIX: Handles both NzUploadFile (with originFileObj) and raw File objects,
   *      since ng-zorro may pass either depending on version.
   * FIX: Clears image previews for non-image files (PDFs) to prevent broken img tags.
   */
  private handleDocFile(key: DocFileKey, file: NzUploadFile): boolean {
    // ng-zorro's beforeUpload receives either:
    //   (a) NzUploadFile with originFileObj -> unwrap it
    //   (b) Raw File object (with uid added) -> use directly
    // See: https://github.com/NG-ZORRO/ng-zorro-antd/issues/4744
    const f: File | undefined = (file as any).originFileObj ?? (file as any);

    if (!f || !(f instanceof File)) {
      console.warn('[TeacherProfile] No valid File for upload key:', key, file);
      this.docErrors.update(e => ({ ...e, [key]: this.t('invalidFormat') }));
      this.cdr.markForCheck();
      return false;
    }

    const mime = f.type?.toLowerCase() || '';

    if (!this.DOC_ACCEPT.has(mime)) {
      this.docErrors.update(e => ({ ...e, [key]: this.t('invalidFormat') }));
      this.cdr.markForCheck();
      return false;
    }

    if (f.size > this.DOC_MAX_SIZE) {
      this.docErrors.update(e => ({ ...e, [key]: this.t('fileTooLarge') }));
      this.cdr.markForCheck();
      return false;
    }

    // Clear any previous error and store the selected file
    this.docErrors.update(e => ({ ...e, [key]: '' }));
    this.selectedDocFiles.update(s => ({ ...s, [key]: f }));

    // Store MIME type immediately — this is used by isDocImage() so the
    // template shows the correct preview type even before the upload.
    // We also keep it after upload so the saved-file view renders correctly
    // without relying on the server URL having an extension.
    const urlKey = FILE_TO_URL_KEY[key];
    this.docMimeTypes.update(m => ({ ...m, [urlKey]: f.type }));

    this.cdr.markForCheck();

    // Generate preview for images; clear preview for non-images (PDFs)
    if (mime.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        // FileReader callbacks run outside Angular's zone — must use zone.run()
        // to re-enter the zone so signal updates trigger change detection.
        this.zone.run(() => {
          this.docPreviews.update(p => ({ ...p, [key]: reader.result as string }));
          this.cdr.markForCheck();
        });
      };
      reader.onerror = () => {
        this.zone.run(() => {
          this.docPreviews.update(p => ({ ...p, [key]: '' }));
        });
      };
      reader.readAsDataURL(f);
    } else {
      // PDF or other non-image — clear any old image preview to prevent broken img
      this.docPreviews.update(p => ({ ...p, [key]: '' }));
    }

    return false; // prevent nz-upload auto-upload
  }

  readonly docUpload_identityFront  = (f: NzUploadFile) => this.handleDocFile('identityFront',  f);
  readonly docUpload_identityBack   = (f: NzUploadFile) => this.handleDocFile('identityBack',   f);
  readonly docUpload_degreeDocument = (f: NzUploadFile) => this.handleDocFile('degreeDocument', f);
  readonly docUpload_certificate    = (f: NzUploadFile) => this.handleDocFile('certificate',    f);

  async handleDocUpload(key: DocFileKey): Promise<void> {
    const file = this.selectedDocFiles()[key];
    if (!file) return;

    this.docUploading.update(u => ({ ...u, [key]: true }));
    this.docProgress.update(p => ({ ...p, [key]: 0 }));

    const form = new FormData();
    form.append('DocumentType', DOC_TYPE[key]);
    form.append('File', file, file.name);

    try {
      await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/Teacher/verification-documents`, form)
      );
      this.toast.success(this.t('docUploadSuccess'));

      // Clear the pending-file state BEFORE refreshing so the template
      // immediately switches from "pending upload" view to "saved file" view.
      this.cancelDocSelect(key);

      // Silent refresh — do NOT show the full-page spinner which would
      // unmount the documents step and discard the user's position.
      await this.loadProfile(false);
    } catch (err: any) {
      const msg = err?.error?.message || this.t('docUploadFailed');
      this.docErrors.update(e => ({ ...e, [key]: msg }));
      this.toast.error(msg);
    } finally {
      this.docUploading.update(u => ({ ...u, [key]: false }));
      this.docProgress.update(p => ({ ...p, [key]: 0 }));
    }
  }

  async handleDocDelete(key: DocUrlKey): Promise<void> {
    const fileType = DEL_TYPE[key];
    try {
      await firstValueFrom(
        this.http.delete(`${this.config.baseUrl}/api/Teacher/files/${fileType}`)
      );
      this.toast.success(this.t('docDeleteSuccess'));

      // Clear stored MIME type so the slot resets to empty state correctly
      this.docMimeTypes.update(m => ({ ...m, [key]: '' }));

      await this.loadProfile(false);
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.t('docDeleteFailed'));
    }
  }

  cancelDocSelect(key: DocFileKey): void {
    this.selectedDocFiles.update(s => ({ ...s, [key]: null }));
    this.docPreviews.update(p => ({ ...p, [key]: '' }));
    this.docErrors.update(e => ({ ...e, [key]: '' }));
    // Note: we intentionally do NOT clear docMimeTypes here —
    // the MIME type from the selected file should persist after upload
    // so the saved-file view renders correctly (image vs PDF).
  }

  // ════════════════════════════════════════════════════
  //  VERIFICATION
  // ════════════════════════════════════════════════════
  openVerifModal(): void  { this.showVerifModal.set(true); }
  closeVerifModal(): void { this.showVerifModal.set(false); }

  async submitVerification(): Promise<void> {
    this.submittingVerif.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/Teacher/submit-verification`, {})
      );
      this.toast.success(this.t('verifSubmitSuccess'));
      this.showVerifModal.set(false);
      await this.loadProfile(false);
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.t('verifSubmitFailed'));
    } finally { this.submittingVerif.set(false); }
  }

  // ════════════════════════════════════════════════════
  //  NAVIGATION
  // ════════════════════════════════════════════════════
  setStep(i: number): void { this.currentStep.set(i); }

  isStepCompleted(index: number): boolean {
    const p = this.profileData();
    if (!p) return false;
    if (index === 0) return !!p.fullName && !!p.bio;
    if (index === 1) return !!p.profilePictureUrl;
    if (index === 2) return !!p.idDocumentUrl && !!p.idDocumentBackUrl && !!p.degreeDocumentUrl;
    return false;
  }

  completeProfile(): void {
    this.toast.success(this.t('profileComplete'));
    this.router.navigate(['/teacher/profile']);
  }

  goBack(): void { this.router.navigate(['/teacher/profile']); }

  // ════════════════════════════════════════════════════
  //  TRANSLATION
  // ════════════════════════════════════════════════════
  t(key: string): string { return this.transloco.translate(`teacherProfile.${key}`); }
}