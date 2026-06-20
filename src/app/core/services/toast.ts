import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration: number;  // 0 = persistent (manual close only)
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class Toast {
  private toastsSignal = signal<ToastMessage[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  private timers = new Map<string, number>();

  private show(type: ToastType, message: string, duration = 3500): void {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const toast: ToastMessage = { id, type, message, duration, createdAt: Date.now() };
    this.toastsSignal.update(list => [...list, toast]);

    if (duration > 0) {
      const timer = window.setTimeout(() => this.dismiss(id), duration);
      this.timers.set(id, timer);
    }
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    // Always remove from list regardless of whether a timer existed
    this.toastsSignal.update(list => list.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.timers.forEach(t => window.clearTimeout(t));
    this.timers.clear();
    this.toastsSignal.set([]);
  }

  success(message: string, duration?: number): void { this.show('success', message, duration); }
  error(message: string, duration?: number): void   { this.show('error',   message, duration); }
  warning(message: string, duration?: number): void { this.show('warning', message, duration); }
  info(message: string, duration?: number): void    { this.show('info',    message, duration); }

  stickyError(message: string): void { this.show('error', message, 0); }
}
