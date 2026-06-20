import {
  Component, inject, signal, OnInit, OnDestroy,
  ChangeDetectionStrategy, computed, ChangeDetectorRef
} from '@angular/core';
import { CommonModule }           from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }             from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { firstValueFrom, Subject as RXJSubject } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft, Settings, Menu, Rocket, Users, Star, Play, Pause,
  Trophy, BarChart2, FileText, Plus, Eye, Edit2, Trash2,
  AppWindow, HelpCircle, History, Globe, Clock,
  AlertCircle, Check, Video, Paperclip, DollarSign,
  Image, Folder, Info, Wrench, Upload, Layers, X,
  Shield, AlertTriangle, Lock, Maximize2, Type, Hash,
  RefreshCw, Volume2, VolumeX
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
import { NzTabsComponent, NzTabComponent, NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzBadgeModule }       from 'ng-zorro-antd/badge';
import { NzAvatarModule }      from 'ng-zorro-antd/avatar';
import { NzRateModule }        from 'ng-zorro-antd/rate';
import { NzResultModule }      from 'ng-zorro-antd/result';
import { NzDividerModule }     from 'ng-zorro-antd/divider';
import { NzEmptyModule }       from 'ng-zorro-antd/empty';
import { NzUploadFile, NzBeforeUploadFileType } from 'ng-zorro-antd/upload';

// ── Types ────────────────────────────────────────────────────────────
interface CourseSection {
  id: string; title: string; description?: string;
  order: number; isPublished: boolean;
}
interface Lecture {
  id: string; title: string; description?: string; order: number;
  isFree: boolean; isPublished: boolean; durationMinutes: number;
  sectionId?: string; sectionTitle?: string;
  video?: { videoUrl: string; fileSize: number; formattedFileSize: string; durationSeconds: number; formattedDuration: string; resolution: string; format: string; };
  resources?: Resource[];
}
interface Resource { id: string; fileUrl: string; fileType: string; fileSize: number; }
interface Quiz {
  id: string; title: string; description?: string; type: string | number;
  passingScore: number; timeLimitMinutes?: number;
  lectureId?: string; lectureTitle?: string; sectionId?: string; sectionTitle?: string;
  quizTarget: 'lecture' | 'section';
}
interface Review {
  id: string; rating: number; comment?: string; userName?: string; userAvatar?: string;
  createdAt: string; isVerifiedPurchase?: boolean; instructorResponse?: string;
}
interface PublishRequest {
  id: string; courseId: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'ChangesRequested';
  requestedAt: string; reviewedAt?: string; teacherNotes?: string; adminFeedback?: string;
}
interface CourseData {
  id: string; title: string; subtitle?: string; description?: string;
  longDescription?: string; whatYouWillLearn?: string; requirements?: string;
  language?: string; level?: string; price?: number; isFree?: boolean;
  isPublished: boolean; thumbnailUrl?: string; imageUrl?: string; promoVideoUrl?: string;
  studentCount?: number; totalHours?: number; totalLectures?: number;
  rating?: number; ratingCount?: number;
  subject?: { id: string; name: string };
  sectionsPreview?: any[]; reviews?: Review[];
}
interface CompletionChecklist {
  hasThumbnail: boolean; hasPromoVideo: boolean; hasDescription: boolean;
  hasObjectives: boolean; hasSections: boolean; hasLectures: boolean; isPublishable: boolean;
}
interface ResourceFileItem {
  uid: string; name: string; status: string; url?: string; size?: number;
  type?: string; existing?: boolean; resourceId?: string; formattedDuration?: string;
}
interface CourseDocResource {
  id: string; fileName: string; fileUrl: string; fileType: string;
  fileSize: number; formattedSize?: string; createdAt: string;
}
interface CourseStatusMeta { text: string; icon: any; cls: string; }
interface StatCard { title: string; val: string | number; icon: any; cls: string; route?: any[]; }
interface ValidationError { field: string; message: string; }

