import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewChecked,
  NgZone, HostListener
} from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient }     from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import {
  LucideAngularModule,
  ArrowLeft, Send, Mic, Camera, Paperclip, X, Check,
  MoreHorizontal, Trash2, Menu, ChevronDown, MessageSquare,
  Smile, CheckCheck, Clock, XCircle, AlertCircle, Download,
  Image as ImageIcon, FileText, Archive, File as FileIcon,
  AudioLines, CheckCircle2
} from 'lucide-angular';

import { NzSpinModule }          from 'ng-zorro-antd/spin';
import { NzAvatarModule }        from 'ng-zorro-antd/avatar';
import { NzBadgeModule }         from 'ng-zorro-antd/badge';
import { NzEmptyModule }         from 'ng-zorro-antd/empty';
import { NzInputModule }         from 'ng-zorro-antd/input';
import { NzModalModule }         from 'ng-zorro-antd/modal';
import { NzTooltipModule }       from 'ng-zorro-antd/tooltip';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService }      from 'ng-zorro-antd/message';
import { NzTagModule }           from 'ng-zorro-antd/tag';
import { NzPopoverModule }       from 'ng-zorro-antd/popover';

import { APP_CONFIG }  from '../../../core/config/app.config';
import { Cookie }      from '../../../core/services/cookie';

// ── Constants ────────────────────────────────────────────────────────
const MAX_FILE_SIZE  = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10  * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = [
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
  'zip','rar','7z','tar','gz','txt','csv',
  'mp3','mp4','mov','avi','mkv','wav','ogg','webm'
];
const AT_BOTTOM_THRESHOLD = 120;

export const CT = { Text: 0, Image: 1, Audio: 2, Video: 3, File: 4 };

// ── Types ────────────────────────────────────────────────────────────
export interface ChatConversation {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar?: string;
  otherPartyRole: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactors: { userId: string | number; userName: string; profileImageUrl: string | null }[];
  myReaction: boolean;
}

export interface ReplyInfo {
  id: string;
  senderName: string;
  content?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  message?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: string;
  contentType?: number;       // 0=text 1=image 2=audio 3=video 4=file
  isVoice?: boolean;
  isRead: boolean;
  createdAt: string;
  isDeleted?: boolean;
  replyTo?: ReplyInfo | null;
 reactions?: { 
    userId: string; 
    reaction: string;  // backend sends "Reaction" - needs mapping
    userName: string; 
    profileImageUrl?: string | null 
  }[];  // Runtime UI state
  _pending?: boolean;
  _failed?: boolean;
  _ctxOpen?: boolean;
  _reactionGroups?: ReactionGroup[];
}

interface GroupedItem {
  type: 'separator' | 'message';
  key: string;
  label?: string;
  msg?: ChatMessage;
}

// ── Helpers ──────────────────────────────────────────────────────────
export function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtSize(b: number | null | undefined): string {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtDur(s: number | null | undefined): string {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function buildReactionGroups(
  msg: ChatMessage, currentUserId: string
): ReactionGroup[] {
  const all = msg.reactions ?? [];
  const emojis = [...new Set(all.map(r => r.reaction))];
  return emojis.map(e => {
    const raw = all.filter(r => r.reaction === e);
    return {
      emoji: e,
      count: raw.length,
      reactors: raw.map(r => ({
        userId: r.userId, userName: r.userName || r.userId,
        profileImageUrl: r.profileImageUrl ?? null
      })),
      myReaction: raw.some(r => String(r.userId) === String(currentUserId))
    };
  });
}

let optimisticIdCounter = 0;
function nextOptimisticId(): string {
  return `optimistic-${Date.now()}-${++optimisticIdCounter}`;
}

// Derive contentType from message fields for backward-compat
function resolveContentType(msg: ChatMessage): number {
  if (msg.contentType !== undefined) return msg.contentType;
  if (msg.isVoice) return CT.Audio;
  if (!msg.attachmentUrl && !msg.attachmentName) return CT.Text;
  const name = (msg.attachmentName ?? '').toLowerCase();
  const url  = (msg.attachmentUrl  ?? '').toLowerCase();
  const ext  = name.split('.').pop() ?? '';
  if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext) ||
      url.includes('/images/')) return CT.Image;
  if (['mp3','wav','ogg','m4a','webm'].includes(ext)) return CT.Audio;
  if (['mp4','mov','avi','mkv'].includes(ext))        return CT.Video;
  return CT.File;
}

