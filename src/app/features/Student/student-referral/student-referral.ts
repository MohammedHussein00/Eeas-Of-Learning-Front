// features/Student/student-referral/student-referral.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Gift, Copy, Users, Wallet, Check } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { Toast } from '../../../core/services/toast';

interface ReferralStats {
  code: string;
  shareLink: string;
  friendsInvited: number;
  totalEarned: number;
}

@Component({
  selector: 'app-student-referral',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-referral.html',
  styleUrls: ['./student-referral.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentReferral' }],
})
export class StudentReferral implements OnInit {
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);
  private toast  = inject(Toast);

  readonly GiftIcon   = Gift;
  readonly CopyIcon   = Copy;
  readonly UsersIcon  = Users;
  readonly WalletIcon = Wallet;
  readonly CheckIcon  = Check;

  loading = signal(true);
  stats   = signal<ReferralStats | null>(null);
  copied  = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success?: boolean; data?: ReferralStats } & ReferralStats>(
          `${this.config.baseUrl}/api/referral/my-stats`
        )
      );
      // endpoint may return either wrapped or bare
      const data = (res as any).data ?? res;
      this.stats.set(data ?? null);
    } catch {
      this.stats.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  copyCode(): void {
    const code = this.stats()?.code;
    if (!code) return;
    navigator.clipboard?.writeText(this.stats()?.shareLink || code).then(() => {
      this.copied.set(true);
      this.toast.success('Copied to clipboard');
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