const FILE_LIMITS = {
  promoVideo:   { maxSizeMB: 500,  allowedTypes: ['video/mp4','video/webm','video/ogg','video/quicktime'], allowedExtensions: ['.mp4','.webm','.ogg','.mov'] },
  lectureVideo: { maxSizeMB: 2048, allowedTypes: ['video/mp4','video/webm','video/ogg','video/quicktime','video/x-matroska'], allowedExtensions: ['.mp4','.webm','.ogg','.mov','.mkv'] },
  thumbnail:    { maxSizeMB: 5,    allowedTypes: ['image/jpeg','image/png','image/webp','image/gif'], allowedExtensions: ['.jpg','.jpeg','.png','.webp','.gif'], maxWidth:4096, maxHeight:4096, minWidth:200, minHeight:200 },
  resource:     { maxSizeMB: 100,  allowedTypes: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','application/zip','application/x-zip-compressed','image/*'], allowedExtensions: ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.zip','.jpg','.jpeg','.png','.gif','.webp'] },
};
const MAX_COURSE_RESOURCES = 10;

@Component({
  selector: 'app-teacher-course-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslocoModule, LucideAngularModule,
    NzSpinModule, NzProgressModule, NzSelectModule, NzInputModule, NzInputNumberModule,NzButtonModule,
    NzSwitchModule, NzUploadModule, NzModalModule, NzTagModule, NzTooltipModule,
    NzDrawerModule, NzAlertModule, NzTabsModule, NzBadgeModule, NzAvatarModule,
    NzRateModule, NzResultModule, NzDividerModule, NzEmptyModule,
  ],
  templateUrl: './teacher-course-builder.html',
  styleUrls: ['./teacher-course-builder.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'teacherCourseBuilder' }],
})
export class TeacherCourseBuilder implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);
  private fb        = inject(FormBuilder);
  private cdr       = inject(ChangeDetectorRef);

  private destroy$ = new RXJSubject<void>();

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon     = ArrowLeft;
  readonly SettingsIcon      = Settings;
  readonly MenuIcon          = Menu;
  readonly RocketIcon        = Rocket;
  readonly TeamIcon          = Users;
  readonly StarIcon          = Star;
  readonly PlayIcon          = Play;
  readonly PauseIcon         = Pause;
  readonly TrophyIcon        = Trophy;
  readonly BarChartIcon      = BarChart2;
  readonly FileTextIcon      = FileText;
  readonly PlusIcon          = Plus;
  readonly EyeIcon           = Eye;
  readonly EditIcon          = Edit2;
  readonly TrashIcon         = Trash2;
  readonly AppstoreIcon      = AppWindow;
  readonly QuestionIcon      = HelpCircle;
  readonly HistoryIcon       = History;
  readonly GlobeIcon         = Globe;
  readonly ClockIcon         = Clock;
  readonly AlertIcon         = AlertCircle;
  readonly CheckIcon         = Check;
  readonly VideoIcon         = Video;
  readonly PaperclipIcon     = Paperclip;
  readonly UsersAddIcon      = Users;
  readonly DollarIcon        = DollarSign;
  readonly ImageIcon         = Image;
  readonly FolderIcon        = Folder;
  readonly InfoIcon          = Info;
  readonly WrenchIcon        = Wrench;
  readonly UploadIcon        = Upload;
  readonly LayersIcon        = Layers;
  readonly XIcon             = X;
  readonly ShieldIcon        = Shield;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly LockIcon          = Lock;
  readonly MaximizeIcon      = Maximize2;
  readonly TypeIcon          = Type;
  readonly HashIcon          = Hash;
  readonly RefreshCwIcon     = RefreshCw;
  readonly Volume2Icon       = Volume2;
  readonly VolumeXIcon       = VolumeX;

  // ── Core state ─────────────────────────────────────────────────────
  loading              = signal(true);
  course               = signal<CourseData | null>(null);
  sections             = signal<CourseSection[]>([]);
  lectures             = signal<Lecture[]>([]);
  quizzes              = signal<Quiz[]>([]);
  reviews              = signal<Review[]>([]);
  reviewsLoading       = signal(false);
  publishRequests      = signal<PublishRequest[]>([]);
  latestPublishRequest = signal<PublishRequest | null>(null);
  courseExam           = signal<Quiz | null>(null);
  mobileMenuOpen       = signal(false);
  activeTab            = signal<'content' | 'analytics' | 'reviews'>('content');

  get selectedTabIndex(): number {
    const m: Record<string, number> = { content: 0, analytics: 1, reviews: 2 };
    return m[this.activeTab()] ?? 0;
  }
  onTabChange(index: number): void {
    const tabs: Array<'content' | 'analytics' | 'reviews'> = ['content', 'analytics', 'reviews'];
    this.activeTab.set(tabs[index] ?? 'content');
  }

  // ── Thumbnail ──────────────────────────────────────────────────────
  thumbnailError   = signal(false);
  thumbnailLoading = signal(true);
  thumbnailSrc = computed(() => {
    if (this.thumbnailError()) return null;
    const c = this.course();
    if (!c) return null;
    const src = c.thumbnailUrl || c.imageUrl;
    if (!src) return null;
    return src.startsWith('http') ? src : `${this.config.baseUrl}${src}`;
  });

  // ── Promo Video upload modal ───────────────────────────────────────
  promoVideoModalVisible   = signal(false);
  promoVideoFile           = signal<File | null>(null);
  promoVideoUploadProgress = signal(0);
  isPromoUploading         = signal(false);
  promoVideoFileList       = signal<NzUploadFile[]>([]);
  promoVideoError          = signal<string | null>(null);

  // ── Custom Promo Video Player (uses getElementById — video is inside ng-template) ──
  promoVideoPlaying     = signal(false);
  promoVideoProgress    = signal(0);
  promoVideoCurrentTime = signal(0);
  promoVideoDuration    = signal(0);
  promoVideoMuted       = signal(false);

  private getPromoEl(): HTMLVideoElement | null {
    return document.getElementById('cb-promo-video-el') as HTMLVideoElement | null;
  }

  togglePromoPlay(): void {
    const el = this.getPromoEl();
    if (!el) return;
    if (el.paused) { el.play(); this.promoVideoPlaying.set(true); }
    else           { el.pause(); this.promoVideoPlaying.set(false); }
    this.cdr.markForCheck();
  }

  togglePromoMute(): void {
    const el = this.getPromoEl();
    if (!el) return;
    el.muted = !el.muted;
    this.promoVideoMuted.set(el.muted);
    this.cdr.markForCheck();
  }

  seekPromoVideo(event: MouseEvent): void {
    const el = this.getPromoEl();
    if (!el || !el.duration) return;
    const bar = event.currentTarget as HTMLElement;
    const ratio = event.offsetX / bar.offsetWidth;
    el.currentTime = ratio * el.duration;
  }

  openPromoFullscreen(): void {
    const el = this.getPromoEl();
    if (el?.requestFullscreen) el.requestFullscreen();
  }

  onPromoVideoTimeUpdate(event: Event): void {
    const el = event.target as HTMLVideoElement;
    if (!el || !el.duration) return;
    this.promoVideoCurrentTime.set(Math.floor(el.currentTime));
    this.promoVideoDuration.set(Math.floor(el.duration));
    this.promoVideoProgress.set((el.currentTime / el.duration) * 100);
    this.cdr.markForCheck();
  }

  onPromoVideoLoad(event: Event): void {
    const el = event.target as HTMLVideoElement;
    this.promoVideoError.set(null);
    if (el?.duration) this.promoVideoDuration.set(Math.floor(el.duration));
    this.cdr.markForCheck();
  }

  onPromoVideoError(): void {
    this.promoVideoError.set(this.t('video_load_error'));
    this.cdr.markForCheck();
  }

  reloadPromoVideo(): void {
    this.promoVideoError.set(null);
    this.promoVideoPlaying.set(false);
    this.promoVideoProgress.set(0);
    this.promoVideoCurrentTime.set(0);
    this.promoVideoDuration.set(0);
    this.course.update(c => c ? { ...c } : null);
  }

  // ── Resource Upload Confirmation Modal ─────────────────────────────
  // Modal shown BEFORE upload — triggered by "Upload Resources" button click
  resourceConfirmModalVisible = signal(false);
  private pendingResourceQueue: File[] = [];

  /** Called from "Upload Resources" button — opens file picker first */
  openResourceFilePicker(): void {
    // Create a temporary input, trigger it, collect files
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.gif,.webp';
    input.onchange = (e: Event) => this.onResourceFileInputChange(e);
    input.click();
  }
  // Compatibility method - remove after all references are updated
  onResourceFileInputChange(event: Event): void {
    this.onResourceFileSelected(event);
  }
  onResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file
    const validation = this.validateFile(file, 'resource');
    if (!validation.valid) {
      this.toast.error(validation.error!);
      input.value = ''; // Clear input
      return;
    }

    // Check if already have pending file
    if (this.pendingResourceFile()) {
      this.toast.warning(this.t('teacherCourseBuilder.file_already_selected'));
      return;
    }

    // Set the pending file
    this.pendingResourceFile.set(file);
    this.cdr.markForCheck();

    // Clear input value so same file can be selected again if needed
    input.value = '';
  }

  clearSelectedResource(): void {
    this.pendingResourceFile.set(null);
    this.resourceUploadProgress.set(0);
    this.cdr.markForCheck();
  }

  async confirmResourceUpload(): Promise<void> {
    const file = this.pendingResourceFile();
    if (!file) {
      this.toast.warning(this.t('teacherCourseBuilder.please_select_file'));
      return;
    }

    this.isResourceUploading.set(true);
    this.resourceUploadProgress.set(0);

    let interval: any;
    try {
      const fd = new FormData();
      fd.append('File', file);

      // Simulate progress
      interval = setInterval(() => {
        this.resourceUploadProgress.update(p => Math.min(p + 10, 90));
      }, 200);

      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/resources`, fd)
      );

      clearInterval(interval);
      this.resourceUploadProgress.set(100);

      if (res?.success) {
        this.toast.success(this.t('teacherCourseBuilder.resource_uploaded'));
        this.resourceConfirmModalVisible.set(false);
        this.pendingResourceFile.set(null);
        this.resourceUploadProgress.set(0);
        await this.fetchCourseResources();
      } else {
        this.toast.error(res?.message || this.t('teacherCourseBuilder.upload_error'));
      }
    } catch (err: any) {
      if (interval) clearInterval(interval);
      const msg = err?.error?.message || err?.message || this.t('teacherCourseBuilder.upload_error');
      this.toast.error(msg);
    } finally {
      this.isResourceUploading.set(false);
      this.resourceUploadProgress.set(0);
    }
  }

  cancelResourceUpload(): void {
    this.resourceConfirmModalVisible.set(false);
    this.pendingResourceFile.set(null);
    this.isResourceUploading.set(false);
    this.resourceUploadProgress.set(0);
  }

  // Legacy nz-upload compat
  beforeResourceUpload = (_file: NzUploadFile): NzBeforeUploadFileType => false;

  // ── Upload state ───────────────────────────────────────────────────
  videoFileList       = signal<NzUploadFile[]>([]);
  resourceFiles       = signal<ResourceFileItem[]>([]);
  uploadProgress      = signal(0);
  isUploading         = signal(false);
  existingVideoInfo   = signal<ResourceFileItem | null>(null);
  videoToRemove       = signal(false);
  newVideoFile        = signal<File | null>(null);
  uploadError         = signal<string | null>(null);

  // ── Course-level Resources ──────────────────────────────────────────
  courseResources                = signal<CourseDocResource[]>([]);
  courseResourcesLoading         = signal(false);
  courseResourceUploading        = signal(false);
  courseResourceError            = signal<string | null>(null);
  // Resource upload modal
  courseResourceUploadModalVisible = signal(false);
  courseResourceUploadingModal     = signal(false);
  courseResourceUploadProgress     = signal(0);
  courseResourceFileList           = signal<NzUploadFile[]>([]);
  pendingCourseResourceFile        = signal<File | null>(null);
  // Resource confirm modal signals
  isResourceUploading = signal(false);
  resourceUploadProgress = signal(0);
  pendingResourceFile = signal<File | null>(null); // Make sure this exists

  // ── Modal visibility ───────────────────────────────────────────────
  publishRequestModalVisible = signal(false);
  publishHistoryModalVisible = signal(false);
  sectionModalVisible        = signal(false);
  lectureModalVisible        = signal(false);
  quizModalVisible           = signal(false);
  examModalVisible           = signal(false);
  settingsModalVisible       = signal(false);
  deleteModalVisible         = signal(false);

  // ── Modal modes & loading ──────────────────────────────────────────
  sectionModalMode    = signal<'add' | 'edit'>('add');
  sectionModalLoading = signal(false);
  editingSectionId    = signal<string | null>(null);

  lectureModalMode    = signal<'add' | 'edit'>('add');
  lectureModalLoading = signal(false);
  editingLecture      = signal<Lecture | null>(null);
  lectureSectionId    = signal<string | null>(null);

  quizModalMode      = signal<'add' | 'edit'>('add');
  quizModalLoading   = signal(false);
  quizModalTarget    = signal<'lecture' | 'section'>('lecture');
  quizModalLectureId = signal<string | null>(null);
  quizModalSectionId = signal<string | null>(null);
  editingQuiz        = signal<Quiz | null>(null);

  examModalMode    = signal<'add' | 'edit'>('add');
  examModalLoading = signal(false);

  publishRequestLoading = signal(false);
  publishTeacherNotes   = signal('');
  settingsModalLoading  = signal(false);

  deleteModalTitle   = signal('');
  deleteModalMessage = signal('');
  deleteModalLoading = signal(false);
  private deleteAction: (() => Promise<void>) | null = null;

  // ── Completion checklist ───────────────────────────────────────────
  completionChecklist = signal<CompletionChecklist>({
    hasThumbnail: false, hasPromoVideo: false, hasDescription: false,
    hasObjectives: false, hasSections: false, hasLectures: false, isPublishable: false,
  });

  readonly checklistDefs = [
    { key: 'Thumbnail',   label: '', required: true  },
    { key: 'Description', label: '', required: true  },
    { key: 'Objectives',  label: '', required: true  },
    { key: 'Sections',    label: '', required: true  },
    { key: 'Lectures',    label: '', required: true  },
    { key: 'PromoVideo',  label: '', required: false },
  ];

  // ── Forms ──────────────────────────────────────────────────────────
  sectionForm!:  FormGroup;
  lectureForm!:  FormGroup;
  quizForm!:     FormGroup;
  examForm!:     FormGroup;
  settingsForm!: FormGroup;

  formErrors          = signal<ValidationError[]>([]);
  drawerActiveSection = signal<'overview' | 'checklist' | 'history'>('overview');

  get courseId(): string | null { return this.route.snapshot.paramMap.get('id'); }

  get completionPercent(): number {
    const c = this.completionChecklist();
    const checks = [c.hasThumbnail, c.hasDescription, c.hasObjectives, c.hasSections, c.hasLectures, c.hasPromoVideo];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  get doneChecklistCount(): number {
    const c = this.completionChecklist();
    return [c.hasThumbnail, c.hasPromoVideo, c.hasDescription, c.hasObjectives, c.hasSections, c.hasLectures].filter(Boolean).length;
  }
  get requiredChecklistCount(): number {
    return this.checklistDefs.filter(d => d.required).length;
  }

  computedRating = computed(() => {
    const rv = this.reviews();
    if (rv.length > 0) return Math.round(rv.reduce((a, r) => a + (r.rating || 0), 0) / rv.length * 10) / 10;
    return this.course()?.rating || 0;
  });

  totalRevenue = computed(() => (this.course()?.studentCount || 0) * (this.course()?.price || 0));

  lectureQuizzes  = computed(() => this.quizzes().filter(q => q.quizTarget === 'lecture'));
  sectionQuizzes  = computed(() => this.quizzes().filter(q => q.quizTarget === 'section'));
  allQuizzesSorted = computed(() => [...this.sectionQuizzes(), ...this.lectureQuizzes()]);

  statCards = computed((): StatCard[] => [
    { title: this.t('total_students'), val: this.course()?.studentCount || 0,               icon: this.TeamIcon,   cls: 'blue'  },
    { title: this.t('total_revenue'),  val: `$${this.totalRevenue().toFixed(2)}`,            icon: this.DollarIcon, cls: 'green' },
    { title: this.t('average_rating'), val: `${this.computedRating().toFixed(1)}/5`,         icon: this.StarIcon,   cls: 'amber' },
    { title: this.t('total_hours'),    val: `${(this.course()?.totalHours || 0).toFixed(1)}h`, icon: this.ClockIcon, cls: 'cyan'  },
  ]);

  percentFormat = (percent: number) => `${percent}%`;

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.buildForms();
    this.updateChecklistLabels();
    if (this.courseId) this.fetchCourseData();
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── i18n ───────────────────────────────────────────────────────────
  t(key: string): string { return this.transloco.translate(`teacherCourseBuilder.${key}`); }

  private updateChecklistLabels(): void {
    this.checklistDefs[0].label = this.t('course_thumbnail');
    this.checklistDefs[1].label = this.t('course_description');
    this.checklistDefs[2].label = this.t('learning_objectives');
    this.checklistDefs[3].label = this.t('course_sections');
    this.checklistDefs[4].label = this.t('video_lectures');
    this.checklistDefs[5].label = this.t('promotional_video');
  }

  // ── Forms ──────────────────────────────────────────────────────────
  private buildForms(): void {
    this.sectionForm = this.fb.group({
      title:       ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]],
      order:       [1,  [Validators.required, Validators.min(1), Validators.max(100)]],
      isPublished: [true],
    });
    this.lectureForm = this.fb.group({
      title:           ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      description:     ['', [Validators.maxLength(1000)]],
      order:           [1,  [Validators.required, Validators.min(1), Validators.max(100)]],
      durationMinutes: [0,  [Validators.required, Validators.min(0), Validators.max(300)]],
      isFree:          [false],
      isPublished:     [true],
    });
    this.quizForm = this.fb.group({
      title:              ['', [Validators.required, Validators.maxLength(200)]],
      description:        ['', [Validators.maxLength(500)]],
      type:               ['Practice', Validators.required],
      passingScore:       [70, [Validators.required, Validators.min(0), Validators.max(100)]],
      isTimeLimitMinutes: [false],
      timeLimitMinutes:   [null, [Validators.min(1), Validators.max(300)]],
    });
    this.examForm = this.fb.group({
      title:              ['', [Validators.required, Validators.maxLength(200)]],
      description:        ['', [Validators.maxLength(500)]],
      type:               ['Graded', Validators.required],
      passingScore:       [70, [Validators.required, Validators.min(0), Validators.max(100)]],
      isTimeLimitMinutes: [false],
      timeLimitMinutes:   [null, [Validators.min(1), Validators.max(300)]],
    });
    this.settingsForm = this.fb.group({
      title:            ['', [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
      subtitle:         ['', [Validators.maxLength(250)]],
      description:      ['', [Validators.required, Validators.minLength(50), Validators.maxLength(2000)]],
      longDescription:  ['', [Validators.maxLength(5000)]],
      whatYouWillLearn: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(1000)]],
      requirements:     ['', [Validators.maxLength(500)]],
      language:         ['English'],
      level:            ['Beginner'],
      isFree:           [false],
      price:            [0, [Validators.min(0), Validators.max(99999)]],
    });
  }

  getFieldError(form: FormGroup, field: string): string | null {
    const control = form.get(field);
    if (!control || !control.errors || (!control.touched && !control.dirty)) return null;
    const e = control.errors;
    if (e['required'])   return this.t('validation_required');
    if (e['minlength'])  return this.t('validation_min_length').replace('{0}', e['minlength'].requiredLength);
    if (e['maxlength'])  return this.t('validation_max_length').replace('{0}', e['maxlength'].requiredLength);
    if (e['min'])        return this.t('validation_min_value').replace('{0}', e['min'].min);
    if (e['max'])        return this.t('validation_max_value').replace('{0}', e['max'].max);
    return this.t('validation_invalid');
  }
  hasFieldError(form: FormGroup, field: string): boolean {
    const c = form.get(field);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  private validateFile(file: File, type: 'promoVideo' | 'lectureVideo' | 'thumbnail' | 'resource'): { valid: boolean; error?: string } {
    const limits = FILE_LIMITS[type];
    const sizeMB = (file.size || 0) / 1024 / 1024;
    if (sizeMB > limits.maxSizeMB)
      return { valid: false, error: this.t('file_size_exceeded').replace('{0}', limits.maxSizeMB.toString()) };
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!limits.allowedExtensions.some(a => a === ext))
      return { valid: false, error: this.t('file_type_not_allowed').replace('{0}', limits.allowedExtensions.join(', ')) };
    if (limits.allowedTypes.length > 0 && !limits.allowedTypes.some(t => t.endsWith('/*') ? file.type.startsWith(t.replace('/*','/')) : file.type === t))
      return { valid: false, error: this.t('file_type_not_allowed').replace('{0}', limits.allowedExtensions.join(', ')) };
    return { valid: true };
  }

  // ── Data Fetching ───────────────────────────────────────────────────
  private async fetchCourseData(): Promise<void> {
    this.loading.set(true);
    this.thumbnailError.set(false);
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/preview-admin-teacher`));
      if (!res?.success) throw new Error(res?.message || this.t('load_error'));
      const c: CourseData = res.data || {};
      const thumb = c.imageUrl || c.thumbnailUrl || null;
      const resolvedThumb = thumb
        ? (thumb.startsWith('http') ? thumb : `${this.config.baseUrl}${thumb}`)
        : null;
      this.course.set({
        ...c,
        thumbnailUrl: resolvedThumb ?? undefined,
        imageUrl:     resolvedThumb ?? undefined,
      });
      if (Array.isArray(c.reviews)) this.reviews.set(c.reviews);
      await Promise.all([this.fetchSections(), this.fetchReviews(), this.fetchPublishRequests(), this.fetchCourseExam(), this.fetchCourseResources()]);
    } catch (err: any) {
      this.toast.error(err?.error?.message || err?.message || this.t('load_error'));
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchCourseResources(): Promise<void> {
    this.courseResourcesLoading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/resources`));
      if (res?.success) this.courseResources.set((res.data || []).map((r: any) => ({ ...r, formattedSize: this.formatFileSize(r.fileSize) })));
    } catch { /* not fatal */ } finally { this.courseResourcesLoading.set(false); }
  }

  openResourceUploadModal(): void {
    if (this.courseResources().length >= MAX_COURSE_RESOURCES) {
      this.toast.warning(this.t('max_resources_reached').replace('{0}', MAX_COURSE_RESOURCES.toString()));
      return;
    }
    this.pendingCourseResourceFile.set(null);
    this.courseResourceFileList.set([]);
    this.courseResourceUploadProgress.set(0);
    this.courseResourceUploadingModal.set(false);
    this.courseResourceError.set(null);
    this.courseResourceUploadModalVisible.set(true);
  }

  closeCourseResourceUploadModal(): void {
    this.courseResourceUploadModalVisible.set(false);
    this.pendingCourseResourceFile.set(null);
    this.courseResourceFileList.set([]);
    this.courseResourceUploadProgress.set(0);
    this.courseResourceUploadingModal.set(false);
  }

  beforeCourseResourceUploadModal = (file: NzUploadFile): NzBeforeUploadFileType => {
    const rawFile = file as unknown as File;
    this.courseResourceError.set(null);

    if (this.courseResources().length >= MAX_COURSE_RESOURCES) {
      const msg = this.t('max_resources_reached').replace('{0}', MAX_COURSE_RESOURCES.toString());
      this.courseResourceError.set(msg);
      this.toast.error(msg);
      return false;
    }

    const v = this.validateFile(rawFile, 'resource');
    if (!v.valid) {
      this.courseResourceError.set(v.error!);
      this.toast.error(v.error!);
      return false;
    }

    this.pendingCourseResourceFile.set(rawFile);
    this.courseResourceFileList.set([{ uid: 'pending', name: rawFile.name, status: 'done' }]);
    return false;
  };

  onCourseResourceModalChange(event: any): void {
    if (event.type === 'removed') {
      this.pendingCourseResourceFile.set(null);
      this.courseResourceFileList.set([]);
      this.courseResourceError.set(null);
    }
  }

  async submitCourseResourceUpload(): Promise<void> {
    const file = this.pendingCourseResourceFile();
    if (!file) {
      this.courseResourceError.set(this.t('please_select_file'));
      return;
    }

    this.courseResourceUploadingModal.set(true);
    this.courseResourceUploadProgress.set(0);
    this.courseResourceError.set(null);

    let interval: any;
    try {
      const fd = new FormData();
      fd.append('File', file);

      interval = setInterval(() => {
        this.courseResourceUploadProgress.update(p => Math.min(p + 10, 90));
      }, 300);

      const res = await firstValueFrom(
        this.http.post<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/resources`, fd)
      );

      clearInterval(interval);
      this.courseResourceUploadProgress.set(100);

      if (res?.success) {
        this.toast.success(this.t('resource_uploaded'));
        this.closeCourseResourceUploadModal();
        await this.fetchCourseResources();
      } else {
        const msg = res?.message || this.t('upload_error');
        this.courseResourceError.set(msg);
        this.toast.error(msg);
      }
    } catch (err: any) {
      if (interval) clearInterval(interval);
      const msg = err?.status === 404 ? this.t('endpoint_not_found') :
                  err?.status === 413 ? this.t('file_too_large') :
                  err?.error?.message || err?.message || this.t('upload_error');
      this.courseResourceError.set(msg);
      this.toast.error(msg);
    } finally {
      this.courseResourceUploadingModal.set(false);
      this.courseResourceUploadProgress.set(0);
    }
  }

  beforeCourseResourceUpload = (file: NzUploadFile): NzBeforeUploadFileType => {
    // Deprecated - using modal now
    return false;
  };

  private async uploadCourseResource(file: File): Promise<void> {
    this.courseResourceUploading.set(true); this.courseResourceError.set(null);
    try {
      const fd = new FormData(); fd.append('File', file);
      const res = await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/resources`, fd));
      if (res?.success) { this.toast.success(this.t('resource_uploaded')); await this.fetchCourseResources(); }
      else { const msg = res?.message || this.t('upload_error'); this.courseResourceError.set(msg); this.toast.error(msg); }
    } catch (err: any) {
      const msg = err?.status === 404 ? this.t('endpoint_not_found') : err?.status === 413 ? this.t('file_too_large') : err?.error?.message || err?.message || this.t('upload_error');
      this.courseResourceError.set(msg); this.toast.error(msg);
    } finally { this.courseResourceUploading.set(false); }
  }

  confirmDeleteCourseResource(resourceId: string): void {
    this.deleteModalTitle.set(this.t('delete_resource'));
    this.deleteModalMessage.set(this.t('delete_resource_warning'));
    this.deleteAction = async () => {
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/resources/${resourceId}`));
      if (res?.success) { this.toast.success(this.t('resource_deleted')); await this.fetchCourseResources(); }
      else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  private async fetchSections(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/coursesections?courseId=${this.courseId}`));
      const data = res?.success ? res.data : res;
      const sorted: CourseSection[] = Array.isArray(data) ? [...data].sort((a, b) => a.order - b.order) : [];
      this.sections.set(sorted);
      await this.fetchLecturesForSections(sorted);
    } catch { this.toast.warning(this.t('sections_load_error')); }
  }

  private async fetchLecturesForSections(sectionsList: CourseSection[]): Promise<void> {
    const allLectures: Lecture[] = []; const allQuizzes: Quiz[] = [];
    for (const section of sectionsList) {
      try {
        let sLectures: Lecture[] = [];
        try {
          const r = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/lectures/section/admin/${section.id}`));
          if (r?.success) sLectures = r.data || [];
        } catch {
          const r = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/lectures/section/${section.id}`));
          if (r?.success) sLectures = r.data || [];
        }
        for (const lec of sLectures) {
          allLectures.push({ ...lec, sectionId: section.id, sectionTitle: section.title });
          try {
            const qr = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/lecture/${lec.id}`));
            if (qr?.success && qr.data) allQuizzes.push({ ...qr.data, lectureId: lec.id, lectureTitle: lec.title, sectionId: section.id, sectionTitle: section.title, quizTarget: 'lecture' });
          } catch { /* none */ }
        }
        try {
          const sqr = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/section/${section.id}`));
          if (sqr?.success && sqr.data) allQuizzes.push({ ...sqr.data, sectionId: section.id, sectionTitle: section.title, quizTarget: 'section' });
        } catch { /* none */ }
      } catch { /* none */ }
    }
    this.lectures.set(allLectures); this.quizzes.set(allQuizzes); this.updateChecklist();
  }

  private async fetchReviews(): Promise<void> {
    this.reviewsLoading.set(true);
    try {
      let res: any = null;
      try { res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/reviews/course/${this.courseId}`)); } catch { /* fallback */ }
      if (!res?.success) res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/reviews`)).catch(() => null);
      if (res?.success) this.reviews.set(res.data || []);
    } catch { /* none */ } finally { this.reviewsLoading.set(false); }
  }

  private async fetchPublishRequests(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/courses/publish-requests/teacher`));
      if (res?.success) {
        const all: PublishRequest[] = (res.data || []).filter((r: PublishRequest) => r.courseId === this.courseId);
        this.publishRequests.set(all);
        const sorted = [...all].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        this.latestPublishRequest.set(sorted[0] || null);
      }
    } catch { /* none */ }
  }

  private async fetchCourseExam(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.config.baseUrl}/api/quizzes/course/${this.courseId}`)).catch(() => null);
      if (res?.success && res.data) this.courseExam.set(res.data);
    } catch { /* none */ }
  }

  private updateChecklist(): void {
    const c = this.course(); if (!c) return;
    const check: CompletionChecklist = {
      hasThumbnail:   !!(c.thumbnailUrl || c.imageUrl),
      hasPromoVideo:  !!c.promoVideoUrl,
      hasDescription: !!(c.description && c.description.length >= 100),
      hasObjectives:  !!(c.whatYouWillLearn && c.whatYouWillLearn.length >= 50),
      hasSections:    this.sections().length > 0,
      hasLectures:    this.lectures().length > 0,
      isPublishable:  false,
    };
    check.isPublishable = check.hasThumbnail && check.hasDescription && check.hasObjectives && check.hasSections && check.hasLectures;
    this.completionChecklist.set(check);
  }

  getChecklistValue(key: string): boolean {
    const c = this.completionChecklist();
    const map: Record<string, boolean> = { Thumbnail: c.hasThumbnail, PromoVideo: c.hasPromoVideo, Description: c.hasDescription, Objectives: c.hasObjectives, Sections: c.hasSections, Lectures: c.hasLectures };
    return map[key] ?? false;
  }

  getCourseStatus(): CourseStatusMeta {
    const c = this.course();
    if (c?.isPublished) return { text: this.t('published'), icon: this.GlobeIcon, cls: 'status--published' };
    const req = this.latestPublishRequest();
    if (req) {
      const map: Record<string, CourseStatusMeta> = {
        Pending:          { text: this.t('pending_review'),    icon: this.ClockIcon,  cls: 'status--pending'  },
        Rejected:         { text: this.t('rejected'),          icon: this.AlertIcon,  cls: 'status--rejected' },
        ChangesRequested: { text: this.t('changes_requested'), icon: this.AlertIcon,  cls: 'status--changes'  },
      };
      return map[req.status] || { text: this.t('draft'), icon: this.FileTextIcon, cls: 'status--draft' };
    }
    return { text: this.t('draft'), icon: this.FileTextIcon, cls: 'status--draft' };
  }

  getPromoVideoUrl(): string | null {
    const c = this.course();
    if (!c?.promoVideoUrl) return null;
    return c.promoVideoUrl.startsWith('http') ? c.promoVideoUrl : `${this.config.baseUrl}${c.promoVideoUrl}`;
  }

  openPromoVideoModal(): void {
    this.promoVideoFile.set(null); this.promoVideoFileList.set([]);
    this.promoVideoUploadProgress.set(0); this.isPromoUploading.set(false);
    this.promoVideoError.set(null); this.promoVideoModalVisible.set(true);
  }

  beforePromoUpload = (file: NzUploadFile): NzBeforeUploadFileType => {
    const rawFile = file as unknown as File;
    const v = this.validateFile(rawFile, 'promoVideo');
    if (!v.valid) { this.promoVideoError.set(v.error!); this.toast.error(v.error!); return false; }
    this.promoVideoError.set(null); this.promoVideoFile.set(rawFile);
    this.promoVideoFileList.set([{ uid: 'promo', name: rawFile.name, status: 'done' }]);
    return false;
  };

  onPromoVideoChange(event: any): void {
    if (event.type === 'removed') { this.promoVideoFile.set(null); this.promoVideoFileList.set([]); this.promoVideoError.set(null); }
  }

  async submitPromoVideo(): Promise<void> {
    const file = this.promoVideoFile();
    if (!file) { this.promoVideoError.set(this.t('please_select_video')); return; }
    this.isPromoUploading.set(true); this.promoVideoUploadProgress.set(0); this.promoVideoError.set(null);
    let pi: any;
    try {
      const fd = new FormData(); fd.append('promoVideo', file);
      pi = setInterval(() => this.promoVideoUploadProgress.update(p => Math.min(p + 10, 90)), 300);
      const res = await firstValueFrom(this.http.put<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/promo-video`, fd));
      clearInterval(pi); this.promoVideoUploadProgress.set(100);
      if (res?.success) { this.toast.success(this.t('promo_video_updated')); this.promoVideoModalVisible.set(false); await this.fetchCourseData(); }
      else { const msg = res?.message || this.t('upload_error'); this.promoVideoError.set(msg); this.toast.error(msg); }
    } catch (err: any) {
      if (pi) clearInterval(pi);
      const msg = err?.status === 404 ? this.t('promo_video_endpoint_missing') : err?.status === 413 ? this.t('file_too_large') : err?.error?.message || err?.message || this.t('upload_error');
      this.promoVideoError.set(msg); this.toast.error(msg);
    } finally { this.isPromoUploading.set(false); this.promoVideoUploadProgress.set(0); }
  }

  async removePromoVideo(): Promise<void> {
    this.deleteModalTitle.set(this.t('remove_promo_video'));
    this.deleteModalMessage.set(this.t('remove_promo_video_confirm'));
    this.deleteAction = async () => {
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/promo-video`));
      if (res?.success) { this.toast.success(this.t('promo_video_removed')); this.course.update(c => c ? { ...c, promoVideoUrl: undefined } : null); this.updateChecklist(); }
      else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  getLecturesForSection(sectionId: string): Lecture[] { return this.lectures().filter(l => l.sectionId === sectionId).sort((a, b) => a.order - b.order); }
  getSectionQuiz(sectionId: string): Quiz | undefined { return this.sectionQuizzes().find(q => q.sectionId === sectionId); }
  getLectureQuiz(lectureId: string): Quiz | undefined { return this.lectureQuizzes().find(q => q.lectureId === lectureId); }
  getSectionTitle(sectionId: string): string { return this.sections().find(s => s.id === sectionId)?.title || ''; }
  getLectureTitle(lectureId: string): string { return this.lectures().find(l => l.id === lectureId)?.title || ''; }
  quizTypeLabel(type: string | number): string { if (typeof type === 'number') return type === 1 ? 'Practice' : type === 2 ? 'Graded' : 'Survey'; return String(type); }
  quizModalTitle(): string {
    const mode = this.quizModalMode(), target = this.quizModalTarget();
    if (mode === 'add') return target === 'section' ? this.t('add_section_quiz') : this.t('add_lecture_quiz');
    return target === 'section' ? this.t('edit_section_quiz') : this.t('edit_lecture_quiz');
  }
  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB']; let size = bytes, idx = 0;
    while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx++; }
    return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
  }
  closeDrawer(): void { this.mobileMenuOpen.set(false); this.drawerActiveSection.set('overview'); }

  // ── Publish ────────────────────────────────────────────────────────
  openPublishRequestModal(): void {
    const c = this.course();
    if (!c || c.isPublished) { this.toast.info(this.t('already_published')); return; }
    if (!this.completionChecklist().isPublishable) { this.toast.warning(this.t('requirements_not_met')); return; }
    if (this.latestPublishRequest()?.status === 'Pending') { this.toast.info(this.t('request_already_pending')); return; }
    this.publishTeacherNotes.set(''); this.publishRequestModalVisible.set(true);
  }
  async submitPublishRequest(): Promise<void> {
    this.publishRequestLoading.set(true);
    try {
      const res = await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/courses/${this.courseId}/request-publish`, { teacherNotes: this.publishTeacherNotes(), courseId: this.courseId }));
      if (res?.success) { this.toast.success(this.t('publish_request_submitted')); this.publishRequestModalVisible.set(false); await this.fetchPublishRequests(); }
      else this.toast.error(res?.message || this.t('submit_request_error'));
    } catch (err: any) { this.toast.error(err?.error?.message || err?.message || this.t('submit_request_error')); }
    finally { this.publishRequestLoading.set(false); }
  }

  // ── Section Modal ──────────────────────────────────────────────────
  openSectionModal(mode: 'add' | 'edit', section?: CourseSection): void {
    this.sectionModalMode.set(mode); this.formErrors.set([]);
    if (mode === 'edit' && section) { this.editingSectionId.set(section.id); this.sectionForm.patchValue({ title: section.title, description: section.description, order: section.order, isPublished: section.isPublished }); }
    else { this.editingSectionId.set(null); this.sectionForm.reset({ order: this.sections().length + 1, isPublished: true }); }
    this.sectionModalVisible.set(true);
  }
  async submitSection(): Promise<void> {
    if (this.sectionForm.invalid) { this.sectionForm.markAllAsTouched(); this.toast.warning(this.t('please_fix_errors')); return; }
    this.sectionModalLoading.set(true);
    try {
      const data = { ...this.sectionForm.value, courseId: this.courseId };
      const res = this.sectionModalMode() === 'edit'
        ? await firstValueFrom(this.http.put<any>(`${this.config.baseUrl}/api/coursesections/${this.editingSectionId()}`, data))
        : await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/coursesections`, data));
      if (res?.success) { this.toast.success(this.sectionModalMode() === 'edit' ? this.t('section_updated') : this.t('section_created')); this.sectionModalVisible.set(false); await this.fetchCourseData(); }
      else this.toast.error(res?.message || this.t('save_error'));
    } catch (err: any) { this.toast.error(err?.error?.message || err?.message || this.t('save_error')); }
    finally { this.sectionModalLoading.set(false); }
  }
  confirmDeleteSection(sectionId: string): void {
    this.deleteModalTitle.set(this.t('delete_section')); this.deleteModalMessage.set(this.t('delete_section_warning'));
    this.deleteAction = async () => {
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/coursesections/${sectionId}`));
      if (res?.success) { this.toast.success(this.t('section_deleted')); await this.fetchCourseData(); } else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  // ── Lecture Modal ──────────────────────────────────────────────────
  openLectureModal(mode: 'add' | 'edit', lecture?: Lecture | null, sectionId?: string): void {
    this.lectureModalMode.set(mode); this.videoFileList.set([]); this.resourceFiles.set([]);
    this.existingVideoInfo.set(null); this.videoToRemove.set(false); this.newVideoFile.set(null);
    this.uploadProgress.set(0); this.uploadError.set(null); this.formErrors.set([]);
    if (mode === 'edit' && lecture) {
      this.editingLecture.set(lecture); this.lectureSectionId.set(lecture.sectionId || null);
      this.lectureForm.patchValue({ title: lecture.title, description: lecture.description, order: lecture.order, isFree: lecture.isFree, durationMinutes: lecture.durationMinutes, isPublished: lecture.isPublished ?? true });
      if (lecture.video) { this.existingVideoInfo.set({ uid: `ev-${lecture.id}`, name: 'Lecture Video', status: 'done', url: lecture.video.videoUrl, size: lecture.video.fileSize, formattedDuration: lecture.video.formattedDuration }); this.videoFileList.set([{ uid: `ev-${lecture.id}`, name: 'Lecture Video', status: 'done' }]); }
      if (lecture.resources?.length) this.resourceFiles.set(lecture.resources.map(r => ({ uid: `er-${r.id}`, name: r.fileUrl.split('/').pop() || `Resource.${r.fileType}`, status: 'done', url: r.fileUrl, size: r.fileSize, type: r.fileType, existing: true, resourceId: r.id })));
    } else {
      this.editingLecture.set(null); this.lectureSectionId.set(sectionId || null);
      this.lectureForm.reset({ order: this.lectures().filter(l => l.sectionId === sectionId).length + 1, isFree: false, durationMinutes: 0, isPublished: true });
    }
    this.lectureModalVisible.set(true);
  }

  beforeVideoUpload = (file: NzUploadFile): NzBeforeUploadFileType => {
    const rawFile = file as unknown as File;
    const v = this.validateFile(rawFile, 'lectureVideo');
    if (!v.valid) { this.uploadError.set(v.error!); this.toast.error(v.error!); return false; }
    this.uploadError.set(null); this.newVideoFile.set(rawFile); this.videoFileList.set([{ uid: 'nv', name: rawFile.name, status: 'done' }]);
    return false;
  };

  onVideoChange(event: any): void {
    if (event.type === 'removed') {
      if (event.file.existing) { this.videoToRemove.set(true); this.existingVideoInfo.set(null); }
      else this.newVideoFile.set(null);
      this.videoFileList.set([]); this.uploadError.set(null);
    }
  }

  async submitLecture(): Promise<void> {
    if (this.lectureModalMode() === 'add' && !this.newVideoFile() && !this.existingVideoInfo()) { this.uploadError.set(this.t('please_upload_video')); return; }
    if (this.lectureForm.invalid) { this.lectureForm.markAllAsTouched(); this.toast.warning(this.t('please_fix_errors')); return; }
    this.lectureModalLoading.set(true); this.isUploading.set(true); this.uploadError.set(null);
    try {
      const v = this.lectureForm.value;
      const fd = new FormData();
      fd.append('sectionId', this.lectureSectionId()!); fd.append('title', v.title);
      if (v.description) fd.append('description', v.description);
      fd.append('order', v.order || 1); fd.append('isFree', v.isFree || false);
      fd.append('isPublished', v.isPublished || false); fd.append('durationMinutes', v.durationMinutes || 0);
      if (this.newVideoFile()) fd.append('videoFile', this.newVideoFile()!);
      if (this.lectureModalMode() === 'edit' && this.videoToRemove()) fd.append('removeVideo', 'true');
      const url = this.lectureModalMode() === 'edit' ? `${this.config.baseUrl}/api/lectures/${this.editingLecture()?.id}` : `${this.config.baseUrl}/api/lectures`;
      const res = await firstValueFrom(this.lectureModalMode() === 'edit' ? this.http.put<any>(url, fd) : this.http.post<any>(url, fd));
      if (res?.success) { this.toast.success(this.lectureModalMode() === 'edit' ? this.t('lecture_updated') : this.t('lecture_created')); this.lectureModalVisible.set(false); this.newVideoFile.set(null); this.videoFileList.set([]); this.resourceFiles.set([]); await this.fetchCourseData(); }
      else this.toast.error(res?.message || this.t('save_error'));
    } catch (err: any) { this.toast.error(err?.error?.message || err?.message || this.t('save_error')); }
    finally { this.lectureModalLoading.set(false); this.isUploading.set(false); }
  }

  confirmDeleteLecture(lectureId: string): void {
    this.deleteModalTitle.set(this.t('delete_lecture')); this.deleteModalMessage.set(this.t('delete_lecture_warning'));
    this.deleteAction = async () => {
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/lectures/${lectureId}`));
      if (res?.success) { this.toast.success(this.t('lecture_deleted')); await this.fetchCourseData(); } else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  // ── Quiz Modal ─────────────────────────────────────────────────────
  openQuizModal(mode: 'add' | 'edit', quiz?: Quiz | null, lectureId?: string | null, sectionId?: string | null): void {
    const target: 'section' | 'lecture' = sectionId ? 'section' : 'lecture';
    this.quizModalMode.set(mode); this.quizModalTarget.set(target);
    this.quizModalLectureId.set(lectureId || quiz?.lectureId || null);
    this.quizModalSectionId.set(sectionId || (quiz?.quizTarget === 'section' ? quiz?.sectionId : null) || null);
    this.editingQuiz.set(quiz || null); this.formErrors.set([]);
    if (mode === 'edit' && quiz) {
      const typeMap: Record<number, string> = { 1: 'Practice', 2: 'Graded', 3: 'Survey' };
      this.quizForm.patchValue({ title: quiz.title, description: quiz.description, type: typeof quiz.type === 'number' ? (typeMap[quiz.type] ?? 'Practice') : (quiz.type ?? 'Practice'), passingScore: quiz.passingScore, timeLimitMinutes: quiz.timeLimitMinutes, isTimeLimitMinutes: !!quiz.timeLimitMinutes });
    } else this.quizForm.reset({ type: 'Practice', passingScore: 70, isTimeLimitMinutes: false });
    this.quizModalVisible.set(true);
  }

  async submitQuiz(): Promise<void> {
    if (this.quizForm.invalid) { this.quizForm.markAllAsTouched(); this.toast.warning(this.t('please_fix_errors')); return; }
    this.quizModalLoading.set(true);
    try {
      const v = this.quizForm.value;
      const typeMap: Record<string, number> = { Practice: 1, Graded: 2, Survey: 3 };
      const qt = typeMap[v.type] ?? 0; const isSec = this.quizModalTarget() === 'section';
      let res: any;
      if (this.quizModalMode() === 'edit' && this.editingQuiz()) {
        res = await firstValueFrom(this.http.put<any>(`${this.config.baseUrl}/api/quizzes/${this.editingQuiz()!.id}`, { title: v.title, description: v.description || '', type: qt, passingScore: v.passingScore, timeLimitMinutes: v.isTimeLimitMinutes ? v.timeLimitMinutes : null, isTimeLimitMinutes: !!v.isTimeLimitMinutes }));
      } else if (isSec) {
        res = await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/quizzes/section`, { sectionId: this.quizModalSectionId(), title: v.title, description: v.description || '', type: qt, passingScore: v.passingScore, timeLimitMinutes: v.isTimeLimitMinutes ? v.timeLimitMinutes : null, isTimeLimitMinutes: !!v.isTimeLimitMinutes }));
      } else {
        const fd = new FormData();
        fd.append('LectureId', this.quizModalLectureId()!); fd.append('Title', v.title); fd.append('Description', v.description || '');
        fd.append('Type', qt.toString()); fd.append('PassingScore', v.passingScore.toString());
        if (v.isTimeLimitMinutes && v.timeLimitMinutes) fd.append('TimeLimitMinutes', v.timeLimitMinutes.toString());
        fd.append('IsTimeLimitMinutes', v.isTimeLimitMinutes ? 'true' : 'false');
        res = await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/quizzes`, fd));
      }
      if (res?.success) { this.toast.success(this.quizModalMode() === 'edit' ? this.t('quiz_updated') : this.t('quiz_created')); this.quizModalVisible.set(false); await this.fetchCourseData(); }
      else this.toast.error(res?.message || this.t('save_error'));
    } catch (err: any) { this.toast.error(err?.error?.message || err?.message || this.t('save_error')); }
    finally { this.quizModalLoading.set(false); }
  }

  confirmDeleteQuiz(quizId: string): void {
    this.deleteModalTitle.set(this.t('delete_quiz')); this.deleteModalMessage.set(this.t('delete_quiz_warning'));
    this.deleteAction = async () => {
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/quizzes/${quizId}`));
      if (res?.success) { this.toast.success(this.t('quiz_deleted')); await this.fetchCourseData(); } else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  // ── Exam Modal ─────────────────────────────────────────────────────
  openExamModal(mode: 'add' | 'edit'): void {
    this.examModalMode.set(mode); this.formErrors.set([]);
    if (mode === 'edit' && this.courseExam()) {
      const e = this.courseExam()!;
      const typeMap: Record<number, string> = { 1: 'Practice', 2: 'Graded', 3: 'Survey' };
      this.examForm.patchValue({ title: e.title, description: e.description, type: typeof e.type === 'number' ? (typeMap[e.type] ?? 'Graded') : (e.type ?? 'Graded'), passingScore: e.passingScore, timeLimitMinutes: e.timeLimitMinutes, isTimeLimitMinutes: !!e.timeLimitMinutes });
    } else this.examForm.reset({ type: 'Graded', passingScore: 70, isTimeLimitMinutes: false });
    this.examModalVisible.set(true);
  }

  async submitExam(): Promise<void> {
    if (this.examForm.invalid) { this.examForm.markAllAsTouched(); this.toast.warning(this.t('please_fix_errors')); return; }
    this.examModalLoading.set(true);
    try {
      const v = this.examForm.value;
      const typeMap: Record<string, number> = { Practice: 1, Graded: 2, Survey: 3 };
      const payload = { courseId: this.courseId, title: v.title, description: v.description || '', type: typeMap[v.type] ?? 2, passingScore: v.passingScore, timeLimitMinutes: v.isTimeLimitMinutes ? v.timeLimitMinutes : null, isTimeLimitMinutes: !!v.isTimeLimitMinutes };
      const res = this.examModalMode() === 'edit' && this.courseExam()
        ? await firstValueFrom(this.http.put<any>(`${this.config.baseUrl}/api/quizzes/${this.courseExam()!.id}`, payload))
        : await firstValueFrom(this.http.post<any>(`${this.config.baseUrl}/api/quizzes/course`, payload));
      if (res?.success) { this.toast.success(this.examModalMode() === 'edit' ? this.t('exam_updated') : this.t('exam_created')); this.examModalVisible.set(false); await this.fetchCourseExam(); }
      else this.toast.error(res?.message || this.t('save_error'));
    } catch (err: any) { this.toast.error(err?.error?.message || err?.message || this.t('save_error')); }
    finally { this.examModalLoading.set(false); }
  }

  confirmDeleteExam(): void {
    this.deleteModalTitle.set(this.t('delete_exam')); this.deleteModalMessage.set(this.t('delete_exam_warning'));
    this.deleteAction = async () => {
      if (!this.courseExam()) return;
      const res = await firstValueFrom(this.http.delete<any>(`${this.config.baseUrl}/api/quizzes/${this.courseExam()!.id}`));
      if (res?.success) { this.toast.success(this.t('exam_deleted')); this.courseExam.set(null); } else this.toast.error(res?.message || this.t('delete_error'));
    };
    this.deleteModalVisible.set(true);
  }

  async executeDelete(): Promise<void> {
    if (!this.deleteAction) return;
    this.deleteModalLoading.set(true);
    try { await this.deleteAction(); this.deleteModalVisible.set(false); }
    catch (err: any) { this.toast.error(err?.error?.message || err?.message); }
    finally { this.deleteModalLoading.set(false); this.deleteAction = null; }
  }
}