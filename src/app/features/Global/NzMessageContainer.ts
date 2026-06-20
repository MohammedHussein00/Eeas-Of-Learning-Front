import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { NzMessageData } from '../../core/shared-types/notification-types';

interface MessageItem extends NzMessageData {
  key: string;
  state: 'entering' | 'visible' | 'leaving';
}

/**
 * Usage examples
 * ──────────────
 * Basic:
 *   this.message.success('File saved');
 *   this.message.error('Something went wrong');
 *   this.message.loading('Uploading…', { duration: 0 }); // manual close
 *
 * Custom Lucide icon:
 *   import { Rocket } from 'lucide-angular';
 *   this.message.open('Deployment started', { icon: Rocket });
 *
 * Custom SVG string icon:
 *   this.message.open('Done', { iconSvg: '<svg …>…</svg>' });
 *
 * Manual close:
 *   const ref = this.message.loading('Processing…', { duration: 0 });
 *   // later:
 *   ref.close();
 *
 * With onClose callback:
 *   this.message.success('Saved!', { onClose: () => doNext() });
 */

@Component({
  selector: 'nz-message-container',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-message-container">
      @for (item of messages(); track item.key) {
        <div
          class="nz-message nz-message-{{ item.type ?? 'custom' }}"
          [class.nz-message-entering]="item.state === 'entering'"
          [class.nz-message-visible]="item.state === 'visible'"
          [class.nz-message-leaving]="item.state === 'leaving'"
          [attr.data-key]="item.key"
        >
          <div class="nz-message-notice-content">
            <div class="nz-message-custom-content">
              <span class="nz-message-icon">

                <!-- 1. Custom Lucide icon component -->
                @if (item.icon) {
                  <lucide-angular [img]="item.icon" [size]="16" />

                <!-- 2. Custom raw SVG string -->
                } @else if (item.iconSvg) {
                  <span class="nz-message-svg-icon" [innerHTML]="item.iconSvg"></span>

                <!-- 3. Built-in type icons -->
                } @else {
                  @switch (item.type) {
                    @case ('success') {
                      <svg viewBox="64 64 896 896" focusable="false">
                        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z"/>
                      </svg>
                    }
                    @case ('info') {
                      <svg viewBox="64 64 896 896" focusable="false">
                        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm32 820c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V548c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v336zm0-488c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V180c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v224z"/>
                      </svg>
                    }
                    @case ('warning') {
                      <svg viewBox="64 64 896 896" focusable="false">
                        <path d="M464 720a48 48 0 1096 0 48 48 0 10-96 0zm16-304v184c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V416c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8zm475.7 440l-416-720c-6.2-10.7-21.6-10.7-27.8 0l-416 720C56.2 862.2 62.5 876 74.6 876h706.9c12.1 0 18.4-13.8 10.2-24zM512 140.2L851.8 796H170.2L512 140.2z"/>
                      </svg>
                    }
                    @case ('error') {
                      <svg viewBox="64 64 896 896" focusable="false">
                        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L340.5 359a8.32 8.32 0 01-1.9-5.2c0-4.4 3.6-8 8-8l66.1.3L512 464.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L553.5 514l130.1 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z"/>
                      </svg>
                    }
                    @case ('loading') {
                      <span class="nz-message-loading-icon">
                        <svg viewBox="0 0 1024 1024" focusable="false">
                          <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66.3 832.8 97 881.8 146c49 49 79.7 109.5 99.8 170.7 26.9 63.1 40.3 130.2 40.3 199.3.1 19.9-16 36-35.9 36z"/>
                        </svg>
                      </span>
                    }
                  }
                }
              </span>
              <span class="nz-message-text">{{ item.content }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ── Host: fixed top-centre, full width, no pointer events ── */
    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 1010;
      pointer-events: none;
      display: flex;
      justify-content: center;
    }

    .nz-message-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 8px;
      pointer-events: none;
    }

    /* ── Wrapper: grid-row collapse + pure Y drop (no X offset) ── */
    .nz-message {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      /* Origin: directly above, no horizontal drift */
      transform: translateY(-16px) scale(0.94);
      margin-bottom: 0;
      pointer-events: none;
      transition:
        grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        margin-bottom      0.25s cubic-bezier(0.4, 0, 0.2, 1),
        opacity            0.2s  cubic-bezier(0.4, 0, 0.2, 1),
        transform          0.25s cubic-bezier(0.34, 1.15, 0.64, 1);
    }

    /* Inner wrapper required for grid-row collapse trick */
    .nz-message-notice-content {
      overflow: hidden;
      min-height: 0;
    }

    /* Visible state: drop into place from directly above */
    .nz-message-visible {
      grid-template-rows: 1fr;
      opacity: 1;
      transform: translateY(0) scale(1);
      margin-bottom: 8px;
      pointer-events: auto;
    }

    /* Leave state: retract straight upward (no X drift) */
    .nz-message-leaving {
      grid-template-rows: 0fr;
      opacity: 0;
      transform: translateY(-8px) scale(0.94);
      margin-bottom: 0;
      pointer-events: none;
      transition:
        grid-template-rows 0.2s  cubic-bezier(0.4, 0, 1, 1),
        margin-bottom      0.2s  cubic-bezier(0.4, 0, 1, 1),
        opacity            0.15s cubic-bezier(0.4, 0, 1, 1),
        transform          0.2s  cubic-bezier(0.4, 0, 1, 1);
    }

    /* ── Card ── */
    .nz-message-notice-content {
      display: block;
      padding: 9px 16px;
      background: #fff;
      border-radius: 8px;
      box-shadow:
        0 6px 16px 0 rgba(0, 0, 0, 0.08),
        0 3px 6px -4px rgba(0, 0, 0, 0.12),
        0 9px 28px 8px rgba(0, 0, 0, 0.05);
    }

    .nz-message-custom-content {
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }

    .nz-message-icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .nz-message-icon svg,
    .nz-message-svg-icon ::ng-deep svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .nz-message-text {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.88);
      line-height: 1.5;
    }

    /* ── Type colours ── */
    .nz-message-success .nz-message-icon { color: #52c41a; }
    .nz-message-info    .nz-message-icon { color: #1677ff; }
    .nz-message-warning .nz-message-icon { color: #faad14; }
    .nz-message-error   .nz-message-icon { color: #ff4d4f; }
    .nz-message-loading .nz-message-icon { color: #1677ff; }
    /* Custom type falls back to a neutral colour; caller can override via iconColor */
    .nz-message-custom  .nz-message-icon { color: rgba(0, 0, 0, 0.65); }

    /* Loading spinner */
    @keyframes nzMessageLoading {
      to { transform: rotate(360deg); }
    }
    .nz-message-loading-icon {
      display: inline-block;
      animation: nzMessageLoading 1s linear infinite;
    }
  `]
})
export class NzMessageContainer {
  messages = signal<MessageItem[]>([]);

  private dismissTimers  = new Map<string, ReturnType<typeof setTimeout>>();
  private closeCallbacks = new Map<string, () => void>();

  add(message: NzMessageData): { close: () => void } {
    const key      = message.key ?? this.generateKey();
    const duration = message.duration ?? 3000;

    const item: MessageItem = { ...message, key, duration, state: 'entering' };
    this.messages.update(list => [...list, item]);

    // Two rAFs: first renders the entering element into the DOM;
    // second lets the browser paint that frame so CSS transitions have
    // a "from" state to animate away from.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.messages.update(list =>
          list.map(m => m.key === key ? { ...m, state: 'visible' } : m)
        );
      });
    });

    if (duration > 0) {
      const t = setTimeout(() => this.close(key), duration);
      this.dismissTimers.set(key, t);
    }

    return { close: () => this.close(key) };
  }

  close(key: string): void {
    const t = this.dismissTimers.get(key);
    if (t) { clearTimeout(t); this.dismissTimers.delete(key); }

    const item = this.messages().find(m => m.key === key);
    if (!item) return;
    if (item.onClose) this.closeCallbacks.set(key, item.onClose);

    this.messages.update(list =>
      list.map(m => m.key === key ? { ...m, state: 'leaving' } : m)
    );

    // Remove after out-transition (longest leg is 0.2s → 250 ms buffer)
    setTimeout(() => {
      this.messages.update(list => list.filter(m => m.key !== key));
      this.closeCallbacks.get(key)?.();
      this.closeCallbacks.delete(key);
    }, 250);
  }

  private generateKey(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}


// // usage-examples.component.ts
// import { Component, inject } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { NzNotificationService } from './core/services/custom-notification&messages/NzNotification';
// import { NzMessageService } from './core/services/custom-notification&messages/NzMessage';
// import { Rocket, CheckCircle, AlertTriangle, XCircle, Info, Loader2 } from 'lucide-angular';

// @Component({
//   selector: 'app-usage-examples',
//   standalone: true,
//   imports: [CommonModule],
//   template: `
//     <div style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
//       <h2>Notification Examples</h2>
//       <button (click)="basicSuccess()">Basic Success</button>
//       <button (click)="basicError()">Basic Error</button>
//       <button (click)="customIcon()">Custom Lucide Icon</button>
//       <button (click)="customSvg()">Custom SVG Icon</button>
//       <button (click)="placementDemo()">Different Placements</button>
//       <button (click)="persistent()">Persistent (manual close)</button>

//       <h2>Message Examples</h2>
//       <button (click)="messageSuccess()">Message Success</button>
//       <button (click)="messageLoading()">Message Loading</button>
//       <button (click)="messageCustomIcon()">Message Custom Icon</button>
//     </div>
//   `
// })
// export class UsageExamplesComponent {
//   private notification = inject(NzNotificationService);
//   private message = inject(NzMessageService);

//   // ── Basic Notifications ──
//   basicSuccess(): void {
//     this.notification.success(
//       'Upload Complete',
//       'All 3 files were saved successfully.'
//     );
//   }

//   basicError(): void {
//     this.notification.error(
//       'Request Failed',
//       'Check your connection and retry.',
//       { duration: 8000 }
//     );
//   }

//   // ── Custom Lucide Icon ──
//   customIcon(): void {
//     this.notification.open({
//       title: 'Deployment Started',
//       content: 'Build pipeline triggered for main branch.',
//       icon: Rocket,
//       placement: 'bottomRight',
//       duration: 6000,
//     });
//   }

//   // ── Custom SVG String Icon ──
//   customSvg(): void {
//     this.notification.open({
//       title: 'Custom Alert',
//       content: 'This uses a raw SVG string as the icon.',
//       iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//         <circle cx="12" cy="12" r="10"/>
//         <path d="M12 8v4M12 16h.01"/>
//       </svg>`,
//       duration: 5000,
//     });
//   }

//   // ── Placement Demo ──
//   placementDemo(): void {
//     this.notification.success('Top Right', 'Default placement');

//     setTimeout(() => {
//       this.notification.info('Top Left', 'Slides in from left', {
//         placement: 'topLeft',
//       });
//     }, 500);

//     setTimeout(() => {
//       this.notification.warning('Bottom Right', 'Slides in from right', {
//         placement: 'bottomRight',
//       });
//     }, 1000);

//     setTimeout(() => {
//       this.notification.error('Bottom Left', 'Slides in from left', {
//         placement: 'bottomLeft',
//       });
//     }, 1500);
//   }

//   // ── Persistent (no auto-dismiss) ──
//   persistent(): void {
//     this.notification.warning(
//       'Session Expiring',
//       'Save your work before you are logged out.',
//       { duration: 0, closable: true }
//     );
//   }

//   // ── Message Examples ──
//   messageSuccess(): void {
//     this.message.success('File saved successfully');
//   }

//   messageLoading(): void {
//     const ref = this.message.loading('Uploading files...');

//     // Simulate async work
//     setTimeout(() => {
//       ref.close();
//       this.message.success('Upload complete!');
//     }, 3000);
//   }

//   messageCustomIcon(): void {
//     this.message.open('Custom message with Rocket icon', {
//       icon: Rocket,
//       duration: 4000,
//     });
//   }
// }