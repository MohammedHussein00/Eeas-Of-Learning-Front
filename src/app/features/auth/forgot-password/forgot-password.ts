// features/auth/forgot-password/forgot-password.ts
import {
  Component, inject, signal, computed,
  ViewChildren, QueryList, ElementRef, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder,
  Validators, AbstractControl, ValidationErrors
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule,
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Loader2, BookOpen, Send, ShieldCheck, Key,
  CheckCircle, RefreshCw, Check
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

// ── Validator ──────────────────────────────────────────────────────────────
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('newPassword')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoModule, LucideAngularModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'forgotPassword' }],
})
export class ForgotPassword implements OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  private http      = inject(HttpClient);
  private transloco = inject(TranslocoService);
  private config    = inject(APP_CONFIG);

  // ── UI state ─────────────────────────────────────────────────────────────
  step         = signal<1 | 2 | 3 | 4>(1);
  loading      = signal(false);
  logoFailed   = signal(false);
  errorMsg     = signal('');
  showPassword = signal(false);
  showConfirm  = signal(false);

  // ── OTP state ─────────────────────────────────────────────────────────────
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  otpValue  = computed(() => this.otpDigits().join(''));

  // Stores the verification token returned by the server after OTP is verified
  private verificationToken = '';

  private resendTimer: any = null;

  // ── Icons ─────────────────────────────────────────────────────────────────
  readonly mailIcon        = Mail;
  readonly lockIcon        = Lock;
  readonly eyeIcon         = Eye;
  readonly eyeOffIcon      = EyeOff;
  readonly arrowRightIcon  = ArrowRight;
  readonly arrowLeftIcon   = ArrowLeft;
  readonly loaderIcon      = Loader2;
  readonly bookOpenIcon    = BookOpen;
  readonly sendIcon        = Send;
  readonly shieldCheckIcon = ShieldCheck;
  readonly keyIcon         = Key;
  readonly checkCircleIcon = CheckCircle;
  readonly refreshIcon     = RefreshCw;
  readonly checkIcon       = Check;

  // ── Particles ─────────────────────────────────────────────────────────────
  readonly particles = Array.from({ length: 20 }, () => ({
    left: Math.random() * 100,
    top:  Math.random() * 100,
    dur:  `${6 + Math.random() * 8}s`,
    del:  `${-Math.random() * 8}s`,
    tx:   `${(Math.random() - 0.5) * 60}px`,
    ty:   `${(Math.random() - 0.5) * 60}px`,
  }));

  // ── Forms ─────────────────────────────────────────────────────────────────
  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm = this.fb.group({
    otp: [''],
  });

  resetForm = this.fb.group(
    {
      newPassword: [
        '', 
        [
          Validators.required,
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_+=<>?/.,:;'"[\]{}|\\]).{8,}$/)
        ]
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  // ── Password strength ─────────────────────────────────────────────────────
  passwordStrength = computed(() => {
    const pw = this.resetForm.get('newPassword')?.value ?? '';
    let score = 0;
    if (pw.length >= 8)               score++;
    if (/[A-Z]/.test(pw))             score++;
    if (/[a-z]/.test(pw))             score++;
    if (/[0-9]/.test(pw))             score++;
    if (/[!@#$%^&*()\-_+=<>?/.,:;'"[\]{}|\\]/.test(pw)) score++;
    return score;
  });

  strengthLabel = computed(() => {
    const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[this.passwordStrength()] ?? '';
  });

  ngOnDestroy(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
  }

  // ── Helper: normalise email ───────────────────────────────────────────────
  private get normalizedEmail(): string {
    return (this.emailForm.value.email ?? '').trim().toLowerCase();
  }

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  async sendOtp(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/auth/forgot-password`, {
          email: this.normalizedEmail,
        })
      );

      if (res?.success === false) {
        this.errorMsg.set(res.message || this.transloco.translate('forgotPassword.generic'));
        return;
      }

      this.step.set(2);
    } catch (error: any) {
      this.errorMsg.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  async verifyOtp(): Promise<void> {
    if (this.otpValue().length < 6) {
      this.errorMsg.set(this.transloco.translate('forgotPassword.codeRequired'));
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/auth/verify-otp`, {
          email: this.normalizedEmail,
          otp:   this.otpValue(),
        })
      );

      if (res?.success === false) {
        this.errorMsg.set(res.message || this.transloco.translate('forgotPassword.generic'));
        return;
      }

      // Persist the verification token returned by the server so we can send
      // it in the reset-password call (step 3).
      this.verificationToken = res?.data ?? '';

      this.step.set(3);
    } catch (error: any) {
      this.errorMsg.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async resendOtp(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/auth/resend-otp`, {
          email: this.normalizedEmail,
        })
      );

      if (res?.success === false) {
        this.errorMsg.set(res.message || this.transloco.translate('forgotPassword.generic'));
        return;
      }

      // Clear digits and focus first box
      this.otpDigits.set(['', '', '', '', '', '']);
      this.verificationToken = '';
      setTimeout(() => this.otpInputs?.first?.nativeElement?.focus(), 100);
    } catch (error: any) {
      this.errorMsg.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  async resetPassword(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/auth/reset-password`, {
          email:             this.normalizedEmail,
          verificationToken: this.verificationToken,
          newPassword:       this.resetForm.value.newPassword,
          confirmPassword:   this.resetForm.value.confirmPassword,
        })
      );

      if (res?.success === false) {
        this.errorMsg.set(res.message || this.transloco.translate('forgotPassword.generic'));
        return;
      }

      this.step.set(4);
    } catch (error: any) {
      this.errorMsg.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Error handling helper ──────────────────────────────────────────────────
  private extractErrorMessage(error: any): string {
    if (error instanceof HttpErrorResponse) {
      // Check for message in error response body first
      if (error.error?.message) {
        return error.error.message;
      }

      if (error.error?.errors) {
        const errors = error.error.errors;
        if (typeof errors === 'object') {
          const messages: string[] = [];
          Object.keys(errors).forEach(key => {
            if (Array.isArray(errors[key])) {
              messages.push(...errors[key]);
            } else {
              messages.push(errors[key]);
            }
          });
          return messages.join(', ');
        }
      }

      // Handle specific HTTP status codes as fallback
      if (error.status === 400) return this.transloco.translate('forgotPassword.invalidRequest');
      if (error.status === 404) return this.transloco.translate('forgotPassword.emailNotFound');
      if (error.status === 429) return this.transloco.translate('forgotPassword.tooManyRequests');
      if (error.status === 500) return this.transloco.translate('forgotPassword.serverError');
    }
    return this.transloco.translate('forgotPassword.generic');
  }

  // ── OTP input handling ────────────────────────────────────────────────────
  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(0, 1);
    input.value = val;

    const digits = [...this.otpDigits()];
    digits[index] = val;
    this.otpDigits.set(digits);

    if (this.errorMsg()) this.errorMsg.set('');

    if (val && index < 5) {
      this.otpInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
      this.otpInputs.toArray()[index - 1]?.nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
    const digits = [...this.otpDigits()];
    pasted.split('').forEach((c, i) => { if (i < 6) digits[i] = c; });
    this.otpDigits.set(digits);

    if (this.errorMsg()) this.errorMsg.set('');

    const last = Math.min(pasted.length, 5);
    this.otpInputs.toArray()[last]?.nativeElement.focus();
  }

  // ── Misc ──────────────────────────────────────────────────────────────────
  goToLogin():    void { this.router.navigate(['/login']); }
  togglePassword(): void { this.showPassword.update(v => !v); }
  toggleConfirm():  void { this.showConfirm.update(v => !v); }
  onLogoError():  void { this.logoFailed.set(true); }
  clearError():   void { this.errorMsg.set(''); }
}