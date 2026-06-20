// core/services/teacher-profile.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app.config';

export interface AdminProfileData {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  bio?: string;
  specialization?: string;
  yearsOfExperience: number;
  profilePictureUrl?: string;
  teachingSubjects?: string;
  teachingLevel?: string;
  isVerified: boolean;
  verificationStatus: number;
  headline?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminProfile {
  private http   = inject(HttpClient);
  private config = inject(APP_CONFIG);             // ← global base URL

  // State signals
  private profileSignal    = signal<AdminProfileData | null>(null);
  private isVerifiedSignal = signal<boolean>(false);
  private loadingSignal    = signal<boolean>(false);
  private errorSignal      = signal<string | null>(null);

  // Public readonly signals
  readonly profile    = this.profileSignal.asReadonly();
  readonly isVerified = this.isVerifiedSignal.asReadonly();
  readonly loading    = this.loadingSignal.asReadonly();
  readonly error      = this.errorSignal.asReadonly();

  async fetchProfile(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: AdminProfileData }>(
          `${this.config.baseUrl}/api/Admin/profile`
        )
      );
      if (res.success && res.data) {
        this.profileSignal.set(res.data);
        this.isVerifiedSignal.set(res.data.isVerified || false);
      } else {
        console.error('Failed to fetch teacher profile');
      }
    } catch (error) {
      console.error('Error fetching teacher profile:', error);
      this.errorSignal.set('Failed to load profile');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  clearProfile(): void {
    this.profileSignal.set(null);
    this.isVerifiedSignal.set(false);
    this.errorSignal.set(null);
  }
}