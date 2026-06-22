// features/Student/student-chat/student-chat.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Send, MessageCircle, ArrowLeft } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Auth } from '../../../core/services/auth';

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserImage?: string;
  lastMessage?: string;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  message: string;
  createdAt?: string;
  attachmentUrl?: string;
}

@Component({
  selector: 'app-student-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-chat.html',
  styleUrls: ['./student-chat.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentChat' }],
})
export class StudentChat implements OnInit {
  private route  = inject(ActivatedRoute);
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);
  private auth   = inject(Auth);

  readonly SendIcon = Send;
  readonly MsgIcon  = MessageCircle;
  readonly BackIcon = ArrowLeft;

  myId = this.auth.getUserId() ?? '';

  loading        = signal(true);
  conversations  = signal<Conversation[]>([]);
  active         = signal<Conversation | null>(null);
  messages       = signal<ChatMessage[]>([]);
  messagesLoading = signal(false);
  draft          = signal('');
  mobileShowChat = signal(false);

  ngOnInit(): void {
    this.loadConversations();
  }

  private async loadConversations(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: Conversation[] }>(
          `${this.config.baseUrl}/api/chat/conversations?page=1&pageSize=30`
        )
      );
      const list = res.success && res.data ? res.data : [];
      this.conversations.set(list);

      const paramId = this.route.snapshot.paramMap.get('conversationId');
      const target = paramId ? list.find(c => c.id === paramId) : list[0];
      if (target) this.openConversation(target);
    } catch {
      this.conversations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async openConversation(conv: Conversation): Promise<void> {
    this.active.set(conv);
    this.mobileShowChat.set(true);
    this.messagesLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: ChatMessage[] }>(
          `${this.config.baseUrl}/api/chat/conversations/${conv.id}/messages?page=1&pageSize=50`
        )
      );
      this.messages.set(res.success && res.data ? res.data : []);
      this.http.post(`${this.config.baseUrl}/api/chat/conversations/${conv.id}/mark-read`, {}).subscribe({ error: () => {} });
    } catch {
      this.messages.set([]);
    } finally {
      this.messagesLoading.set(false);
    }
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    const conv = this.active();
    if (!text || !conv) return;
    this.draft.set('');

    const form = new FormData();
    form.append('ReceiverId', conv.otherUserId);
    form.append('ReceiverRole', 'Teacher');
    form.append('Message', text);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: ChatMessage }>(
          `${this.config.baseUrl}/api/chat/messages`, form
        )
      );
      if (res.success && res.data) {
        this.messages.update(list => [...list, res.data]);
      }
    } catch { /* ignore — message bar stays for retry */ }
  }

  isMine(msg: ChatMessage): boolean {
    return msg.senderId === this.myId;
  }

  resolveImage(path: string | undefined, name: string): string {
    if (!path) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d5af1&color=fff&bold=true`;
    if (path.startsWith('http')) return path;
    return `${this.config.baseUrl}${path}`;
  }

  backToList(): void { this.mobileShowChat.set(false); }
}
