// features/Student/student-subscription/student-subscription.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { LucideAngularModule, Check, Crown, Sparkles } from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

interface PlanFeature { id?: string; name: string; included?: boolean; }
interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingPeriod?: string;
  features?: PlanFeature[];
  isDefault?: boolean;
}
interface CurrentSubscription {
  planId: string;
  planName: string;
  status?: string;
  endDate?: string;
}

@Component({
  selector: 'app-student-subscription',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-subscription.html',
  styleUrls: ['./student-subscription.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentSubscription' }],
})
export class StudentSubscription implements OnInit {
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);

  readonly CheckIcon    = Check;
  readonly CrownIcon    = Crown;
  readonly SparklesIcon = Sparkles;

  loading = signal(true);
  plans   = signal<SubscriptionPlan[]>([]);
  current = signal<CurrentSubscription | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const [plansRes, currentRes] = await Promise.allSettled([
      firstValueFrom(this.http.get<{ success: boolean; data: SubscriptionPlan[] }>(
        `${this.config.baseUrl}/api/subscriptionplans/student`)),
      firstValueFrom(this.http.get<{ success: boolean; data: CurrentSubscription }>(
        `${this.config.baseUrl}/api/usersubscription/current`)),
    ]);

    if (plansRes.status === 'fulfilled' && plansRes.value.success) {
      this.plans.set(plansRes.value.data ?? []);
    }
    if (currentRes.status === 'fulfilled' && currentRes.value.success) {
      this.current.set(currentRes.value.data ?? null);
    }
    this.loading.set(false);
  }

  isCurrent(plan: SubscriptionPlan): boolean {
    return this.current()?.planId === plan.id;
  }
}
