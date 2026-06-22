// features/Student/student-profile/student-profile.ts
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  LucideAngularModule,
  User,
  Lock,
  Camera,
  Save,
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';
import { StudentProfile as StudentProfileService } from '../../../core/services/student-profile';
import { Toast } from '../../../core/services/toast';

type Tab = 'profile' | 'password';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule, LucideAngularModule, NzSpinModule],
  templateUrl: './student-profile.html',
  styleUrls: ['./student-profile.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'studentProfile' }],
})
export class StudentProfile implements OnInit {
  private fb        = inject(FormBuilder);
  private http      = inject(HttpClient);
  private config    = inject(APP_CONFIG);
  private service   = inject(StudentProfileService);
  private toast     = inject(Toast);
  private transloco = inject(TranslocoService);

  readonly UserIcon   = User;
  readonly LockIcon   = Lock;
  readonly CameraIcon = Camera;
  readonly SaveIcon   = Save;

  tab        = signal<Tab>('profile');
  loading    = signal(true);
  saving     = signal(false);
  avatarUrl  = signal<string>('');

  profileForm = this.fb.group({
    name: ['', [Validators.required]],
    phoneNumber: [''],
    bio: [''],
  });

  passwordForm = this.fb.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    await this.service.fetchProfile();
    const p = this.service.profile();
    if (p) {
      this.profileForm.patchValue({
        name: p.name,
        phoneNumber: p.phoneNumber ?? '',
        bio: p.bio ?? '',
      });
      this.avatarUrl.set(this.resolveImage(p.profileImagePath));
    }
    this.loading.set(false);
  }

  private resolveImage(path?: string): string {
    if (!path) {
      const name = this.service.profile()?.name ?? 'Student';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d5af1&color=fff&bold=true`;
    }
    if (path.startsWith('http')) return path;
    return `${this.config.baseUrl}${path}`;
  }

  setTab(t: Tab): void { this.tab.set(t); }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.http.put<{ success: boolean; data: any }>(
          `${this.config.baseUrl}/api/student/profile`,
          this.profileForm.value
        )
      );
      if (res.success) {
        if (res.data) this.service.setProfile(res.data);
        this.toast.success(this.transloco.translate('studentProfile.savedProfile'));
      }
    } catch {
      this.toast.error(this.transloco.translate('studentProfile.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          `${this.config.baseUrl}/api/student/change-password`,
          this.passwordForm.value
        )
      );
      if (res.success) {
        this.passwordForm.reset();
        this.toast.success(this.transloco.translate('studentProfile.passwordChanged'));
      }
    } catch {
      this.toast.error(this.transloco.translate('studentProfile.passwordError'));
    } finally {
      this.saving.set(false);
    }
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: { path?: string; url?: string } }>(
          `${this.config.baseUrl}/api/student/profile-image`,
          form
        )
      );
      if (res.success) {
        this.avatarUrl.set(this.resolveImage(res.data?.path ?? res.data?.url));
        this.toast.success(this.transloco.translate('studentProfile.imageUpdated'));
        this.service.fetchProfile();
      }
    } catch {
      this.toast.error(this.transloco.translate('studentProfile.imageError'));
    } finally {
      this.saving.set(false);
    }
  }
}
