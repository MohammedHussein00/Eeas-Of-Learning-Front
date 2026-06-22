// features/Student/student-leaderboard/student-leaderboard.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Trophy, Flame } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalXp: number;
  rank: number;
  profileImagePath?: string;
}

interface MyRank {
  totalXp: number;
  allTimeRank: number;
  weeklyXp: number;
  weeklyRank: number;
}

type Period = 'alltime' | 'weekly';

@Component({
  selector: 'app-student-leaderboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-leaderboard.html',
  styleUrls: ['./student-leaderboard.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentLeaderboard' }],
})
export class StudentLeaderboard implements OnInit {
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);

  readonly TrophyIcon = Trophy;
  readonly FlameIcon  = Flame;

  loading = signal(true);
  period  = signal<Period>('alltime');
  entries = signal<LeaderboardEntry[]>([]);
  myRank  = signal<MyRank | null>(null);

  ngOnInit(): void {
    this.load();
  }

  setPeriod(p: Period): void {
    if (this.period() === p) return;
    this.period.set(p);
    this.loadEntries();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.loadEntries(), this.loadMyRank()]);
    this.loading.set(false);
  }

  private async loadEntries(): Promise<void> {
    const url = this.period() === 'weekly'
      ? `${this.config.baseUrl}/api/xp/leaderboard/weekly/paginated?page=1&pageSize=50`
      : `${this.config.baseUrl}/api/xp/leaderboard/alltime/paginated?page=1&pageSize=50`;
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: LeaderboardEntry[] }>(url)
      );
      this.entries.set(res.success && res.data ? res.data : []);
    } catch {
      this.entries.set([]);
    }
  }

  private async loadMyRank(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: MyRank }>(`${this.config.baseUrl}/api/xp/me`)
      );
      if (res.success) this.myRank.set(res.data);
    } catch { /* ignore */ }
  }

  resolveImage(path: string | undefined, name: string): string {
    if (!path) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d5af1&color=fff&bold=true`;
    if (path.startsWith('http')) return path;
    return `${this.config.baseUrl}${path}`;
  }

  medalClass(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }
}
