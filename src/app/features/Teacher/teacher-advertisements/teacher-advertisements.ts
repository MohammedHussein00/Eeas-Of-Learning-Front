import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed
} from '@angular/core';
import { CommonModule, DatePipe }    from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router }                    from '@angular/router';
import { HttpClient, HttpRequest, HttpEventType } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import {
  LucideAngularModule,
  ArrowLeft, RefreshCw, Crown, Check, Lock, Plus,
  LayoutDashboard, Eye, Video, Image, Send, Trash2,
  Edit2, BarChart2, Zap, Info, Calendar,
  CheckCircle, Clock, XCircle, AlertTriangle, FileText, Rocket
} from 'lucide-angular';

import { APP_CONFIG }   from '../../../core/config/app.config';
import { Toast }        from '../../../core/services/toast';

// ── Ant Design ──────────────────────────────────────────────────────────
import { NzSpinModule }      from 'ng-zorro-antd/spin';
import { NzProgressModule }  from 'ng-zorro-antd/progress';
import { NzInputModule }     from 'ng-zorro-antd/input';
import { NzUploadModule }    from 'ng-zorro-antd/upload';
import { NzModalModule }     from 'ng-zorro-antd/modal';
import { NzTagModule }       from 'ng-zorro-antd/tag';
import { NzTooltipModule }   from 'ng-zorro-antd/tooltip';
import { NzAlertModule }     from 'ng-zorro-antd/alert';
import { NzTabsModule }      from 'ng-zorro-antd/tabs';
import { NzBadgeModule }     from 'ng-zorro-antd/badge';
import { NzFormModule }      from 'ng-zorro-antd/form';
import { NzUploadFile }      from 'ng-zorro-antd/upload';
import { NzButtonModule }    from 'ng-zorro-antd/button';
import { Observable }        from 'rxjs';

// ── Types ────────────────────────────────────────────────────────────────
interface PlanInfo {
  hasAccess: boolean;
  subscriptionPlanName?: string;
  remainingSubmissions: number;
  submittedThisMonth: number;
  monthlySubmitLimit: number;
  canUploadImage: boolean;   // kept for backend compat, no longer used in UI
  canUploadVideo: boolean;   // kept for backend compat, no longer used in UI
  maxVideoSeconds?: number;
  quotaResetDate?: string;
  reason?: string;
}

interface Advertisement {
  id: string;
  title: string;
  description?: string;
  status: 0 | 1 | 2;   // 0=pending, 1=approved, 2=rejected
  imagePath?: string;
  videoPath?: string;
  impressionCount?: number;
  reviewNote?: string;
  createdAt: string;
}

interface PreviewModal {
  type: 'image' | 'video';
  src: string;
}

// ── Constants ────────────────────────────────────────────────────────────
const MAX_VIDEO_SECONDS  = 30;
const MAX_IMAGE_BYTES    = 5   * 1024 * 1024;  // 5 MB
const MAX_VIDEO_BYTES    = 200 * 1024 * 1024;  // 200 MB
const ALLOWED_IMAGE_EXT  = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEO_EXT  = ['.mp4', '.mov', '.avi', '.webm'];

