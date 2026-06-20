import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef, NgZone, Inject,HostListener  
} from '@angular/core';
import { Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Language } from '../../../core/services/language';
import { Cookie } from '../../../core/services/cookie';
import { APP_CONFIG } from '../../../core/config/app.config';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { PickerModule } from '@ctrl/ngx-emoji-mart';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NzSpinModule }       from 'ng-zorro-antd/spin';
import { NzButtonModule }     from 'ng-zorro-antd/button';
import { NzBadgeModule }      from 'ng-zorro-antd/badge';
import { NzTagModule }        from 'ng-zorro-antd/tag';
import { NzAvatarModule }     from 'ng-zorro-antd/avatar';
import { NzTooltipModule }    from 'ng-zorro-antd/tooltip';
import { NzModalModule }      from 'ng-zorro-antd/modal';
import { NzDrawerModule }     from 'ng-zorro-antd/drawer';
import { NzFormModule }       from 'ng-zorro-antd/form';
import { NzInputModule }      from 'ng-zorro-antd/input';
import { NzSelectModule }     from 'ng-zorro-antd/select';
import { NzCheckboxModule }   from 'ng-zorro-antd/checkbox';
import { NzSwitchModule }     from 'ng-zorro-antd/switch';
import { NzDividerModule }    from 'ng-zorro-antd/divider';
import { NzListModule }       from 'ng-zorro-antd/list';
import { NzEmptyModule }      from 'ng-zorro-antd/empty';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzPopoverModule }    from 'ng-zorro-antd/popover';
import { NzIconModule }       from 'ng-zorro-antd/icon';
import { NzGridModule }       from 'ng-zorro-antd/grid';
import { NzProgressModule }   from 'ng-zorro-antd/progress';
import {
  LucideAngularModule,
  ArrowLeft, Plus, Menu, X, Users, Flag, UserPlus, Settings,
  Unlock, Lock, AudioLines, Camera, Paperclip, Mic, Send,
  ChevronDown, Smile, Edit, Trash2, MessageSquare, AlertCircle,
  CheckCheck, Clock, MoreHorizontal, Book, Rocket,
  AudioWaveform, FileText, Image, Archive, File,
  CheckCircle2, XCircle, Eye, Download, Database, User
} from 'lucide-angular';

// ─── Types ─────────────────────────────────────────────────────────
export interface PlanInfo {
  hasAccess: boolean;
  subscriptionPlanName?: string;
  maxRoomsAllowed: number;
  currentRoomCount: number;
  remainingRooms: number;
  messageQuota?: MessageQuota;
}
export interface MessageQuota {
  isUnlimited: boolean;
  limit: number;
  used: number;
  usagePercentage: number;
  periodLabel: string;
  nextResetTime?: string;
}
export interface CourseRoom {
  id: string | number;
  name: string;
  description?: string;
  courseId: string | number;
  courseTitle: string;
  creatorId: string | number;
  memberCount: number;
  isClosed: boolean;
  allowStudentsToSendFiles: boolean;
  allowStudentsToSendImages: boolean;
  allowStudentsToSendVoice: boolean;
}
export interface RoomMember {
  userId: string | number;
  userName: string;
  userEmail?: string;
  profileImageUrl?: string;
  role: number;
  isMuted: boolean;
  isRemoved: boolean;
  lastSeen?: string;
}
export interface MessageReaction {
  userId: string | number;
  reaction: string;
  userName: string;
  userImageUrl?: string | null;
}
export interface ReplyMessage {
  id: string | number;
  senderName: string;
  content?: string | null;
}
export interface ChatMessage {
  id: string | number;
  content?: string | null;
  contentType: number;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  audioDurationSeconds?: number | null;
  senderId: string | number;
  senderName: string;
  senderImageUrl?: string | null;
  isSenderTeacher: boolean;
  isCurrentUserSender: boolean;
  sentAt: string;
  editedAt?: string | null;
  isDeleted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reactions?: MessageReaction[];
  replyToMessage?: ReplyMessage | null;
  _showEmojiPicker?: boolean;
  _ctxOpen?: boolean;
  _reactionGroups?: ReactionGroup[];
  // Optimistic send state
  _pending?: boolean;
  _failed?: boolean;
}
export interface Report {
  id: string | number;
  reason: string;
  reportedByName: string;
  createdAt: string;
  isReviewed: boolean;
}
export interface Course { id: string | number; title: string; }
export interface EnrolledStudent { userId: string | number; userName: string; userEmail: string; }
export interface QuotaInfo {
  isUnlimited: boolean;
  limit: number;
  used: number;
  periodLabel: string;
  nextResetTime?: string;
  blocked?: boolean;
}
export interface ReactionGroup {
  emoji: string;
  count: number;
  reactors: { userId: string | number; userName: string; profileImageUrl: string | null }[];
  myReaction: boolean;
}
export interface PaginationState {
  page: number;
  hasMore: boolean;
  totalCount: number;
  oldestCursor: string | null;
  isLoadingMore: boolean;
  isInitialLoading: boolean;
}
export interface VoiceState {
  state: 'idle' | 'recording' | 'stopped';
  elapsed: number;
  audioUrl: string | null;
  blob: Blob | null;
  mime: string;
}

// ─── Constants ──────────────────────────────────────────────────────
export const CT = { Text: 0, Image: 1, Audio: 2, Video: 3, File: 4 };
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB for images
const ALLOWED_FILE_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'tar', 'gz', 'txt', 'csv',
  'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav', 'ogg', 'webm'
];
const PAGE_SIZE = 50;
const AT_BOTTOM_THRESHOLD = 120;
const SMOOTH_SCROLL_DURATION = 350;

