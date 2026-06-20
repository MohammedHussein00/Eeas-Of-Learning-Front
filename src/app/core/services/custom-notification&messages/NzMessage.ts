// message/message.service.ts
import {
  Injectable,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  ComponentRef,
} from '@angular/core';
import { NzMessageContainer } from '../../../features/Global/NzMessageContainer';
import { NzMessageData, NzNotificationType } from '../../../core/shared-types/notification-types';
@Injectable({ providedIn: 'root' })
export class NzMessageService {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private containerRef: ComponentRef<NzMessageContainer> | null = null;

  private getContainer(): NzMessageContainer {
    if (!this.containerRef) {
      this.containerRef = createComponent(NzMessageContainer, {
        environmentInjector: this.injector,
      });
      document.body.appendChild(this.containerRef.location.nativeElement);
      this.appRef.attachView(this.containerRef.hostView);
    }
    return this.containerRef.instance;
  }

  success(content: string, options?: Partial<NzMessageData>): void {
    this.create('success', content, options);
  }

  info(content: string, options?: Partial<NzMessageData>): void {
    this.create('info', content, options);
  }

  warning(content: string, options?: Partial<NzMessageData>): void {
    this.create('warning', content, options);
  }

  error(content: string, options?: Partial<NzMessageData>): void {
    this.create('error', content, options);
  }

  loading(content: string, options?: Partial<NzMessageData>): string {
    const key = this.create('loading' as NzNotificationType, content, { duration: 0, ...options });
    return key;
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

  private create(
    type: NzNotificationType,
    content: string,
    options?: Partial<NzMessageData>
  ): string {
    const key = `message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.getContainer().add({
      type,
      content,
      key,
      duration: 3000,
      ...options,
    });
    return key;
  }
}