@Component({
  selector: 'app-teacher-advertisements',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, ReactiveFormsModule,
    TranslocoModule, LucideAngularModule,
    NzSpinModule, NzProgressModule, NzInputModule, NzUploadModule,
    NzModalModule, NzTagModule, NzTooltipModule, NzAlertModule,
    NzTabsModule, NzBadgeModule, NzFormModule, NzButtonModule,
  ],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherAdvertisements' }
  ],
  templateUrl: './teacher-advertisements.html',
  styleUrls:   ['./teacher-advertisements.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherAdvertisements implements OnInit, OnDestroy {

  // ── Injected services ────────────────────────────────────────────────
  readonly router    = inject(Router);
  private  http      = inject(HttpClient);
  private  fb        = inject(FormBuilder);
  private  toast     = inject(Toast);
  private  config    = inject(APP_CONFIG);
  private  transloco = inject(TranslocoService);

  get baseUrl() { return this.config.baseUrl; }

  // ── Lucide icons ──────────────────────────────────────────────────────
  ArrowLeftIcon    = ArrowLeft;
  RefreshCwIcon    = RefreshCw;
  CrownIcon        = Crown;
  CheckIcon        = Check;
  LockIcon         = Lock;
  PlusIcon         = Plus;
  LayoutIcon       = LayoutDashboard;
  EyeIcon          = Eye;
  VideoIcon        = Video;
  ImageIcon        = Image;
  SendIcon         = Send;
  TrashIcon        = Trash2;
  EditIcon         = Edit2;
  BarChartIcon     = BarChart2;
  ZapIcon          = Zap;
  InfoIcon         = Info;
  CalendarIcon     = Calendar;
  CheckCircleIcon  = CheckCircle;
  ClockIcon        = Clock;
  XCircleIcon      = XCircle;
  AlertIcon        = AlertTriangle;
  FileTextIcon     = FileText;
  RocketIcon       = Rocket;

  // ── State ────────────────────────────────────────────────────────────
  loading     = signal(true);
  submitting  = signal(false);
  uploadPct   = signal(0);

  planInfo    = signal<PlanInfo | null>(null);
  myAds       = signal<Advertisement[]>([]);

  activeTabIndex = signal(0);    // 0=create, 1=my ads

  imageFile   = signal<File | null>(null);
  videoFile   = signal<File | null>(null);
  mediaErrors = signal<{ image?: string; video?: string }>({});

  // Edit modal
  editModalVisible  = false;
  editingAd         = signal<Advertisement | null>(null);
  editForm!: FormGroup;

  // Delete modal
  deleteModalVisible = false;
  deleteLoading      = signal(false);
  private deleteId: string | null = null;

  // Preview modal
  previewModalVisible = false;
  previewModal        = signal<PreviewModal>({ type: 'image', src: '' });

  // Translation keys for tips sidebar
  readonly tips = ['tip_1', 'tip_2', 'tip_3'];

  // ── Computed ─────────────────────────────────────────────────────────
  hasAccess        = computed(() => this.planInfo()?.hasAccess ?? false);
  usedQuota        = computed(() => this.planInfo()?.submittedThisMonth ?? 0);
  totalQuota       = computed(() => this.planInfo()?.monthlySubmitLimit ?? 0);
  remainingQuota   = computed(() => this.planInfo()?.remainingSubmissions ?? 0);
  quotaPct         = computed(() => {
    const total = this.totalQuota();
    return total > 0 ? Math.round((this.usedQuota() / total) * 100) : 0;
  });
  quotaColor = computed(() => {
    const p = this.quotaPct();
    if (p >= 100) return '#dc2626';
    if (p > 75)   return '#d97706';
    return '#3d5af1';
  });
  canSubmit        = computed(() => this.hasAccess() && this.remainingQuota() > 0);
  totalImpressions = computed(() => this.myAds().reduce((s, a) => s + (a.impressionCount ?? 0), 0));
  approvedCount    = computed(() => this.myAds().filter(a => a.status === 1).length);
  pendingCount     = computed(() => this.myAds().filter(a => a.status === 0).length);

  // ── Forms ────────────────────────────────────────────────────────────
  createForm!: FormGroup;

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.createForm = this.fb.group({
      title:       ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
    });
    this.editForm = this.fb.group({
      title:       ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
    });
    this.fetchAll();
  }

  ngOnDestroy(): void {
    this._revokeObjectUrls();
  }

  private _objectUrls: string[] = [];

  private _createObjectUrl(file: File): string {
    const url = URL.createObjectURL(file);
    this._objectUrls.push(url);
    return url;
  }

  private _revokeObjectUrls(): void {
    this._objectUrls.forEach(u => URL.revokeObjectURL(u));
    this._objectUrls = [];
  }

  // ── Fetch ─────────────────────────────────────────────────────────────
  async fetchAll(showSpinner = true): Promise<void> {
    if (showSpinner) this.loading.set(true);
    try {
      const [planRes, adsRes] = await Promise.all([
        this.http.get<any>(`${this.baseUrl}/api/advertisement/my-plan-info`).toPromise(),
        this.http.get<any>(`${this.baseUrl}/api/advertisement/my`).toPromise(),
      ]);
      this.planInfo.set(planRes?.data ?? planRes);
      this.myAds.set(adsRes?.data ?? adsRes ?? []);
    } catch {
      this.toast.error(this.t('error_fetching_data'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private t(key: string): string {
    return this.transloco.translate(`teacherAdvertisements.${key}`);
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setActiveTab(tab: 'create' | 'myads'): void {
    this.activeTabIndex.set(tab === 'create' ? 0 : 1);
  }

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  onThumbError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // ── Status helpers ────────────────────────────────────────────────────
  getStatusClass(status: 0 | 1 | 2): string {
    const map: Record<number, string> = {
      0: 'status--pending',
      1: 'status--published',
      2: 'status--rejected',
    };
    return map[status] ?? 'status--draft';
  }

  getStatusIcon(status: 0 | 1 | 2): any {
    return status === 1 ? Check : status === 2 ? XCircle : Clock;
  }

  getStatusLabel(status: 0 | 1 | 2): string {
    const map: Record<number, string> = {
      0: 'ad_status_pending',
      1: 'ad_status_approved',
      2: 'ad_status_rejected',
    };
    return this.t(map[status] ?? 'ad_status_unknown');
  }

  // ── Image upload ───────────────────────────────────────────────────────
  handleImageBefore = (file: NzUploadFile): boolean | Observable<boolean> => {
    const rawFile = file as unknown as File;

    // Mutual exclusivity: cannot upload image if video already selected
    if (this.videoFile()) {
      this.mediaErrors.update(e => ({ ...e, image: this.t('remove_video_first') }));
      return false;
    }

    const ext = '.' + (rawFile.name ?? '').split('.').pop()!.toLowerCase();
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      this.mediaErrors.update(e => ({ ...e, image: this.t('ad_error_image_type') }));
      this.imageFile.set(null);
      return false;
    }
    if ((rawFile.size ?? 0) > MAX_IMAGE_BYTES) {
      this.mediaErrors.update(e => ({ ...e, image: this.t('ad_error_image_size') }));
      this.imageFile.set(null);
      return false;
    }
    this.mediaErrors.update(e => ({ ...e, image: undefined }));
    this.imageFile.set(rawFile);
    return false;
  };

  // ── Video upload ───────────────────────────────────────────────────────
  handleVideoBefore = (file: NzUploadFile): boolean | Observable<boolean> => {
    const rawFile = file as unknown as File;

    // Mutual exclusivity: cannot upload video if image already selected
    if (this.imageFile()) {
      this.mediaErrors.update(e => ({ ...e, video: this.t('remove_image_first') }));
      return false;
    }

    const ext = '.' + (rawFile.name ?? '').split('.').pop()!.toLowerCase();
    if (!ALLOWED_VIDEO_EXT.includes(ext)) {
      this.mediaErrors.update(e => ({ ...e, video: this.t('ad_error_video_type') }));
      this.videoFile.set(null);
      return false;
    }
    if ((rawFile.size ?? 0) > MAX_VIDEO_BYTES) {
      this.mediaErrors.update(e => ({ ...e, video: this.t('ad_error_video_size') }));
      this.videoFile.set(null);
      return false;
    }
    // Check duration async; return false immediately to prevent auto-upload
    this._checkVideoDuration(rawFile).then(dur => {
      const maxSec = this.planInfo()?.maxVideoSeconds ?? MAX_VIDEO_SECONDS;
      if (dur > maxSec) {
        this.mediaErrors.update(e => ({ ...e, video: this.t('ad_error_video_duration') }));
        this.videoFile.set(null);
      } else {
        this.mediaErrors.update(e => ({ ...e, video: undefined }));
        this.videoFile.set(rawFile);
      }
    }).catch(() => {
      // Let backend validate if metadata unreadable
      this.mediaErrors.update(e => ({ ...e, video: undefined }));
      this.videoFile.set(rawFile);
    });
    return false;
  };

  private _checkVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(vid.duration); };
      vid.onerror = () => { URL.revokeObjectURL(url); reject(); };
      vid.src = url;
    });
  }

  clearImage(): void {
    this.imageFile.set(null);
    // Clear both errors in case the other was blocked by this file
    this.mediaErrors.update(e => ({ ...e, image: undefined, video: undefined }));
  }

  clearVideo(): void {
    this.videoFile.set(null);
    // Clear both errors in case the other was blocked by this file
    this.mediaErrors.update(e => ({ ...e, video: undefined, image: undefined }));
  }

  // ── Create form ────────────────────────────────────────────────────────
  async handleSubmit(): Promise<void> {
    if (this.createForm.invalid || !this.canSubmit() || this.submitting()) return;
    if (this.mediaErrors().image || this.mediaErrors().video) return;

    // Safety guard: only one media type allowed
    if (this.imageFile() && this.videoFile()) {
      this.toast.error(this.t('ad_error_both_media'));
      return;
    }

    this.submitting.set(true);
    this.uploadPct.set(0);

    const fd = new FormData();
    fd.append('title',       this.createForm.value.title);
    fd.append('description', this.createForm.value.description ?? '');
    fd.append('startDate',   new Date().toISOString());
    fd.append('endDate',     new Date(Date.now() + 30 * 86400 * 1000).toISOString());
    if (this.imageFile()) fd.append('image', this.imageFile()!);
    if (this.videoFile()) fd.append('video', this.videoFile()!);

    const req = new HttpRequest('POST', `${this.baseUrl}/api/advertisement/submit`, fd, {
      reportProgress: true,
    });

    this.http.request(req).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadPct.set(Math.round((event.loaded * 100) / event.total));
        } else if (event.type === HttpEventType.Response) {
          this.toast.success(this.t('ad_submit_success'));
          this.resetForm();
          this.fetchAll(false);
          this.setActiveTab('myads');
          this.submitting.set(false);
          this.uploadPct.set(0);
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? this.t('ad_submit_error'));
        this.submitting.set(false);
      },
    });
  }

  resetForm(): void {
    this.createForm.reset();
    this.clearImage();
    this.clearVideo();
  }

  // ── Edit modal ─────────────────────────────────────────────────────────
  openEditModal(ad: Advertisement): void {
    this.editingAd.set(ad);
    this.editForm.patchValue({ title: ad.title, description: ad.description ?? '' });
    this.editModalVisible = true;
  }

  closeEditModal(): void {
    this.editModalVisible = false;
    this.editingAd.set(null);
    this.editForm.reset();
  }

  async handleUpdate(): Promise<void> {
    if (this.editForm.invalid || !this.editingAd()) return;
    try {
      await this.http.put(
        `${this.baseUrl}/api/advertisement/my/${this.editingAd()!.id}`,
        { title: this.editForm.value.title, description: this.editForm.value.description }
      ).toPromise();
      this.toast.success(this.t('ad_update_success'));
      this.closeEditModal();
      this.fetchAll(false);
    } catch (err: any) {
      this.toast.error(err?.error?.message ?? this.t('ad_update_error'));
    }
  }

  // ── Delete modal ───────────────────────────────────────────────────────
  openDeleteModal(id: string): void {
    this.deleteId = id;
    this.deleteModalVisible = true;
  }

  closeDeleteModal(): void {
    this.deleteModalVisible = false;
    this.deleteId = null;
    this.deleteLoading.set(false);
  }

  async handleDelete(): Promise<void> {
    if (!this.deleteId) return;
    this.deleteLoading.set(true);
    try {
      await this.http.delete(`${this.baseUrl}/api/advertisement/my/${this.deleteId}`).toPromise();
      this.toast.success(this.t('ad_delete_success'));
      this.closeDeleteModal();
      this.fetchAll(false);
    } catch (err: any) {
      this.toast.error(err?.error?.message ?? this.t('ad_delete_error'));
      this.deleteLoading.set(false);
    }
  }

  // ── Preview modal ──────────────────────────────────────────────────────
  openPreview(type: 'image' | 'video', file: File | null): void {
    if (!file) return;
    const src = this._createObjectUrl(file);
    this.previewModal.set({ type, src });
    this.previewModalVisible = true;
  }

  openPreviewUrl(type: 'image' | 'video', src: string): void {
    this.previewModal.set({ type, src });
    this.previewModalVisible = true;
  }

  closePreviewModal(): void {
    this.previewModalVisible = false;
  }
}