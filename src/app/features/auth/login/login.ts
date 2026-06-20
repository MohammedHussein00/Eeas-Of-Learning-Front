// features/auth/login/login.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../../core/services/auth';
import { LucideAngularModule, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, BookOpen } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  providers: [

    { provide: TRANSLOCO_SCOPE, useValue: 'teacherLayout' },
  ],
})
export class Login {
  private fb        = inject(FormBuilder);
  private auth      = inject(Auth);
  private router    = inject(Router);
  public  transloco = inject(TranslocoService);

  loading      = signal(false);
  showPassword = signal(false);
  logoFailed   = signal(false);
  errorMsg     = signal('');

  readonly particles = Array.from({ length: 20 }, () => ({
    left: Math.random() * 100,
    top:  Math.random() * 100,
    dur:  `${6 + Math.random() * 8}s`,
    del:  `${-Math.random() * 8}s`,
    tx:   `${(Math.random() - 0.5) * 60}px`,
    ty:   `${(Math.random() - 0.5) * 60}px`,
  }));

  readonly mailIcon       = Mail;
  readonly lockIcon       = Lock;
  readonly eyeIcon        = Eye;
  readonly eyeOffIcon     = EyeOff;
  readonly arrowRightIcon = ArrowRight;
  readonly loaderIcon     = Loader2;
  readonly bookOpenIcon   = BookOpen;

  loginForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const res = await this.auth.login({
        email:    this.loginForm.value.email!,
        password: this.loginForm.value.password!,
      });
      if (res.message) { this.errorMsg.set(res.message); return; }
      this.auth.saveSession(res);
      const role = this.auth.getRole();
      console.log(res)
      if (role === 'Admin') this.router.navigateByUrl('/dash/dashboard');
      else                  this.router.navigateByUrl('/teacher/dashboard');
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        if      (err.status === 401) this.errorMsg.set(this.transloco.translate('login.invalidCredentials'));
        else if (err.status >= 500)  this.errorMsg.set(this.transloco.translate('login.server'));
        else if (!err.status)        this.errorMsg.set(this.transloco.translate('login.network'));
        else                         this.errorMsg.set(this.transloco.translate('login.generic'));
      } else {
        this.errorMsg.set(this.transloco.translate('login.generic'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  togglePassword(): void { this.showPassword.update(v => !v); }
  onLogoError():    void { this.logoFailed.set(true); }
  clearError():     void { this.errorMsg.set(''); }
}