// ════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-teacher-private-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TranslocoModule,
    LucideAngularModule,
    NzSpinModule, NzAvatarModule, NzBadgeModule,
    NzEmptyModule, NzInputModule, NzModalModule,
    NzTooltipModule, NzTagModule, NzPopoverModule,
    PickerModule,
  ],
  templateUrl: './teacher-private-chat.html',
  styleUrls:   ['./teacher-private-chat.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'teacherPrivateChat' },
  ],
})
export class TeacherPrivateChat implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('messagesContainer') messagesContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('endRef')            endRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput')         fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput')        imageInputRef!: ElementRef<HTMLInputElement>;

  private http      = inject(HttpClient);
  public  router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private config    = inject(APP_CONFIG);
  private notify    = inject(NzNotificationService);
  private msg       = inject(NzMessageService);
  private transloco = inject(TranslocoService);
  private ngZone    = inject(NgZone);
  private cookie    = inject(Cookie);

  private destroy$ = new Subject<void>();
  private hub: signalR.HubConnection | null = null;

  // ── Icons ──────────────────────────────────────────────────────────
  readonly ArrowLeftIcon    = ArrowLeft;
  readonly SendIcon         = Send;
  readonly MicIcon          = Mic;
  readonly CameraIcon       = Camera;
  readonly PaperclipIcon    = Paperclip;
  readonly XIcon            = X;
  readonly CheckIcon        = Check;
  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly TrashIcon        = Trash2;
  readonly MenuIcon         = Menu;
  readonly ChevronDownIcon  = ChevronDown;
  readonly MessageSquareIcon = MessageSquare;
  readonly SmileIcon        = Smile;
  readonly CheckCheckIcon   = CheckCheck;
  readonly ClockIcon        = Clock;
  readonly XCircleIcon      = XCircle;
  readonly AlertCircleIcon  = AlertCircle;
  readonly DownloadIcon     = Download;
  readonly ImageIcon        = ImageIcon;
  readonly FileTextIcon     = FileText;
  readonly ArchiveIcon      = Archive;
  readonly FileIcon         = FileIcon;
  readonly AudioIcon        = AudioLines;
  readonly CheckCircleIcon  = CheckCircle2;

  // ── Expose to template ─────────────────────────────────────────────
  CT       = CT;
  fmtTime  = fmtTime;
  fmtDur   = fmtDur;
  fmtSize  = fmtSize;

  // ── State ──────────────────────────────────────────────────────────
  loading         = signal(true);
  messagesLoading = signal(false);
  sending         = signal(false);
  siderOpen       = signal(false);
  showVoice       = signal(false);
  isAtBottom      = signal(true);
  errorMessage    = signal<string | null>(null);

  conversations = signal<ChatConversation[]>([]);
  activeConv    = signal<ChatConversation | null>(null);
  messages      = signal<ChatMessage[]>([]);
  unreadCount   = signal(0);

  text                  = signal('');
  replyingTo            = signal<ChatMessage | null>(null);
  previewFile           = signal<File | null>(null);
  previewUrl            = signal<string | null>(null);
  previewCaption        = signal('');
  fileSendPreviewFile   = signal<File | null>(null);
  fileSendPreviewCaption = signal('');
  fileSendPreviewModalVisible = false;

  // Image view modal
  imageViewModalVisible = false;
  imageViewMsg          = signal<ChatMessage | null>(null);

  // Emoji picker
  emojiPickerVisible = signal(false);
  emojiPickerX       = signal(0);
  emojiPickerY       = signal(0);
  emojiPickerMsg     = signal<ChatMessage | null>(null);

  // Voice recorder
  voiceState    = signal<'idle' | 'recording' | 'stopped'>('idle');
  voiceElapsed  = signal(0);
  voiceAudioUrl = signal<string | null>(null);

  private voiceBlob: Blob | null = null;
  private voiceMime = 'audio/webm';
  private mediaRecorder: MediaRecorder | null = null;
  private voiceChunks: Blob[] = [];
  private voiceTimer: ReturnType<typeof setInterval> | null = null;

  // Internal
  private currentUserId   = this.cookie.retrieveCookie('fxSBE5PtmD35dx82BIpDg') ?? '';
  private studentIdParam  = '';
  private hasAutoSelected = false;
  private shouldScrollToBottom = false;
  private scrollListener: (() => void) | null = null;

  // ── Computed ───────────────────────────────────────────────────────
  groupedMessages = computed((): GroupedItem[] => {
    const result: GroupedItem[] = [];
    let lastLabel = '';
    for (const m of this.messages()) {
      const label = getDateLabel(m.createdAt);
      if (label !== lastLabel) {
        result.push({ type: 'separator', key: `sep-${label}`, label });
        lastLabel = label;
      }
      result.push({ type: 'message', key: String(m.id), msg: m });
    }
    return result;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  private _initLoaded = false;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('studentId') ?? params.get('id') ?? '';
      if (id !== this.studentIdParam || !this._initLoaded) {
        this.studentIdParam = id;
        this.hasAutoSelected = false;
        this.activeConv.set(null);
        this.messages.set([]);
        this.fetchConversations();
        this._initLoaded = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.messagesContainerRef) {
      const el = this.messagesContainerRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.hub?.stop();
    if (this.voiceTimer) clearInterval(this.voiceTimer);
    if (this.scrollListener) {
      this.messagesContainerRef?.nativeElement?.removeEventListener('scroll', this.scrollListener);
    }
  }

  // ── Document click — close pickers & ctx menus ─────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.tcp-emoji-floating') || target.closest('.tcp-emoji-trigger')) return;
    if (this.emojiPickerVisible()) this.closeEmojiPicker();
    if (!target.closest('.tcp-ctx-menu') && !target.closest('.tcp-ctx-trigger')) {
      this.messages.update(msgs => msgs.map(m => ({ ...m, _ctxOpen: false })));
    }
  }

  // ── Data ───────────────────────────────────────────────────────────
  async fetchConversations(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/chat/conversations`)
      );
      this.conversations.set(res?.data ?? []);
      this.tryAutoSelect();
    } catch {
      this.notify.error(this.t('error'), this.t('failed_to_load'));
    } finally {
      this.loading.set(false);
    }
  }

  private async tryAutoSelect(): Promise<void> {
    if (!this.studentIdParam || this.hasAutoSelected) return;
    const convs = this.conversations();
    const found = convs.find(c =>
      c.id === this.studentIdParam || c.studentId === this.studentIdParam || c.otherPartyId === this.studentIdParam
    );
    if (found) {
      this.hasAutoSelected = true;
      this.selectConv(found);
      return;
    }
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.config.baseUrl}/api/chat/student/${this.studentIdParam}`)
      );
      const student = res?.data;
      const newConv: ChatConversation = {
        id: '', studentId: this.studentIdParam,
        studentName: student?.name ?? 'Student',
        studentAvatar: student?.avatar,
        teacherId: this.currentUserId, teacherName: 'You', teacherAvatar: '',
        otherPartyId: this.studentIdParam,
        otherPartyName: student?.name ?? 'Student',
        otherPartyAvatar: student?.avatar,
        otherPartyRole: 'student',
        lastMessage: '', lastMessageAt: '', unreadCount: 0,
      };
      this.hasAutoSelected = true;
      this.selectConv(newConv);
    } catch {
      this.hasAutoSelected = true;
      this.selectConv({
        id: '', studentId: this.studentIdParam, studentName: 'Student',
        teacherId: this.currentUserId, teacherName: 'You',
        otherPartyId: this.studentIdParam, otherPartyName: 'Student',
        otherPartyRole: 'student', lastMessage: '', lastMessageAt: '', unreadCount: 0,
      });
    }
  }

  selectConv(conv: ChatConversation): void {
    this.activeConv.set(conv);
    this.messages.set([]);
    this.text.set('');
    this.replyingTo.set(null);
    this.showVoice.set(false);
    this.isAtBottom.set(true);
    this.unreadCount.set(0);
    this.errorMessage.set(null);
    this.siderOpen.set(false);

    if (conv.id) {
      this.messagesLoading.set(true);
      this.connectHub();
    }

    setTimeout(() => this.setupScrollListener(), 100);
  }

  // ── Scroll listener ─────────────────────────────────────────────────
  private setupScrollListener(): void {
    const container = this.messagesContainerRef?.nativeElement;
    if (!container) return;
    if (this.scrollListener) container.removeEventListener('scroll', this.scrollListener);
    this.scrollListener = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < AT_BOTTOM_THRESHOLD;
      this.ngZone.run(() => {
        this.isAtBottom.set(atBottom);
        if (atBottom) this.unreadCount.set(0);
      });
    };
    container.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  // ── SignalR ────────────────────────────────────────────────────────
  private async connectHub(): Promise<void> {
    if (this.hub) { await this.hub.stop(); this.hub = null; }
    const conv = this.activeConv();
    if (!conv?.id) return;

    const token = this.cookie.retrieveCookie('etHy0B87RlH9CXykEzclg') ?? '';
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.config.baseUrl}/hubs/chat`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

      hub.on('AllMessagesLoaded', (payload: { messages?: any[] }) => {
        this.ngZone.run(() => {
          const sorted = [...(payload?.messages ?? [])].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          // Map backend PascalCase to frontend camelCase + keep only last reaction per user
          const mapped = sorted.map(m => {
            const raw = m.reactions?.map((r: any) => ({
              userId: String(r.userId ?? r.UserId),
              reaction: r.reaction ?? r.Reaction,
              userName: r.userName ?? r.UserName,
              profileImageUrl: r.profileImageUrl ?? r.ProfileImageUrl ?? r.userImageUrl
            })) ?? [];
            // Replace old with new: keep only the last reaction per user
            const deduped = Array.from(new Map(raw.map((r:any) => [r.userId, r])).values());
            // Map replyTo from backend (supports both PascalCase and camelCase)
            const rt = m.replyTo ?? m.ReplyTo ?? (m as any).ReplyTo ?? (m as any).replyTo;
            const replyTo = rt ? {
              id: rt.id ?? rt.Id,
              senderName: rt.senderName ?? rt.SenderName,
              content: rt.content ?? rt.Content ?? rt.message ?? rt.Message ?? undefined
            } : null;
            return { ...m, reactions: deduped, replyTo };
          });
          this.messages.set(mapped.map(m => this.enrichMessage(m as ChatMessage)));
          this.messagesLoading.set(false);
          this.shouldScrollToBottom = true;
          setTimeout(() => this.setupScrollListener(), 150);
        });
      });

    hub.on('NewMessage', (msg: ChatMessage) => {
      this.ngZone.run(() => {
        const current = this.activeConv();
        if (!current) return;

        // Assign conv id to placeholder
        if (!current.id && msg.conversationId) {
          this.activeConv.set({ ...current, id: msg.conversationId });
        }

        // Remove matching optimistic message & preserve replyTo if backend didn't send it
        let preservedReplyTo: ReplyInfo | null | undefined = undefined;
        const optimisticIdx = this.messages().findIndex(m => {
          if (!m._pending || !this.isOwn(m)) return false;
          const mc = resolveContentType(m);
          const rc = resolveContentType(msg);
          if (mc !== rc) return false;
          if (rc === CT.Text) return m.message === msg.message;
          return m.attachmentName === msg.attachmentName || (!m.attachmentName && !msg.attachmentName);
        });
        if (optimisticIdx !== -1) {
          const optimisticMsg = this.messages()[optimisticIdx];
          // If backend didn't include replyTo but optimistic had one, preserve it
          if (!msg.replyTo && !(msg as any).ReplyTo && !(msg as any).replyTo && optimisticMsg.replyTo) {
            preservedReplyTo = optimisticMsg.replyTo;
          }
          this.messages.update(msgs => [
            ...msgs.slice(0, optimisticIdx),
            ...msgs.slice(optimisticIdx + 1)
          ]);
        }

        // Map replyTo from backend PascalCase if present
        if (!msg.replyTo && (msg as any).ReplyTo) {
          const rt = (msg as any).ReplyTo;
          msg.replyTo = {
            id: rt.Id ?? rt.id,
            senderName: rt.SenderName ?? rt.senderName,
            content: rt.Content ?? rt.content ?? undefined
          };
        }
        // Also check for nested replyTo object with different casing
        if (!msg.replyTo && (msg as any).replyTo) {
          const rt = (msg as any).replyTo;
          msg.replyTo = {
            id: rt.id ?? rt.Id,
            senderName: rt.senderName ?? rt.SenderName,
            content: rt.content ?? rt.Content ?? undefined
          };
        }
        // Apply preserved replyTo if backend didn't send it
        if (preservedReplyTo && !msg.replyTo && !(msg as any).ReplyTo && !(msg as any).replyTo) {
          msg.replyTo = preservedReplyTo;
        }
        const enriched = this.enrichMessage(msg);
        this.messages.update(msgs => [...msgs, enriched]);
        if (this.isAtBottom()) {
          this.shouldScrollToBottom = true;
          this.unreadCount.set(0);
        } else {
          this.unreadCount.update(n => n + 1);
        }

        // Update conversation list
        this.conversations.update(convs => {
          const exists = convs.some(c => c.id === msg.conversationId);
          const lastMsg = msg.message ?? (resolveContentType(msg) === CT.Audio ? '🎤 Voice message' : '📎 Attachment');
          if (!exists && msg.conversationId) {
            const nc: ChatConversation = {
              id: msg.conversationId,
              studentId:    msg.senderRole === 'student' ? msg.senderId : msg.receiverId,
              studentName:  msg.senderRole === 'student' ? msg.senderName : msg.receiverName,
              teacherId:    msg.senderRole === 'teacher' ? msg.senderId : msg.receiverId,
              teacherName:  msg.senderRole === 'teacher' ? msg.senderName : msg.receiverName,
              otherPartyId:   this.activeConv()?.otherPartyId ?? msg.senderId,
              otherPartyName: this.activeConv()?.otherPartyName ?? msg.senderName,
              otherPartyAvatar: msg.senderAvatar,
              otherPartyRole: msg.senderRole,
              lastMessage: lastMsg, lastMessageAt: msg.createdAt, unreadCount: 0,
            };
            return [nc, ...convs];
          }
          return convs.map(c => c.id === msg.conversationId
            ? { ...c, lastMessage: lastMsg, lastMessageAt: msg.createdAt }
            : c
          );
        });
      });
    });

    hub.on('MessageDeleted', ({ messageId }: { messageId: string }) => {
      this.ngZone.run(() => {
        this.messages.update(msgs => msgs.map(m =>
          m.id === messageId ? { ...m, isDeleted: true, message: undefined, attachmentUrl: undefined } : m
        ));
      });
    });

    hub.on('MessageReacted', ({ messageId, userId, reaction, userName, userImageUrl }: any) => {
      this.ngZone.run(() => {
        this.messages.update(msgs => msgs.map(m => {
          if (m.id !== messageId) return m;
          // Remove any existing reaction by this user first
          const filtered = (m.reactions ?? []).filter(r => String(r.userId) !== String(userId));
          // Add the new reaction
          filtered.push({ userId, reaction, userName: userName || String(userId), profileImageUrl: userImageUrl ?? null });
          return this.enrichMessage({ ...m, reactions: filtered });
        }));
      });
    });

    hub.on('ReactionRemoved', ({ messageId, userId, reaction }: any) => {
      this.ngZone.run(() => {
        this.messages.update(msgs => msgs.map(m => {
          if (m.id !== messageId) return m;
          return this.enrichMessage({
            ...m,
            reactions: (m.reactions ?? []).filter(r => !(String(r.userId) === String(userId) && r.reaction === reaction))
          });
        }));
      });
    });

    hub.on('ConversationUpdate', (payload: any) => {
      this.ngZone.run(() => {
        this.conversations.update(convs => convs.map(c => {
          if (c.id !== payload.conversationId) return c;
          return {
            ...c,
            lastMessage: payload.lastMessage,
            lastMessageAt: payload.lastMessageAt,
            unreadCount: payload.zeroUnread ? 0 : Math.max(0, c.unreadCount + (payload.unreadDelta ?? 0)),
          };
        }));
      });
    });

    hub.on('Error', (err: string) => {
      this.ngZone.run(() => {
        this.errorMessage.set(err ?? 'An error occurred');
        this.messages.update(msgs => msgs.map(m =>
          m._pending ? { ...m, _pending: false, _failed: true } : m
        ));
      });
    });

    try {
      await hub.start();
      this.hub = hub;
      await hub.invoke('JoinConversation', this.activeConv()!.id);
    } catch {
      this.notify.error(this.t('error'), this.t('connection_failed'));
      this.messagesLoading.set(false);
    }
  }

  // ── Message helpers ────────────────────────────────────────────────
  enrichMessage(m: ChatMessage): ChatMessage {
    // Ensure reactions array exists
    const reactions = m.reactions ?? [];
    // Ensure replyTo is properly structured
    let replyTo = m.replyTo;
    if ((m as any).ReplyTo && !replyTo) {
      const rt = (m as any).ReplyTo;
      replyTo = {
        id: rt.Id ?? rt.id,
        senderName: rt.SenderName ?? rt.senderName,
        content: rt.Content ?? rt.content ?? rt.Message ?? rt.message ?? undefined
      };
    }
    return {
      ...m,
      replyTo,
      contentType: resolveContentType(m),
      _reactionGroups: buildReactionGroups({ ...m, reactions }, this.currentUserId),
      _ctxOpen: false,
    };
  }

  isOwn(msg: ChatMessage): boolean {
    return String(msg.senderId) === String(this.currentUserId);
  }

  isSameUser(userId: string | number): boolean {
    return String(userId) === String(this.currentUserId);
  }

  // ── Optimistic helpers ─────────────────────────────────────────────
  private addOptimisticMessage(
    text: string | null,
    contentType: number,
    replyTo?: ChatMessage | null,
    attachmentName?: string | null,
    attachmentUrl?: string | null
  ): string {
    const tempId = nextOptimisticId();
    const m: ChatMessage = {
      id: tempId,
      conversationId: this.activeConv()?.id ?? '',
      senderId: this.currentUserId,
      senderName: 'You',
      senderRole: 'teacher',
      receiverId: this.activeConv()?.otherPartyId ?? '',
      receiverName: this.activeConv()?.otherPartyName ?? '',
      message: text ?? undefined,
      attachmentUrl: attachmentUrl ?? undefined,
      attachmentName: attachmentName ?? undefined,
      contentType,
      isRead: false,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      replyTo: replyTo
        ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.message }
        : null,
      reactions: [],
      _pending: true,
      _failed: false,
      _ctxOpen: false,
      _reactionGroups: [],
    };
    this.messages.update(msgs => [...msgs, m]);
    if (this.isAtBottom()) {
      this.shouldScrollToBottom = true;
    }
    return tempId;
  }

  private markOptimisticFailed(tempId: string): void {
    this.messages.update(msgs => msgs.map(m =>
      m.id === tempId ? { ...m, _pending: false, _failed: true } : m
    ));
  }

  // ── Send text ──────────────────────────────────────────────────────
  async sendText(): Promise<void> {
    const content = this.text().trim();
    if (!content || !this.activeConv()) return;
    this.sending.set(true);

    const replyTo = this.replyingTo();
    const tempId  = this.addOptimisticMessage(content, CT.Text, replyTo);
    this.text.set('');
    this.replyingTo.set(null);
    this.errorMessage.set(null);

    try {
      await this.hubSend(null, null, null, false, content, replyTo?.id ?? null);
      // Ensure replyTo is cleared after successful send
      this.replyingTo.set(null);
      if (!this.activeConv()?.id) await this.fetchConversations();
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage.set(err?.message ?? this.t('failed_to_send'));
    } finally {
      this.sending.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendText();
    }
  }

  async retryMessage(msg: ChatMessage): Promise<void> {
    if (!msg._failed || !this.activeConv()) return;
    this.messages.update(msgs => msgs.map(m =>
      m.id === msg.id ? { ...m, _pending: true, _failed: false } : m
    ));
    this.errorMessage.set(null);
    try {
      await this.hubSend(null, null, null, false, msg.message ?? null, msg.replyTo?.id ?? null);
    } catch (err: any) {
      this.markOptimisticFailed(String(msg.id));
      this.errorMessage.set(err?.message ?? this.t('failed_to_send'));
    }
  }

  private async hubSend(
    fileBase64?: string | null,
    fileName?: string | null,
    fileMimeType?: string | null,
    isVoice = false,
    textOverride?: string | null,
    replyToId?: string | null,
  ): Promise<void> {
    const conv = this.activeConv();
    if (!conv?.otherPartyId) throw new Error('Receiver not found');

    if (this.hub) {
      await this.hub.invoke(
        'SendMessage',
        conv.otherPartyId,
        conv.otherPartyRole,
        textOverride !== undefined ? textOverride : this.text().trim() || null,
        fileBase64 ?? null,
        fileName   ?? null,
        fileMimeType ?? null,
        isVoice,
        replyToId ?? null,
      );
    } else {
      const formData = new FormData();
      formData.append('ReceiverId',   conv.otherPartyId);
      formData.append('ReceiverRole', conv.otherPartyRole);
      const t = textOverride !== undefined ? textOverride : this.text().trim();
      if (t) formData.append('Message', t);
      if (fileBase64) {
        const blob = await (await fetch(fileBase64)).blob();
        formData.append('Attachment', blob, fileName ?? 'file');
      }
      await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/chat/messages`, formData)
      );
    }
  }

  // ── Delete / React / Reply ─────────────────────────────────────────
  async deleteMessage(msg: ChatMessage): Promise<void> {
    const conv = this.activeConv();
    if (!conv?.id || !this.hub) return;
    try {
      await this.hub.invoke('DeleteMessage', conv.id, msg.id);
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? this.t('failed'));
    }
  }

  async reactToMessage(msg: ChatMessage, emoji: string): Promise<void> {
    if (!this.hub || !this.activeConv()?.id) return;
    try {
      await this.hub.invoke('ReactToMessage', this.activeConv()!.id, msg.id, emoji);
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? this.t('failed'));
    }
  }

  async removeReaction(msg: ChatMessage, emoji: string): Promise<void> {
    if (!this.hub || !this.activeConv()?.id) return;
    try {
      await this.hub.invoke('RemoveReaction', this.activeConv()!.id, msg.id, emoji);
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? this.t('failed'));
    }
  }

  startReply(msg: ChatMessage): void {
    this.replyingTo.set(msg);
    this.closeCtx();
  }

  cancelReply(): void { this.replyingTo.set(null); }

  // ── File handling ──────────────────────────────────────────────────
  triggerImagePicker(): void { this.imageInputRef?.nativeElement.click(); }
  triggerFilePicker(): void  { this.fileInputRef?.nativeElement.click();  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    const allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','image/bmp','image/svg+xml'];
    if (!allowed.includes(file.type)) { this.msg.error(this.t('invalid_image_type')); return; }
    if (!this.validateSize(file, MAX_IMAGE_SIZE)) return;
    this.previewFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.previewCaption.set('');
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    if (!this.validateFileType(file)) return;
    if (!this.validateSize(file)) return;
    this.fileSendPreviewFile.set(file);
    this.fileSendPreviewCaption.set('');
    this.fileSendPreviewModalVisible = true;
  }

  private validateSize(file: File, max = MAX_FILE_SIZE): boolean {
    if (file.size > max) {
      const label = max === MAX_IMAGE_SIZE ? '10 MB' : '500 MB';
      this.msg.error(`File too large. Max ${label}.`);
      return false;
    }
    return true;
  }

  private validateFileType(file: File): boolean {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      this.msg.error(this.t('invalid_file_type'));
      return false;
    }
    return true;
  }

  cancelPreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewFile.set(null);
    this.previewUrl.set(null);
    this.previewCaption.set('');
  }

  async sendPreviewImage(): Promise<void> {
    const file    = this.previewFile();
    const caption = this.previewCaption();
    if (!file || !this.activeConv()) return;
    this.sending.set(true);

    const replyTo  = this.replyingTo();
    const localUrl = this.previewUrl() ?? '';
    const tempId   = this.addOptimisticMessage(caption || null, CT.Image, replyTo, file.name, localUrl);
    this.replyingTo.set(null);
    this.cancelPreview();

    try {
      const b64 = await toBase64(file);
      await this.hubSend(b64, file.name, file.type, false, caption || null, replyTo?.id ?? null);
      if (!this.activeConv()?.id) await this.fetchConversations();
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage.set(err?.message ?? this.t('failed_to_send'));
    } finally {
      this.sending.set(false);
    }
  }

  cancelFilePreview(): void {
    this.fileSendPreviewFile.set(null);
    this.fileSendPreviewCaption.set('');
    this.fileSendPreviewModalVisible = false;
  }

  async sendFilePreview(): Promise<void> {
    const file    = this.fileSendPreviewFile();
    const caption = this.fileSendPreviewCaption();
    if (!file || !this.activeConv()) return;
    this.sending.set(true);

    const replyTo = this.replyingTo();
    const tempId  = this.addOptimisticMessage(caption || null, CT.File, replyTo, file.name, null);
    this.replyingTo.set(null);
    this.cancelFilePreview();

    try {
      const b64 = await toBase64(file);
      await this.hubSend(b64, file.name, file.type, false, caption || null, replyTo?.id ?? null);
      if (!this.activeConv()?.id) await this.fetchConversations();
    } catch (err: any) {
      this.markOptimisticFailed(tempId);
      this.errorMessage.set(err?.message ?? this.t('failed_to_send'));
    } finally {
      this.sending.set(false);
    }
  }

  downloadFile(msg: ChatMessage): void {
    if (!msg.attachmentUrl) return;
    const link = document.createElement('a');
    link.href     = this.buildUrl(msg.attachmentUrl);
    link.download = msg.attachmentName || 'download';
    link.target   = '_blank';
    link.rel      = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Voice recorder ─────────────────────────────────────────────────
  async startVoiceRecorder(): Promise<void> {
    this.showVoice.set(true);
    this.voiceState.set('idle');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];
      const mime = preferred.find(x => MediaRecorder.isTypeSupported(x)) ?? 'audio/webm';
      this.voiceMime = mime;
      this.voiceChunks = [];

      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = e => { if (e.data.size > 0) this.voiceChunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(this.voiceChunks, { type: mime });
        this.voiceBlob = blob;
        this.voiceAudioUrl.set(URL.createObjectURL(blob));
        this.voiceState.set('stopped');
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start(100);
      this.mediaRecorder = rec;
      this.voiceState.set('recording');
      this.voiceElapsed.set(0);
      this.voiceTimer = setInterval(() => this.voiceElapsed.update(n => n + 1), 1000);
    } catch {
      this.msg.error(this.t('mic_denied'));
      this.showVoice.set(false);
    }
  }

  stopRecording(): void {
    if (this.voiceTimer) { clearInterval(this.voiceTimer); this.voiceTimer = null; }
    this.mediaRecorder?.stop();
  }

  async sendVoice(): Promise<void> {
    if (!this.voiceBlob) return;
    this.sending.set(true);

    const ext  = this.voiceMime.includes('ogg') ? '.ogg' : this.voiceMime.includes('mp4') ? '.mp4' : '.webm';
    const name = `voice${ext}`;
    const dur  = this.voiceElapsed();
    const mime = this.voiceMime;
    const blob = this.voiceBlob;

    const tempId = this.addOptimisticMessage(null, CT.Audio, null, name, null);
    this.showVoice.set(false);
    this.voiceState.set('idle');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await this.hubSend(reader.result as string, name, mime, true, null, null);
        if (!this.activeConv()?.id) await this.fetchConversations();
      } catch (err: any) {
        this.markOptimisticFailed(tempId);
        this.errorMessage.set(err?.message ?? this.t('failed_to_send'));
      } finally {
        this.sending.set(false);
      }
    };
    reader.onerror = () => {
      this.markOptimisticFailed(tempId);
      this.sending.set(false);
    };
    reader.readAsDataURL(new File([blob], name, { type: mime }));
    this.cancelVoice();
  }

  cancelVoice(): void {
    if (this.voiceTimer) { clearInterval(this.voiceTimer); this.voiceTimer = null; }
    this.mediaRecorder?.stream?.getTracks().forEach(t => t.stop());
    this.mediaRecorder = null;
    const url = this.voiceAudioUrl();
    if (url) URL.revokeObjectURL(url);
    this.voiceAudioUrl.set(null);
    this.voiceBlob = null;
    this.voiceState.set('idle');
    this.voiceElapsed.set(0);
    this.showVoice.set(false);
  }

  // ── Image view modal ────────────────────────────────────────────────
  openImagePreview(msg: ChatMessage): void {
    this.imageViewMsg.set(msg);
    this.imageViewModalVisible = true;
  }

  closeImageView(): void {
    this.imageViewModalVisible = false;
    this.imageViewMsg.set(null);
  }

  // ── Emoji picker ────────────────────────────────────────────────────
  toggleEmojiPicker(msg: ChatMessage, event?: MouseEvent): void {
    if (this.emojiPickerVisible() && this.emojiPickerMsg()?.id === msg.id) {
      this.closeEmojiPicker();
      return;
    }
    this.closeEmojiPicker();

    let x = 0, y = 0;
    if (event) { x = event.clientX; y = event.clientY; }

    const pw = 280, ph = 350, pad = 16;
    const vw = window.innerWidth, vh = window.innerHeight;
    let fx = x + 10, fy = y - 20;
    if (fx + pw + pad > vw) fx = x - pw - 10;
    if (fy + ph + pad > vh) fy = Math.max(pad, vh - ph - pad);
    if (fy < pad) fy = pad;

    this.emojiPickerMsg.set(msg);
    this.emojiPickerX.set(fx);
    this.emojiPickerY.set(fy);
    this.emojiPickerVisible.set(true);
  }

  closeEmojiPicker(): void {
    this.emojiPickerVisible.set(false);
    this.emojiPickerMsg.set(null);
  }

  onEmojiSelect(event: any): void {
    const msg   = this.emojiPickerMsg();
    const emoji = event?.emoji?.native ?? event?.native;
    if (msg && emoji) this.reactToMessage(msg, emoji);
    this.closeEmojiPicker();
  }

  // ── Context menu ────────────────────────────────────────────────────
  toggleCtx(msg: ChatMessage): void {
    const wasOpen = msg._ctxOpen;
    this.messages.update(msgs => msgs.map(m => ({ ...m, _ctxOpen: false })));
    if (!wasOpen) {
      this.messages.update(msgs => msgs.map(m => m.id === msg.id ? { ...m, _ctxOpen: true } : m));
    }
  }

  closeCtx(): void {
    this.messages.update(msgs => msgs.map(m => ({ ...m, _ctxOpen: false })));
  }

  // ── Scroll ─────────────────────────────────────────────────────────
  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const el = this.messagesContainerRef?.nativeElement;
    if (!el) return;
    behavior === 'auto'
      ? (el.scrollTop = el.scrollHeight)
      : el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  onScroll(): void {
    const el = this.messagesContainerRef?.nativeElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD;
    this.isAtBottom.set(atBottom);
    if (atBottom) this.unreadCount.set(0);
  }

  scrollFabClick(): void {
    this.scrollToBottom('smooth');
    this.unreadCount.set(0);
  }

  // ── File type helpers ──────────────────────────────────────────────
  private getFileIconInfo(fileName?: string | null, mimeType?: string | null): {
    icon: any; color: string; bg: string;
  } {
    const ext  = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
    const mime = (mimeType ?? '').toLowerCase();
    if (mime === 'application/pdf' || ext === 'pdf')
      return { icon: this.FileTextIcon, color: '#dc2626', bg: '#fff0f0' };
    if (['doc','docx'].includes(ext) || mime.includes('word'))
      return { icon: this.FileTextIcon, color: '#2563eb', bg: '#eff6ff' };
    if (['xls','xlsx'].includes(ext) || mime.includes('excel'))
      return { icon: this.FileTextIcon, color: '#16a34a', bg: '#f0fdf4' };
    if (['ppt','pptx'].includes(ext) || mime.includes('powerpoint'))
      return { icon: this.FileTextIcon, color: '#ea580c', bg: '#fff7ed' };
    if (['zip','rar','7z','tar','gz'].includes(ext))
      return { icon: this.ArchiveIcon, color: '#92400e', bg: '#fffbeb' };
    if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext))
      return { icon: this.ImageIcon, color: '#7c3aed', bg: '#f5f3ff' };
    if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a','webm'].includes(ext))
      return { icon: this.AudioIcon, color: '#0891b2', bg: '#ecfeff' };
    return { icon: this.FileIcon, color: '#475569', bg: '#f1f5f9' };
  }

  getFilePreviewIcon(msg: ChatMessage): any {
    return this.getFileIconInfo(msg.attachmentName).icon;
  }

  getFilePreviewColor(msg: ChatMessage): { bg: string; color: string } {
    const i = this.getFileIconInfo(msg.attachmentName);
    return { bg: i.bg, color: i.color };
  }

  getFilePreviewIconForFile(file: File): any {
    return this.getFileIconInfo(file.name, file.type).icon;
  }

  getFilePreviewColorForFile(file: File): { bg: string; color: string } {
    const i = this.getFileIconInfo(file.name, file.type);
    return { bg: i.bg, color: i.color };
  }

  getFileTypeBadge(msg: ChatMessage): { label: string; color: string; bg: string; icon?: any } | null {
    const ct = resolveContentType(msg);
    if (ct === CT.Image || ct === CT.Audio || ct === CT.Video || ct === CT.Text) return null;
    if (!msg.attachmentName) return null;
    const i = this.getFileIconInfo(msg.attachmentName);
    const ext = (msg.attachmentName.split('.').pop() ?? 'file').toUpperCase();
    const labels: Record<string, string> = {
      '#dc2626': 'PDF', '#2563eb': 'Word', '#16a34a': 'Excel',
      '#ea580c': 'PPT', '#92400e': 'Archive'
    };
    return { label: labels[i.color] ?? ext, color: i.color, bg: i.bg, icon: i.icon };
  }

  getFileExt(fileName?: string | null): string {
    if (!fileName) return 'FILE';
    return (fileName.split('.').pop() ?? 'file').toUpperCase();
  }

  // ── Misc helpers ───────────────────────────────────────────────────
  avatarLetter(name: string): string { return (name ?? '?').charAt(0).toUpperCase(); }

  buildUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    return `${this.config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
      .replace(/([^:])\/\/+/g, '$1/');
  }

  t(key: string): string {
    const k = `teacherPrivateChat.${key}`;
    const v = this.transloco.translate(k);
    return (v && v !== k) ? v : key;
  }
}