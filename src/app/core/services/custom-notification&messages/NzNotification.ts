import {
  Injectable,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  ComponentRef,
} from '@angular/core';
import { NzNotificationContainer } from '../../../features/Global/NzNotificationContainer';
import { NzNotificationData, NzNotificationType } from '../../shared-types/notification-types';
import { LucideIconData } from 'lucide-angular';

@Injectable({ providedIn: 'root' })
export class NzNotification {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private containerRef: ComponentRef<NzNotificationContainer> | null = null;

  private getContainer(): NzNotificationContainer {
    if (!this.containerRef) {
      this.containerRef = createComponent(NzNotificationContainer, {
        environmentInjector: this.injector,
      });
      document.body.appendChild(this.containerRef.location.nativeElement);
      this.appRef.attachView(this.containerRef.hostView);
    }
    return this.containerRef.instance;
  }

  success(title: string, content: string, options?: Partial<NzNotificationData>): void {
    this.create('success', title, content, options);
  }

  info(title: string, content: string, options?: Partial<NzNotificationData>): void {
    this.create('info', title, content, options);
  }

  warning(title: string, content: string, options?: Partial<NzNotificationData>): void {
    this.create('warning', title, content, options);
  }

  error(title: string, content: string, options?: Partial<NzNotificationData>): void {
    this.create('error', title, content, options);
  }

  /**
   * Open a notification with full custom control.
   * Use this for custom icons, placement, or when you don't want a title.
   *
   * Examples:
   *   // Custom Lucide icon
   *   import { Rocket } from 'lucide-angular';
   *   this.notification.open({
   *     title: 'Deployment started',
   *     content: 'Build pipeline triggered.',
   *     icon: Rocket,
   *     placement: 'bottomRight',
   *   });
   *
   *   // Custom SVG icon
   *   this.notification.open({
   *     title: 'Custom alert',
   *     content: 'Something happened.',
   *     iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
   *   });
   *
   *   // No title, just content
   *   this.notification.open({
   *     content: 'Auto-saved at 14:32',
   *     duration: 2000,
   *   });
   */
  open(options: NzNotificationData): void {
    this.getContainer().add({
      duration: 4500,
      placement: 'topRight',
      closable: true,
      ...options,
    });
  }

  private create(
    type: NzNotificationType,
    title: string,
    content: string,
    options?: Partial<NzNotificationData>
  ): void {
    this.getContainer().add({
      type,
      title,
      content,
      duration: options?.duration ?? 4500,
      placement: options?.placement ?? 'topRight',
      closable: options?.closable ?? true,
      ...options,
    });
  }

  remove(key: string): void {
    this.containerRef?.instance.close(key);
  }

  destroy(): void {
    if (this.containerRef) {
      this.appRef.detachView(this.containerRef.hostView);
      this.containerRef.destroy();
      this.containerRef = null;
    }
  }
}