// ─── Helpers ────────────────────────────────────────────────────────
export function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString();
}
export function fmtSize(b: number | null | undefined): string {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
export function fmtDur(s: number | null | undefined): string {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
export function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr), today = new Date(), yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}
export function toBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
function smoothScrollBy(container: HTMLElement, delta: number, duration: number) {
  const start = container.scrollTop;
  const end = start + delta;
  const startTime = performance.now();
  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    container.scrollTop = start + (end - start) * ease;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function buildReactionGroups(msg: ChatMessage, currentUserId: any): ReactionGroup[] {
  const allEmojis = [...new Set((msg.reactions ?? []).map(r => r.reaction))];
  return allEmojis.map((e: any) => {
    const raw = (msg.reactions ?? []).filter((r: any) => r.reaction === e);
    return {
      emoji: e,
      count: raw.length,
      reactors: raw.map((r: any) => ({ userId: r.userId, userName: r.userName || String(r.userId), profileImageUrl: r.userImageUrl || null })),
      myReaction: raw.some((r: any) => String(r.userId) === String(currentUserId))
    };
  });
}

// Unique optimistic ID generator
let optimisticIdCounter = 0;
function nextOptimisticId(): string {
  return `optimistic-${Date.now()}-${++optimisticIdCounter}`;
}

@Component({
  selector: 'app-teacher-course-rooms',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TranslocoModule,
    LucideAngularModule,
    NzSpinModule,
    NzButtonModule,
    NzBadgeModule,
    NzTagModule,
    NzAvatarModule,
    NzTooltipModule,
    NzModalModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    NzSwitchModule,
    NzDividerModule,
    NzListModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzPopoverModule,
    PickerModule,
    NzIconModule,
    NzGridModule,
    NzProgressModule,
  ],
  templateUrl: './teacher-course-rooms.html',
  styleUrls: ['./teacher-course-rooms.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherCourseRooms' },
  ],
})
export class TeacherCourseRooms implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('endRef') endRef!: ElementRef<HTMLDivElement>;
  @ViewChild('topSentinel') topSentinelRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;

  // ── Lucide icons ────────────────────────────────────────────────
  readonly ArrowLeftIcon      = ArrowLeft;
  readonly PlusIcon           = Plus;
  readonly MenuIcon           = Menu;
  readonly XIcon              = X;
  readonly FlagIcon           = Flag;
  readonly UserPlusIcon       = UserPlus;
  readonly SettingsIcon       = Settings;
  readonly UnlockIcon         = Unlock;
  readonly LockIcon           = Lock;
  readonly CameraIcon         = Camera;
  readonly PaperclipIcon      = Paperclip;
  readonly MicIcon            = Mic;
  readonly SendIcon           = Send;
  readonly ChevronDownIcon    = ChevronDown;
  readonly SmileIcon          = Smile;
  readonly EditIcon           = Edit;
  readonly Trash2Icon         = Trash2;
  readonly MessageSquareIcon  = MessageSquare;
  readonly AlertCircleIcon    = AlertCircle;
  readonly CheckCheckIcon     = CheckCheck;
  readonly ClockIcon          = Clock;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly BookIcon           = Book;
  readonly RocketIcon         = Rocket;
  readonly UsersIcon          = Users;
  readonly AudioIcon          = AudioLines;
  readonly FileTextIcon       = FileText;
  readonly ImageIcon          = Image;
  readonly ArchiveIcon        = Archive;
  readonly FileIcon           = File;
  readonly CheckCircleIcon    = CheckCircle2;
  readonly XCircleIcon        = XCircle;
  // ── New icons ───────────────────────────────────────────────────
  readonly EyeIcon            = Eye;
  readonly DownloadIcon       = Download;
  readonly DatabaseIcon       = Database;
  readonly UserIcon           = User;

  // ── Expose globals to template ──────────────────────────────────
  String = String;
  CT = CT;
  fmtTime = fmtTime;
  fmtDate = fmtDate;
  fmtSize = fmtSize;
  fmtDur = fmtDur;
  getDateLabel = getDateLabel;

  currentUserId: any;

  // ── Core state ──────────────────────────────────────────────────
  planInfo: PlanInfo | null = null;
  rooms: CourseRoom[] = [];
  activeRoom: CourseRoom | null = null;
  messages: ChatMessage[] = [];
  members: RoomMember[] = [];
  reports: Report[] = [];
  courses: Course[] = [];
  enrolledStudents: EnrolledStudent[] = [];
  onlineUsers: (string | number)[] = [];
  quota: QuotaInfo | null = null;

  // ── Error banner ─────────────────────────────────────────────────
  errorMessage: string | null = null;

  // ── Pagination ──────────────────────────────────────────────────
  pagination: PaginationState = {
    page: 1, hasMore: false, totalCount: 0,
    oldestCursor: null, isLoadingMore: false, isInitialLoading: true
  };

  // ── Scroll / unread ─────────────────────────────────────────────
  isAtBottom = true;
  unreadCount = 0;

  // ── UI state ────────────────────────────────────────────────────
  loading = true;
  sending = false;
  voiceSending = false;
  text = '';
  editingMsg: ChatMessage | null = null;
  replyingTo: ChatMessage | null = null;
  showVoice = false;
  siderOpen = false;
  previewFile: File | null = null;
  previewUrl: string | null = null;
  previewCaption = '';
  previewSending = false;

  fileSendPreviewFile: File | null = null;
  fileSendPreviewCaption = '';
  fileSendPreviewModalVisible = false;
  fileSendPreviewSending = false;

  createModalOpen = false;
  addMembersModalOpen = false;
  settingsDrawerOpen = false;
  membersDrawerOpen = false;
  reportsDrawerOpen = false;

  // ── Emoji picker ────────────────────────────────────────────────
  emojiPickerVisible = false;
  emojiPickerX = 0;
  emojiPickerY = 0;
  emojiPickerMsg: ChatMessage | null = null;
  emojiPickerPlacement: 'right' | 'left' | 'top' | 'bottom' = 'right';

  // ── Image view modal (click on sent image) ───────────────────────
  imageViewModalVisible = false;
  imageViewMsg: ChatMessage | null = null;

  // ── File preview modal (click on sent file) ──────────────────────
  filePreviewModalVisible = false;
  filePreviewMsg: ChatMessage | null = null;

  createForm!: FormGroup;
  addMembersForm!: FormGroup;
  settingsForm!: FormGroup;

  // Voice recorder
  voice: VoiceState = { state: 'idle', elapsed: 0, audioUrl: null, blob: null, mime: 'audio/webm' };
  private voiceRec: MediaRecorder | null = null;
  private voiceChunks: Blob[] = [];
  private voiceTimer: any = null;

  // ── Private refs ────────────────────────────────────────────────
  private hub: signalR.HubConnection | null = null;
  private isLoadingOlderRef = false;
  private loadingMoreRef = false;
  private prevMsgCount = 0;
  private isInitialMount = true;
  private intersectionObserver: IntersectionObserver | null = null;
  private scrollListener: (() => void) | null = null;

  // ── Derived getters ─────────────────────────────────────────────
  get isTeacher(): boolean {
    return !!(this.activeRoom && this.currentUserId && String(this.activeRoom.creatorId) === String(this.currentUserId));
  }
  get inputVisible(): boolean {
    return !!(this.activeRoom && (this.isTeacher || !this.activeRoom.isClosed));
  }
  get atLimit(): boolean {
    return !!(this.planInfo?.maxRoomsAllowed && this.planInfo.maxRoomsAllowed > 0 && this.planInfo.currentRoomCount >= this.planInfo.maxRoomsAllowed);
  }
  get quotaBlocked(): boolean {
    return !!(this.quota && !this.quota.isUnlimited && this.quota.limit > 0 && this.quota.used >= this.quota.limit);
  }
  get pendingReports(): Report[] {
    return this.reports.filter((r: any) => !r.isReviewed);
  }
  get activeMembers(): RoomMember[] {
    return this.members.filter((m: any) => !m.isRemoved);
  }
  get availableCoursesForRoom(): Course[] {
    const coursesWithRoom = new Set(this.rooms.map((r: any) => r.courseId));
    return this.courses.filter((c: any) => !coursesWithRoom.has(c.id));
  }
  get hasCourses(): boolean { return this.courses.length > 0; }
  get quotaPct(): number {
    if (!this.quota || this.quota.isUnlimited || !this.quota.limit) return 0;
    return Math.round((this.quota.used / this.quota.limit) * 100);
  }
  get showQuotaWarning(): boolean {
    return !!(this.quota && !this.quota.isUnlimited && this.quota.limit > 0 && (this.quotaPct >= 80 || this.quota.used >= this.quota.limit));
  }
  get quotaIsBlocked(): boolean {
    return !!(this.quota && !this.quota.isUnlimited && this.quota.limit > 0 && this.quota.used >= this.quota.limit);
  }
  get roomUsagePct(): number {
    if (!this.planInfo || !this.planInfo.maxRoomsAllowed) return 0;
    return Math.min(100, (this.planInfo.currentRoomCount / this.planInfo.maxRoomsAllowed) * 100);
  }
  get canSendImages(): boolean {
    return !!(this.isTeacher || this.activeRoom?.allowStudentsToSendImages);
  }
  get canSendFiles(): boolean {
    return !!(this.isTeacher || this.activeRoom?.allowStudentsToSendFiles);
  }
  get canSendVoice(): boolean {
    return !!(this.isTeacher || this.activeRoom?.allowStudentsToSendVoice);
  }

  get previewModalVisible(): boolean { return !!this.previewFile; }
  set previewModalVisible(v: boolean) { if (!v) this.cancelPreview(); }

  constructor(
    private router: Router,
    private http: HttpClient,
    private fb: FormBuilder,
    private message: NzMessageService,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private langService: Language,
    @Inject(APP_CONFIG) private config: any,
    private cookie: Cookie,
    private transloco: TranslocoService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.cookie.retrieveCookie('fxSBE5PtmD35dx82BIpDg');
    this.buildForms();
    this.loadInitial();
  }

  ngOnDestroy(): void {
    this.hub?.stop();
    this.intersectionObserver?.disconnect();
    if (this.scrollListener) {
      this.messagesContainerRef?.nativeElement?.removeEventListener('scroll', this.scrollListener);
    }
    this.stopVoiceTimer();
    this.voiceRec?.stream?.getTracks().forEach(t => t.stop());
  }

  // ── i18n helper ─────────────────────────────────────────────────
  t(key: string): string {
    // Try scoped key first
    const scopedKey = `teacherCourseRooms.${key}`;
    let translated = this.transloco.translate(scopedKey);
    
    // If still showing raw key, try without scope
    if (translated === scopedKey || !translated || translated === key) {
      translated = this.transloco.translate(key);
    }
    
    // Return translated or fallback to readable key
    return (translated && translated !== scopedKey && translated !== key) 
      ? translated 
      : this.readableFallback(key);
  }

  private readableFallback(key: string): string {
    // Convert camelCase to readable text
    const readable = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    return readable;
  }

  // ── Forms ────────────────────────────────────────────────────────
  buildForms(): void {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      courseId: [null, Validators.required],
      addAll: [false],
      students: [[]],
      allowFiles: [true],
      allowImages: [true],
      allowVoice: [true]
    });
    this.addMembersForm = this.fb.group({
      addAll: [false],
      studentIds: [[]]
    });
    this.settingsForm = this.fb.group({
      name: [''],
      description: [''],
      allowFiles: [true],
      allowImages: [true],
      allowVoice: [true]
    });
  }

  // ── Initial load ─────────────────────────────────────────────────
  async loadInitial(): Promise<void> {
    this.loading = true;
    try {
      const [plan, rooms, courses] = await Promise.all([
        this.http.get<any>(`${this.config.baseUrl}/api/courseroom/plan-info`).toPromise(),
        this.http.get<any>(`${this.config.baseUrl}/api/courseroom/my-rooms`).toPromise(),
        this.http.get<any>(`${this.config.baseUrl}/api/courses/instructor-courses-list`).toPromise()
      ]);
      this.planInfo = plan?.data ?? null;
      this.rooms = rooms?.data ?? [];
      this.courses = courses?.data ?? [];
    } catch {
      this.notification.error(this.t('errorTitle'), this.t('loadFailed'));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadRooms(): Promise<void> {
    try {
      const r = await this.http.get<any>(`${this.config.baseUrl}/api/courseroom/my-rooms`).toPromise();
      this.rooms = r?.data ?? [];
    } catch {}
    this.cdr.markForCheck();
  }

  async loadMembers(): Promise<void> {
    if (!this.activeRoom) return;
    try {
      const r = await this.http.get<any>(`${this.config.baseUrl}/api/courseroom/${this.activeRoom.id}/members`).toPromise();
      this.members = r?.data ?? [];
    } catch {}
    this.cdr.markForCheck();
  }

  async loadReports(): Promise<void> {
    if (!this.activeRoom) return;
    try {
      const r = await this.http.get<any>(`${this.config.baseUrl}/api/courseroom/${this.activeRoom.id}/reports`).toPromise();
      this.reports = r?.data ?? [];
    } catch {}
    this.cdr.markForCheck();
  }

  async loadEnrolledStudents(courseId: string | number): Promise<void> {
    try {
      const r = await this.http.get<any>(`${this.config.baseUrl}/api/enrollments/admin/course/${courseId}/enrollments`).toPromise();
      this.enrolledStudents = r?.data ?? [];
    } catch {
      this.enrolledStudents = [];
    }
    this.cdr.markForCheck();
  }

  // ── Room selection ───────────────────────────────────────────────
  async selectRoom(room: CourseRoom): Promise<void> {
    this.activeRoom = room;
    this.messages = [];
    this.quota = null;
    this.text = '';
    this.editingMsg = null;
    this.replyingTo = null;
    this.isAtBottom = true;
    this.unreadCount = 0;
    this.prevMsgCount = 0;
    this.isInitialMount = true;
    this.loadingMoreRef = false;
    this.isLoadingOlderRef = false;
    this.errorMessage = null;
    this.pagination = { page: 1, hasMore: false, totalCount: 0, oldestCursor: null, isLoadingMore: false, isInitialLoading: true };
    this.siderOpen = false;
    this.cdr.markForCheck();

    await this.connectHub();
    this.loadMembers();
    this.loadReports();

    setTimeout(() => {
      this.setupScrollListener();
      this.setupIntersectionObserver();
    }, 100);
  }

  // ── Scroll ───────────────────────────────────────────────────────
  setupScrollListener(): void {
    const container = this.messagesContainerRef?.nativeElement;
    if (!container) return;
    if (this.scrollListener) container.removeEventListener('scroll', this.scrollListener);
    this.scrollListener = () => {
      const atBottom = this.checkIsAtBottom();
      this.ngZone.run(() => {
        this.isAtBottom = atBottom;
        if (atBottom) this.unreadCount = 0;
        this.cdr.markForCheck();
      });
    };
    container.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  setupIntersectionObserver(): void {
    this.intersectionObserver?.disconnect();
    const sentinel = this.topSentinelRef?.nativeElement;
    const container = this.messagesContainerRef?.nativeElement;
    if (!sentinel || !container) return;
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && this.pagination.hasMore && !this.loadingMoreRef && !this.pagination.isInitialLoading) {
          this.ngZone.run(() => this.loadOlderMessages());
        }
      },
      { root: container, rootMargin: '100px 0px 0px 0px', threshold: 0 }
    );
    this.intersectionObserver.observe(sentinel);
  }

  checkIsAtBottom(): boolean {
    const c = this.messagesContainerRef?.nativeElement;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < AT_BOTTOM_THRESHOLD;
  }

  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const container = this.messagesContainerRef?.nativeElement;
    if (!container) return;
    if (behavior === 'auto') {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  onScrollFab(): void {
    this.scrollToBottom('smooth');
    this.unreadCount = 0;
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.crb-emoji-floating') || target.closest('.crb-emoji-trigger')) {
      return;
    }
    if (this.emojiPickerVisible) {
      this.closeEmojiPicker();
    }
    if (!target.closest('.crb-ctx-menu') && !target.closest('.crb-ctx-trigger')) {
      this.messages.forEach(m => m._ctxOpen = false);
      this.cdr.markForCheck();
    }
  }
  // ── Load older messages ──────────────────────────────────────────
  async loadOlderMessages(): Promise<void> {
    if (!this.activeRoom || this.loadingMoreRef || !this.pagination.hasMore || this.pagination.isInitialLoading) return;

    this.loadingMoreRef = true;
    this.isLoadingOlderRef = true;
    this.pagination = { ...this.pagination, isLoadingMore: true };
    this.cdr.markForCheck();

    const container = this.messagesContainerRef?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    try {
      let olderMsgs: ChatMessage[] = [];
      let newHasMore = false;
      let newTotalCount = this.pagination.totalCount;
      let newOldestCursor: string | null = null;

      if (this.pagination.oldestCursor) {
        const res = await this.http.get<any>(`${this.config.baseUrl}/api/courseroom/${this.activeRoom.id}/messages/before`,
          { params: { before: this.pagination.oldestCursor, pageSize: String(PAGE_SIZE) } }).toPromise();
        const payload = res?.data;
        olderMsgs = payload?.messages ?? [];
        newHasMore = payload?.hasMore ?? (olderMsgs.length >= PAGE_SIZE);
        newTotalCount = payload?.totalCount ?? newTotalCount;
        newOldestCursor = payload?.oldestMessageTime ?? null;
      } else {
        const nextPage = this.pagination.page + 1;
        const res = await this.http.get<any>(`${this.config.baseUrl}/api/courseroom/${this.activeRoom.id}/messages`,
          { params: { pageNumber: String(nextPage), pageSize: String(PAGE_SIZE) } }).toPromise();
        const payload = res?.data;
        olderMsgs = payload?.messages ?? [];
        newHasMore = payload?.hasMore ?? (olderMsgs.length >= PAGE_SIZE);
        newTotalCount = payload?.totalCount ?? newTotalCount;
        newOldestCursor = payload?.oldestMessageTime ?? null;
        this.pagination = { ...this.pagination, page: nextPage };
      }

      if (olderMsgs.length === 0) {
        this.pagination = { ...this.pagination, hasMore: false, isLoadingMore: false };
        this.cdr.markForCheck();
        return;
      }

      const existingIds = new Set(this.messages.map((m: any) => String(m.id)));
      const fresh = olderMsgs.filter((m: any) => !existingIds.has(String(m.id)));
      if (fresh.length) {
        this.messages = [...fresh.map((m: any) => this.enrichMessage(m)), ...this.messages];
      }

      this.pagination = { ...this.pagination, hasMore: newHasMore, totalCount: newTotalCount, oldestCursor: newOldestCursor ?? this.pagination.oldestCursor, isLoadingMore: false };
      this.cdr.markForCheck();

      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const targetScrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          smoothScrollBy(container, targetScrollTop - container.scrollTop, SMOOTH_SCROLL_DURATION);
        }
        setTimeout(() => { this.isLoadingOlderRef = false; }, SMOOTH_SCROLL_DURATION + 50);
      });
    } catch {
      this.pagination = { ...this.pagination, hasMore: false, isLoadingMore: false };
      this.isLoadingOlderRef = false;
      this.cdr.markForCheck();
    } finally {
      setTimeout(() => { this.loadingMoreRef = false; }, 300);
    }
  }

  // ── SignalR Hub ──────────────────────────────────────────────────
  async connectHub(): Promise<void> {
    if (this.hub) { await this.hub.stop(); this.hub = null; }
    const token = this.cookie.retrieveCookie('etHy0B87RlH9CXykEzclg');
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.config.baseUrl}/hubs/course-room`, { accessTokenFactory: () => token || '' })
      .withAutomaticReconnect()
      .build();

    hub.on('JoinedRoom', () => {});

    hub.on('AllMessagesLoaded', (payload: any) => {
      this.ngZone.run(() => {
        const msgs: ChatMessage[] = payload?.messages ?? (Array.isArray(payload) ? payload : []);
        const sorted = [...msgs].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
        this.messages = sorted.map((m: any) => this.enrichMessage(m));
        const hasMore = payload?.hasMore ?? sorted.length >= PAGE_SIZE;
        const totalCount = payload?.totalCount ?? sorted.length;
        const oldest = payload?.oldestMessageTime ?? (sorted.length > 0 ? sorted[0].sentAt : null);
        this.pagination = { page: 1, hasMore, totalCount, oldestCursor: oldest, isLoadingMore: false, isInitialLoading: false };
        this.cdr.markForCheck();
        requestAnimationFrame(() => this.scrollToBottom('auto'));
        setTimeout(() => { this.setupScrollListener(); this.setupIntersectionObserver(); }, 150);
      });
    });

    hub.on('NewMessage', (msg: ChatMessage) => {
      this.ngZone.run(() => {
        // ── Remove matching optimistic message ──────────────────────
        // Match by content + contentType for text messages.
        // For media (image/audio/video/file), content may be null — match by contentType only
        // to avoid ghost optimistic messages lingering.
        const optimisticIdx = this.messages.findIndex(m => {
          if (!m._pending || !m.isCurrentUserSender) return false;
          if (m.contentType !== msg.contentType) return false;
          // For text: match content exactly
          if (msg.contentType === CT.Text) return m.content === msg.content;
          // For media with no content: match first pending of that type
          if (msg.contentType === CT.Image || msg.contentType === CT.Audio ||
              msg.contentType === CT.Video || msg.contentType === CT.File) {
            return m.fileName === msg.fileName || (!m.fileName && !msg.fileName);
          }
          return false;
        });

        if (optimisticIdx !== -1) {
          this.messages = [
            ...this.messages.slice(0, optimisticIdx),
            ...this.messages.slice(optimisticIdx + 1)
          ];
        }

        // Add the real message if not already in list
        if (!this.messages.find(m => String(m.id) === String(msg.id))) {
          const enriched = this.enrichMessage(msg);
          this.messages = [...this.messages, enriched];
          this.pagination = { ...this.pagination, totalCount: this.pagination.totalCount + 1 };

          if (!this.isLoadingOlderRef) {
            if (this.isAtBottom) {
              // Use detectChanges (not just markForCheck) so the DOM updates
              // synchronously before we try to scroll — critical for voice/audio
              this.cdr.detectChanges();
              this.scrollToBottom('smooth');
              this.unreadCount = 0;
            } else {
              this.unreadCount++;
            }
          }
        }

        this.cdr.markForCheck();
      });
    });

    hub.on('MessageUpdated', ({ messageId, updatedMessage }: any) => {
      this.ngZone.run(() => {
        this.messages = this.messages.map((m: any) =>
          String(m.id) === String(messageId) ? this.enrichMessage({ ...m, ...updatedMessage }) : m
        );
        this.cdr.markForCheck();
      });
    });

    hub.on('MessageDeleted', ({ messageId }: any) => {
      this.ngZone.run(() => {
        this.messages = this.messages.map((m: any) =>
          String(m.id) === String(messageId) ? { ...m, isDeleted: true, content: null, fileUrl: null } : m
        );
        this.cdr.markForCheck();
      });
    });

    hub.on('MessageReacted', ({ messageId, userId, reaction, userName, userImageUrl }: any) => {
      this.ngZone.run(() => {
        this.messages = this.messages.map((m: any) => {
          if (String(m.id) !== String(messageId)) return m;
          const filtered = (m.reactions ?? []).filter((r: any) => !(String(r.userId) === String(userId) && r.reaction === reaction));
          filtered.push({ userId, reaction, userName: userName || String(userId), userImageUrl: userImageUrl || null });
          return this.enrichMessage({ ...m, reactions: filtered });
        });
        this.cdr.markForCheck();
      });
    });

    hub.on('ReactionRemoved', ({ messageId, userId, reaction }: any) => {
      this.ngZone.run(() => {
        this.messages = this.messages.map((m: any) => {
          if (String(m.id) !== String(messageId)) return m;
          return this.enrichMessage({ ...m, reactions: (m.reactions ?? []).filter((r: any) => !(String(r.userId) === String(userId) && r.reaction === reaction)) });
        });
        this.cdr.markForCheck();
      });
    });

    hub.on('MessageReported', () => this.ngZone.run(() => this.loadReports()));

    hub.on('OnlineUsers', (ids: any[]) => this.ngZone.run(() => {
      this.onlineUsers = ids ?? [];
      this.cdr.markForCheck();
    }));

    hub.on('UserJoinedRoom', ({ userId }: any) => this.ngZone.run(() => {
      this.onlineUsers = [...new Set([...this.onlineUsers, userId])];
      this.cdr.markForCheck();
    }));

    hub.on('UserLeftRoom', ({ userId }: any) => this.ngZone.run(() => {
      this.onlineUsers = this.onlineUsers.filter((id: any) => String(id) !== String(userId));
      this.cdr.markForCheck();
    }));

    hub.on('MemberRemoved', ({ removedUserId }: any) => this.ngZone.run(() => {
      this.members = this.members.filter((m: any) => String(m.userId) !== String(removedUserId));
      this.cdr.markForCheck();
    }));

    hub.on('RoomClosed', () => this.ngZone.run(() => {
      if (this.activeRoom) this.activeRoom = { ...this.activeRoom, isClosed: true };
      this.rooms = this.rooms.map((r: any) => r.id === this.activeRoom?.id ? { ...r, isClosed: true } : r);
      this.cdr.markForCheck();
    }));

    hub.on('RoomReopened', () => this.ngZone.run(() => {
      if (this.activeRoom) this.activeRoom = { ...this.activeRoom, isClosed: false };
      this.rooms = this.rooms.map((r: any) => r.id === this.activeRoom?.id ? { ...r, isClosed: false } : r);
      this.cdr.markForCheck();
    }));

    hub.on('QuotaInfo', (q: QuotaInfo) => this.ngZone.run(() => {
      this.quota = { ...q, isUnlimited: q.isUnlimited || !q.limit || q.limit <= 0 };
      this.cdr.markForCheck();
    }));

    hub.on('QuotaDenied', (q: QuotaInfo) => this.ngZone.run(() => {
      if (!q.limit || q.limit <= 0) return;
      this.quota = { ...q, blocked: true };
      this.notification.warning(this.t('quotaReachedTitle'), this.t('quotaReachedDesc'));
      this.cdr.markForCheck();
    }));

    // ── Error handler: show in banner, not just a toast ──────────────
    hub.on('Error', (err: string) => this.ngZone.run(() => {
      const msg = err ?? this.t('genericError');
      this.errorMessage = msg;
      // Also fail any pending optimistic messages so user can see/retry
      this.messages = this.messages.map(m =>
        m._pending ? { ...m, _pending: false, _failed: true } : m
      );
      this.cdr.markForCheck();
    }));

    try {
      await hub.start();
      this.hub = hub;
      await hub.invoke('JoinRoom', this.activeRoom!.id);
    } catch (err: any) {
      const msg = err?.message ?? this.t('connectionFailed');
      this.errorMessage = msg;
      this.notification.error(this.t('errorTitle'), this.t('connectionFailed'));
      this.cdr.markForCheck();
    }
  }

  // ── Message helpers ──────────────────────────────────────────────
  enrichMessage(m: ChatMessage): ChatMessage {
    return { ...m, _reactionGroups: buildReactionGroups(m, this.currentUserId), _showEmojiPicker: false, _ctxOpen: false };
  }

  groupedMessages(): { type: 'separator' | 'message'; label?: string; msg?: ChatMessage }[] {
    const result: { type: 'separator' | 'message'; label?: string; msg?: ChatMessage }[] = [];
    let lastLabel = '';
    for (const msg of this.messages) {
      const label = getDateLabel(msg.sentAt);
      if (label !== lastLabel) { result.push({ type: 'separator', label }); lastLabel = label; }
      result.push({ type: 'message', msg });
    }
    return result;
  }

  trackByMsg(_: number, item: { type: string; label?: string; msg?: ChatMessage }): any {
    if (item.type === 'separator') return `sep-${item.label}`;
    return item.msg?.id;
  }

  isOnline(userId: string | number): boolean {
    return this.onlineUsers.some(id => String(id) === String(userId));
  }

  isSameUser(userId: string | number): boolean {
    return String(userId) === String(this.currentUserId);
  }

  avatarUrl(path?: string | null): string | null {
    if (!path) return null;
    return `${this.config.baseUrl}/${path}`.replace(/([^:])\/\/+/g, '$1/');
  }

  fileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    return `${this.config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /** Bypass security for PDF iframe src */
  safeFileUrl(path: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.fileUrl(path));
  }

  // ── Send helpers ─────────────────────────────────────────────────
  async hubSend(
    roomId: any,
    content: string | null,
    replyToId: any,
    fileData: string | null,
    fileName: string | null,
    fileMimeType: string | null,
    fileCaption: string | null,
    audioDuration: number | null
  ): Promise<void> {
    if (!this.hub) throw new Error('Not connected');
    await this.hub.invoke('SendMessage',
      roomId, content ?? null, replyToId ?? null,
      fileData ?? null, fileName ?? null, fileMimeType ?? null,
      fileCaption ?? null, audioDuration ?? null
    );
  }

  /** Creates and inserts an optimistic message into the list, returns its temp id */
  private addOptimisticMessage(
    content: string | null,
    contentType: number,
    replyTo?: ChatMessage | null,
    fileName?: string | null,
    fileUrl?: string | null
  ): string {
    const tempId = nextOptimisticId();
    const optimistic: ChatMessage = {
      id: tempId,
      content,
      contentType,
      fileName: fileName ?? null,
      fileUrl: fileUrl ?? null,
      fileSize: null,
      fileMimeType: null,
      audioDurationSeconds: null,
      senderId: this.currentUserId,
      senderName: 'You',
      senderImageUrl: null,
      isSenderTeacher: this.isTeacher,
      isCurrentUserSender: true,
      sentAt: new Date().toISOString(),
      editedAt: null,
      isDeleted: false,
      canEdit: true,
      canDelete: true,
      reactions: [],
      replyToMessage: replyTo
        ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content }
        : null,
      _pending: true,
      _failed: false,
      _reactionGroups: [],
      _showEmojiPicker: false,
      _ctxOpen: false,
    };
    this.messages = [...this.messages, optimistic];
    this.pagination = { ...this.pagination, totalCount: this.pagination.totalCount + 1 };
    if (this.isAtBottom) {
      requestAnimationFrame(() => this.scrollToBottom('smooth'));
    }
    this.cdr.markForCheck();
    return tempId;
  }

  private markOptimisticFailed(tempId: string): void {
    this.messages = this.messages.map(m =>
      String(m.id) === tempId ? { ...m, _pending: false, _failed: true } : m
    );
    this.cdr.markForCheck();
  }

  private removeOptimistic(tempId: string): void {
    this.messages = this.messages.filter(m => String(m.id) !== tempId);
    this.cdr.markForCheck();
  }

  async sendText(): Promise<void> {
    const content = this.text.trim();
    if (!content || !this.activeRoom) return;
    if (this.quotaBlocked) {
      this.notification.warning(this.t('quotaReachedTitle'), this.t('quotaReachedDesc'));
      return;
    }
    this.sending = true;
    const replyTo = this.replyingTo;

    if (this.editingMsg) {
      // Editing: no optimistic needed
      try {
        await this.hub!.invoke('UpdateMessage', this.activeRoom.id, this.editingMsg.id, content);
        this.editingMsg = null;
        this.text = '';
        this.errorMessage = null;
      } catch (err: any) {
        this.errorMessage = err?.message ?? this.t('sendFailed');
      } finally {
        this.sending = false;
        this.cdr.markForCheck();
      }
      return;
    }

    // Optimistic insert
    const tempId = this.addOptimisticMessage(content, CT.Text, replyTo);
    this.text = '';
    this.replyingTo = null;
    this.sending = false;
    this.errorMessage = null;
    this.cdr.markForCheck();

    try {
      await this.hubSend(this.activeRoom.id, content, replyTo?.id ?? null, null, null, null, null, null);
      // Real message replaces optimistic via NewMessage event
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage = err?.message ?? this.t('sendFailed');
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendText(); }
    else {
      // Typing indicator
      if (this.hub && this.activeRoom) {
        this.hub.invoke('Typing', this.activeRoom.id, true).catch(() => {});
      }
    }
  }

  async retryMessage(msg: ChatMessage): Promise<void> {
    if (!msg._failed || !this.activeRoom) return;
    // Reset to pending
    this.messages = this.messages.map(m =>
      m.id === msg.id ? { ...m, _pending: true, _failed: false } : m
    );
    this.errorMessage = null;
    this.cdr.markForCheck();
    try {
      await this.hubSend(
        this.activeRoom.id,
        msg.content ?? null,
        msg.replyToMessage?.id ?? null,
        null, null, null, null, null
      );
    } catch (err: any) {
      this.markOptimisticFailed(String(msg.id));
      this.errorMessage = err?.message ?? this.t('sendFailed');
    }
  }

  async sendFile(file: File, caption?: string | null, replyTo?: ChatMessage | null): Promise<void> {
    if (!this.activeRoom) return;
    const tempId = this.addOptimisticMessage(caption || null, CT.File, replyTo || null, file.name, null);
    try {
      const b64 = await toBase64(file);
      await this.hubSend(this.activeRoom.id, caption || null, replyTo?.id ?? null, b64, file.name, file.type, caption || null, null);
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage = err?.message ?? this.t('sendFailed');
      throw err;
    }
  }

  async sendVoice(base64: string, fileName: string, mimeType: string, durationSeconds: number): Promise<void> {
    if (!this.activeRoom) return;
    this.voiceSending = true;
    this.showVoice = false;

    // Add optimistic placeholder for voice so user gets immediate feedback
    const tempId = this.addOptimisticMessage(null, CT.Audio, null, fileName, null);
    this.cdr.markForCheck();

    try {
      await this.hubSend(this.activeRoom.id, null, null, base64, fileName, mimeType, null, durationSeconds);
      // Real message arrives via NewMessage and replaces optimistic
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage = err?.message ?? this.t('sendFailed');
    } finally {
      this.voiceSending = false;
      this.cdr.markForCheck();
    }
  }

  // ── File picking ─────────────────────────────────────────────────
  validateFileSize(file: File, maxSize = MAX_FILE_SIZE): boolean {
    if (file.size > maxSize) {
      const maxLabel = maxSize === MAX_IMAGE_SIZE ? '10 MB' : '500 MB';
      this.message.error(`${this.t('fileTooLarge')} ${maxLabel}. ${this.t('yourFileIs')} ${fmtSize(file.size)}.`);
      return false;
    }
    return true;
  }

  validateFileType(file: File): boolean {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      this.message.error(this.t('invalidFileType'));
      return false;
    }
    return true;
  }

  onImageSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';

    if (!this.canSendImages) {
      this.message.error(this.t('imagesNotAllowed'));
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      this.message.error(this.t('invalidImageType'));
      return;
    }

    if (!this.validateFileSize(file, MAX_IMAGE_SIZE)) return;

    this.previewFile = file;
    this.previewUrl = URL.createObjectURL(file);
    this.previewCaption = '';
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';

    if (!this.canSendFiles) {
      this.message.error(this.t('filesNotAllowed'));
      return;
    }

    // Security: validate even if user removed the HTML accept attribute
    if (!this.validateFileType(file)) return;
    if (!this.validateFileSize(file)) return;

    // Open preview modal instead of sending immediately
    this.fileSendPreviewFile = file;
    this.fileSendPreviewCaption = '';
    this.fileSendPreviewModalVisible = true;
    this.cdr.markForCheck();
  }

  cancelPreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewFile = null;
    this.previewUrl = null;
    this.previewCaption = '';
  }

  async sendPreview(): Promise<void> {
    if (!this.previewFile || !this.activeRoom) return;
    this.previewSending = true;
    const file = this.previewFile;
    const caption = this.previewCaption;
    const replyTo = this.replyingTo;

    // Optimistic insert for image with local blob URL
    const localUrl = this.previewUrl ?? '';
    const tempId = this.addOptimisticMessage(caption || null, CT.Image, replyTo, file.name, localUrl);
    this.replyingTo = null;
    this.cancelPreview();

    try {
      const b64 = await toBase64(file);
      await this.hubSend(this.activeRoom.id, caption || null, replyTo?.id ?? null, b64, file.name, file.type, caption || null, null);
      // NewMessage event handles removing optimistic and inserting real message
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage = err?.message ?? this.t('sendFailed');
    } finally {
      this.previewSending = false;
      this.cdr.markForCheck();
    }
  }

  // ── Voice recorder ───────────────────────────────────────────────
  async sendFilePreview(): Promise<void> {
    if (!this.fileSendPreviewFile || !this.activeRoom) return;
    this.fileSendPreviewSending = true;
    this.cdr.markForCheck();

    const file = this.fileSendPreviewFile;
    const caption = this.fileSendPreviewCaption;
    const replyTo = this.replyingTo;

    this.replyingTo = null;
    this.cancelFilePreview();

    try {
      await this.sendFile(file, caption, replyTo);
    } catch {
      // Error already handled inside sendFile
    } finally {
      this.fileSendPreviewSending = false;
      this.cdr.markForCheck();
    }
  }

  cancelFilePreview(): void {
    this.fileSendPreviewFile = null;
    this.fileSendPreviewCaption = '';
    this.fileSendPreviewModalVisible = false;
  }

  async startVoiceRecorder(): Promise<void> {
    if (!this.canSendVoice) {
      this.message.error(this.t('voiceNotAllowed'));
      return;
    }
    this.showVoice = true;
    this.voice = { state: 'idle', elapsed: 0, audioUrl: null, blob: null, mime: 'audio/webm' };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
      const mime = preferred.find(x => MediaRecorder.isTypeSupported(x)) ?? 'audio/webm';
      this.voice.mime = mime;
      this.voiceChunks = [];
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = e => { if (e.data.size > 0) this.voiceChunks.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(this.voiceChunks, { type: mime });
        this.ngZone.run(() => {
          this.voice = { ...this.voice, blob: b, audioUrl: URL.createObjectURL(b), state: 'stopped' };
          stream.getTracks().forEach(t => t.stop());
          this.cdr.markForCheck();
        });
      };
      rec.start(100);
      this.voiceRec = rec;
      this.voice.state = 'recording';
      this.voice.elapsed = 0;
      this.voiceTimer = setInterval(() => this.ngZone.run(() => {
        this.voice.elapsed++;
        this.cdr.markForCheck();
      }), 1000);
      this.cdr.markForCheck();
    } catch {
      this.message.error(this.t('micDenied'));
      this.showVoice = false;
    }
  }

  stopVoiceTimer(): void {
    if (this.voiceTimer) { clearInterval(this.voiceTimer); this.voiceTimer = null; }
  }
  onEmojiSelect(event: any): void {
    if (!this.emojiPickerMsg) return;
    const emoji = event?.emoji?.native ?? event?.native;
    if (emoji) {
      this.reactToMessage(this.emojiPickerMsg, emoji);
    }
    this.closeEmojiPicker();
  }
  stopRecording(): void {
    this.stopVoiceTimer();
    this.voiceRec?.stop();
  }

  cancelVoice(): void {
    this.stopVoiceTimer();
    this.voiceRec?.stream?.getTracks().forEach(t => t.stop());
    this.voiceRec?.stop();
    this.showVoice = false;
    this.voice = { state: 'idle', elapsed: 0, audioUrl: null, blob: null, mime: 'audio/webm' };
  }

  async sendVoiceMessage(): Promise<void> {
    if (!this.voice.blob || this.voiceSending) return;
    this.voiceSending = true;
    this.cdr.markForCheck();

    const reader = new FileReader();
    reader.onload = async () => {
      const ext = this.voice.mime.includes('ogg') ? '.ogg'
        : this.voice.mime.includes('mp4') ? '.mp4' : '.webm';
      const duration = this.voice.elapsed;
      const mime = this.voice.mime;
      const b64 = reader.result as string;

      // Reset voice UI immediately
      this.voice = { state: 'idle', elapsed: 0, audioUrl: null, blob: null, mime: 'audio/webm' };
      this.voiceSending = false;

      await this.sendVoice(b64, `voice${ext}`, mime, duration);
    };
    reader.onerror = () => {
      this.voiceSending = false;
      this.message.error(this.t('sendFailed'));
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(this.voice.blob);
  }

  // ── Image view modal ─────────────────────────────────────────────
  openImagePreview(msg: ChatMessage): void {
    this.imageViewMsg = msg;
    this.imageViewModalVisible = true;
  }

  closeImageView(): void {
    this.imageViewModalVisible = false;
    this.imageViewMsg = null;
  }

  // ── File preview modal ───────────────────────────────────────────
  downloadFile(msg: ChatMessage): void {
    if (!msg.fileUrl) return;
    const link = document.createElement('a');
    link.href = this.fileUrl(msg.fileUrl);
    link.download = msg.fileName || 'download';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  closeFilePreview(): void {
    this.filePreviewModalVisible = false;
    this.filePreviewMsg = null;
  }

  isPdf(fileName?: string | null): boolean {
    return (fileName ?? '').toLowerCase().endsWith('.pdf');
  }

  getFileExt(fileName?: string | null): string {
    if (!fileName) return 'FILE';
    return (fileName.split('.').pop() ?? 'file').toUpperCase();
  }

  private getFileIconInfo(fileName?: string | null, fileMimeType?: string | null): { icon: any; color: string; bg: string } {
    const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
    const mime = (fileMimeType ?? '').toLowerCase();

    if (mime === 'application/pdf' || ext === 'pdf') return { icon: this.FileTextIcon, color: '#dc2626', bg: '#fff0f0' };
    if (['doc','docx'].includes(ext) || mime.includes('word')) return { icon: this.FileTextIcon, color: '#2563eb', bg: '#eff6ff' };
    if (['xls','xlsx'].includes(ext) || mime.includes('excel')) return { icon: this.FileTextIcon, color: '#16a34a', bg: '#f0fdf4' };
    if (['ppt','pptx'].includes(ext) || mime.includes('powerpoint')) return { icon: this.FileTextIcon, color: '#ea580c', bg: '#fff7ed' };
    if (['zip','rar','7z','tar','gz'].includes(ext)) return { icon: this.ArchiveIcon, color: '#92400e', bg: '#fffbeb' };
    if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return { icon: this.ImageIcon, color: '#7c3aed', bg: '#f5f3ff' };
    if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a','webm'].includes(ext)) return { icon: this.AudioIcon, color: '#0891b2', bg: '#ecfeff' };
    return { icon: this.FileIcon, color: '#475569', bg: '#f1f5f9' };
  }

  getFilePreviewIcon(msg: ChatMessage): any {
    return this.getFileIconInfo(msg.fileName, msg.fileMimeType).icon;
  }

  getFilePreviewColor(msg: ChatMessage): { bg: string; color: string } {
    const info = this.getFileIconInfo(msg.fileName, msg.fileMimeType);
    return { bg: info.bg, color: info.color };
  }

  getFilePreviewIconForFile(file: File): any {
    return this.getFileIconInfo(file.name, file.type).icon;
  }

  getFilePreviewColorForFile(file: File): { bg: string; color: string } {
    const info = this.getFileIconInfo(file.name, file.type);
    return { bg: info.bg, color: info.color };
  }

  // ── Message actions ──────────────────────────────────────────────
  toggleCtx(msg: ChatMessage): void {
    const wasOpen = msg._ctxOpen;
    this.messages.forEach(m => m._ctxOpen = false);
    msg._ctxOpen = !wasOpen;
    this.cdr.markForCheck();
  }

  startEdit(msg: ChatMessage): void {
    this.editingMsg = msg;
    this.text = msg.content ?? '';
    msg._ctxOpen = false;
    this.cdr.markForCheck();
  }

  cancelEdit(): void { this.editingMsg = null; this.text = ''; }

  startReply(msg: ChatMessage): void {
    this.replyingTo = msg;
    msg._ctxOpen = false;
    this.cdr.markForCheck();
  }

  cancelReply(): void { this.replyingTo = null; }

  toggleEmojiPicker(msg: ChatMessage, event?: MouseEvent): void {
    if (this.emojiPickerVisible && this.emojiPickerMsg?.id === msg.id) {
      this.closeEmojiPicker();
      return;
    }
    this.closeEmojiPicker();

    let x = 0, y = 0;
    if (event) {
      x = event.clientX;
      y = event.clientY;
    } else {
      const msgElement = document.querySelector(`[data-msg-id="${msg.id}"]`);
      if (msgElement) {
        const rect = msgElement.getBoundingClientRect();
        x = rect.right - 20;
        y = rect.top + 10;
      }
    }

    const pickerWidth = 280;
    const pickerHeight = 350;
    const padding = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let placement: 'right' | 'left' | 'top' | 'bottom' = 'right';
    let finalX = x + 10;
    let finalY = y - 20;

    if (finalX + pickerWidth + padding > vw) {
      finalX = x - pickerWidth - 10;
      placement = 'left';
    }

    if (finalY + pickerHeight + padding > vh) {
      finalY = y - pickerHeight - 10;
      if (finalY < padding) {
        finalY = Math.max(padding, vh - pickerHeight - padding);
      }
    }

    if (finalY < padding) {
      finalY = padding;
    }

    this.emojiPickerMsg = msg;
    this.emojiPickerX = finalX;
    this.emojiPickerY = finalY;
    this.emojiPickerPlacement = placement;
    this.emojiPickerVisible = true;
    this.cdr.markForCheck();
  }

  closeEmojiPicker(): void {
    this.emojiPickerVisible = false;
    this.emojiPickerMsg = null;
    this.cdr.markForCheck();
  }

  async deleteMessage(msg: ChatMessage): Promise<void> {
    msg._ctxOpen = false;
    try {
      await this.hub!.invoke('DeleteMessage', this.activeRoom!.id, msg.id);
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
  }

  async reactToMessage(msg: ChatMessage, emoji: string): Promise<void> {
    msg._showEmojiPicker = false;
    try {
      await this.hub!.invoke('ReactToMessage', this.activeRoom!.id, msg.id, emoji);
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
    this.cdr.markForCheck();
  }

  async removeReaction(msg: ChatMessage, emoji: string): Promise<void> {
    try {
      await this.hub!.invoke('RemoveReaction', this.activeRoom!.id, msg.id, emoji);
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
  }

  reportMessage(msg: ChatMessage): void {
    msg._ctxOpen = false;
    this.modal.confirm({
      nzTitle: this.t('reportTitle'),
      nzContent: `<textarea id="report-reason" rows="3" placeholder="${this.t('reportReason')}"
        style="width:100%;border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px;"></textarea>`,
      nzOnOk: async () => {
        const el = document.getElementById('report-reason') as HTMLTextAreaElement;
        const reason = el?.value?.trim();
        if (!reason) return;
        await this.hub!.invoke('ReportMessage', this.activeRoom!.id, msg.id, reason);
        this.message.success(this.t('reported'));
      }
    });
  }

  // ── Room controls ─────────────────────────────────────────────────
  async closeRoom(): Promise<void> {
    try {
      await this.hub!.invoke('CloseRoom', this.activeRoom!.id);
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
  }

  async reopenRoom(): Promise<void> {
    try {
      await this.hub!.invoke('ReopenRoom', this.activeRoom!.id);
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
  }

  async toggleMute(member: RoomMember): Promise<void> {
    try {
      await this.http.post(
        `${this.config.baseUrl}/api/courseroom/${this.activeRoom!.id}/members/${member.userId}/mute?mute=${!member.isMuted}`,
        {}
      ).toPromise();
      this.members = this.members.map((m: any) =>
        String(m.userId) === String(member.userId) ? { ...m, isMuted: !m.isMuted } : m
      );
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
    this.cdr.markForCheck();
  }

  async removeMember(member: RoomMember): Promise<void> {
    try {
      await this.hub!.invoke('RemoveMember', this.activeRoom!.id, member.userId);
      this.message.success(this.t('removed'));
    } catch (err: any) {
      this.errorMessage = err?.message ?? this.t('actionFailed');
    }
  }

  // ── Modal handlers ────────────────────────────────────────────────
  openCreateRoom(): void {
    this.createForm.reset({
      name: '', description: '', courseId: null, addAll: false,
      students: [], allowFiles: true, allowImages: true, allowVoice: true
    });
    this.createModalOpen = true;
  }

  async submitCreateRoom(): Promise<void> {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const v = this.createForm.value;
    try {
      const fd = new FormData();
      fd.append('name', v.name);
      if (v.description) fd.append('description', v.description);
      fd.append('courseId', String(v.courseId));
      fd.append('addAllEnrolledStudents', v.addAll ? 'true' : 'false');
      if (!v.addAll && v.students?.length) v.students.forEach((id: any) => fd.append('initialStudentIds', String(id)));
      fd.append('allowStudentsToSendFiles', String(v.allowFiles ?? true));
      fd.append('allowStudentsToSendImages', String(v.allowImages ?? true));
      fd.append('allowStudentsToSendVoice', String(v.allowVoice ?? true));
      await this.http.post(`${this.config.baseUrl}/api/courseroom`, fd).toPromise();
      this.message.success(this.t('roomCreated'));
      this.createModalOpen = false;
      await this.loadInitial();
    } catch (err: any) {
      this.message.error(err?.error?.message ?? this.t('actionFailed'));
    }
    this.cdr.markForCheck();
  }

  openAddMembers(): void {
    this.loadEnrolledStudents(this.activeRoom!.courseId);
    this.addMembersForm.reset({ addAll: false, studentIds: [] });
    this.addMembersModalOpen = true;
  }

  async submitAddMembers(): Promise<void> {
    const v = this.addMembersForm.value;
    try {
      await this.http.post(
        `${this.config.baseUrl}/api/courseroom/${this.activeRoom!.id}/members`,
        { addAllEnrolledStudents: v.addAll ?? false, studentIds: v.addAll ? [] : v.studentIds ?? [] }
      ).toPromise();
      this.message.success(this.t('membersAdded'));
      this.addMembersModalOpen = false;
      this.addMembersForm.reset();
      await this.loadMembers();
    } catch (err: any) {
      this.message.error(err?.error?.message ?? this.t('actionFailed'));
    }
    this.cdr.markForCheck();
  }

  openSettings(): void {
    this.settingsForm.patchValue({
      name: this.activeRoom!.name,
      description: this.activeRoom!.description,
      allowFiles: this.activeRoom!.allowStudentsToSendFiles,
      allowImages: this.activeRoom!.allowStudentsToSendImages,
      allowVoice: this.activeRoom!.allowStudentsToSendVoice
    });
    this.settingsDrawerOpen = true;
  }

  async submitSettings(): Promise<void> {
    const v = this.settingsForm.value;
    try {
      const fd = new FormData();
      if (v.name) fd.append('name', v.name);
      if (v.description) fd.append('description', v.description);
      fd.append('allowStudentsToSendFiles', String(v.allowFiles));
      fd.append('allowStudentsToSendImages', String(v.allowImages));
      fd.append('allowStudentsToSendVoice', String(v.allowVoice));
      await this.http.put(`${this.config.baseUrl}/api/courseroom/${this.activeRoom!.id}`, fd).toPromise();
      this.message.success(this.t('settingsUpdated'));
      this.settingsDrawerOpen = false;
      await this.loadRooms();
    } catch (err: any) {
      this.message.error(err?.error?.message ?? this.t('actionFailed'));
    }
    this.cdr.markForCheck();
  }

  async dismissReport(reportId: any): Promise<void> {
    try {
      await this.http.post(`${this.config.baseUrl}/api/courseroom/reports/${reportId}/review`, {}).toPromise();
      this.reports = this.reports.filter((r: any) => r.id !== reportId);
      this.message.success(this.t('dismissed'));
    } catch (err: any) {
      this.message.error(err?.error?.message ?? this.t('actionFailed'));
    }
    this.cdr.markForCheck();
  }

  navigateBack(): void { this.router.navigate(['/teacher']); }
  navigatePlans(): void { this.router.navigate(['/teacher/plans']); }
  navigateCreateCourse(): void { this.router.navigate(['/teacher/courses/create']); }

  getTooltipCreate(): string {
    if (!this.planInfo?.hasAccess) return this.t('tooltipUpgrade');
    if (!this.hasCourses) return this.t('tooltipNoCourses');
    if (this.atLimit) return this.t('tooltipRoomLimit');
    if (this.availableCoursesForRoom.length === 0) return this.t('tooltipAllCoursesHaveRooms');
    return this.t('tooltipCreateRoom');
  }

  getRoomUsageColor(): string {
    if (this.atLimit) return '#ff4d4f';
    if (this.planInfo && this.planInfo.currentRoomCount / this.planInfo.maxRoomsAllowed > 0.8) return '#e67e22';
    return '#3d5af1';
  }

  enrolledNotInRoom(): EnrolledStudent[] {
    return this.enrolledStudents.filter(s =>
      !this.members.find(m => String(m.userId) === String(s.userId))
    );
  }

  getFileTypeBadge(msg: ChatMessage): { label: string; color: string; bg: string; icon?: any } | null {
    // No badge for image/audio/video — they render their own preview
    if (msg.contentType === CT.Image || msg.contentType === CT.Audio || msg.contentType === CT.Video) {
      return null;
    }
    if (msg.contentType === CT.Text || !msg.fileName) return null;

    const ext = (msg.fileName || '').split('.').pop()?.toLowerCase() || '';
    const mime = (msg.fileMimeType || '').toLowerCase();

    if (mime === 'application/pdf' || ext === 'pdf')
      return { label: 'PDF', color: '#dc2626', bg: '#fff0f0', icon: this.FileTextIcon };
    if (['doc','docx'].includes(ext) || mime.includes('word'))
      return { label: 'Word', color: '#2563eb', bg: '#eff6ff', icon: this.FileTextIcon };
    if (['xls','xlsx'].includes(ext) || mime.includes('excel'))
      return { label: 'Excel', color: '#16a34a', bg: '#f0fdf4', icon: this.FileTextIcon };
    if (['ppt','pptx'].includes(ext) || mime.includes('powerpoint'))
      return { label: 'PPT', color: '#ea580c', bg: '#fff7ed', icon: this.FileTextIcon };
    if (['zip','rar','7z','tar','gz'].includes(ext))
      return { label: 'Archive', color: '#92400e', bg: '#fffbeb', icon: this.ArchiveIcon };
    
    return { label: ext.toUpperCase() || 'File', color: '#475569', bg: '#f1f5f9', icon: this.FileIcon };
  }
}