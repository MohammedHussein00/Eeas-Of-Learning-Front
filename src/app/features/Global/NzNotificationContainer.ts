import { Component, signal, ChangeDetectionStrategy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { NzNotificationData } from '../../core/shared-types/notification-types';

/**
 * Placement of the notification stack on screen.
 */
export type NzNotificationPlacement =
  | 'topRight'
  | 'topLeft'
  | 'bottomRight'
  | 'bottomLeft';

interface NotificationItem extends NzNotificationData {
  key: string;
  state: 'entering' | 'visible' | 'leaving';
}

/**
 * Usage examples
 * ──────────────
 * Basic:
 *   this.notification.success('Upload complete', 'All 3 files were saved.');
 *   this.notification.error('Request failed', 'Check your connection and retry.');
 *
 * Custom Lucide icon:
 *   import { Rocket } from 'lucide-angular';
 *   this.notification.open({
 *     title: 'Deployment started',
 *     content: 'Build pipeline triggered for main branch.',
 *     icon: Rocket,
 *   });
 *
 * Custom SVG string icon:
 *   this.notification.open({
 *     title: 'Custom alert',
 *     content: 'Something happened.',
 *     iconSvg: '<svg viewBox="0 0 24 24">…</svg>',
 *   });
 *
 * Persistent (no auto-dismiss):
 *   this.notification.warning('Session expiring', 'Save your work.', { duration: 0 });
 *
 * With close callback:
 *   this.notification.info('Synced', 'Data is up to date.', {
 *     onClose: () => console.log('dismissed'),
 *   });
 *
 * Placement (set once on the container via service or input):
 *   container.placement = 'bottomLeft';
 *
 * Animation origin per placement
 * ────────────────────────────────
 *   topRight    → slides in from the RIGHT  edge (translateX +)
 *   topLeft     → slides in from the LEFT   edge (translateX -)
 *   bottomRight → slides in from the RIGHT  edge (translateX +)
 *   bottomLeft  → slides in from the LEFT   edge (translateX -)
 */

@Component({
  selector: 'nz-notification-container',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-notification-container">
      @for (item of notifications(); track item.key) {
        <div
          class="nz-notification nz-notification-{{ item.type ?? 'custom' }}"
          [class.nz-notification-entering]="item.state === 'entering'"
          [class.nz-notification-visible]="item.state === 'visible'"
          [class.nz-notification-leaving]="item.state === 'leaving'"
          [attr.data-key]="item.key"
        >
          <div class="nz-notification-notice">
            <div class="nz-notification-notice-content">

              <!-- Icon column -->
              <div class="nz-notification-notice-icon">
                <!-- 1. Custom Lucide icon -->
                @if (item.icon) {
                  <lucide-angular [img]="item.icon" [size]="24" />

                <!-- 2. Custom raw SVG string -->
                } @else if (item.iconSvg) {
                  <span class="nz-notification-svg-icon" [innerHTML]="item.iconSvg"></span>

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
                  }
                }
              </div>

              <!-- Text column -->
              <div class="nz-notification-notice-message">
                @if (item.title) {
                  <div class="nz-notification-notice-title">{{ item.title }}</div>
                }
                <div class="nz-notification-notice-description">{{ item.content }}</div>
              </div>
            </div>

            <!-- Close button -->
            @if (item.closable !== false) {
              <button
                class="nz-notification-notice-close"
                type="button"
                aria-label="Close notification"
                (click)="close(item.key)"
              >
                <svg viewBox="64 64 896 896" focusable="false">
                  <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.7 424.2 295.1 201.1c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"/>
                </svg>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /*
     * ── Host positioning ──────────────────────────────────────────────────────
     *
     * Default: topRight. Override placement at runtime by toggling the
     * host's CSS classes (top-right | top-left | bottom-right | bottom-left)
     * from the service that manages this container.
     */
    :host {
      position: fixed;
      z-index: 1010;
      width: 384px;
      pointer-events: none;
      display: flex;
      flex-direction: column;
    }

    /* topRight (default) — slides in from RIGHT edge */
    :host { top: 24px; right: 24px; }

    /* topLeft — slides in from LEFT edge */
    :host(.placement-topLeft)    { top: 24px;    right: auto; left: 24px; }
    /* bottomRight — slides in from RIGHT edge */
    :host(.placement-bottomRight){ top: auto;    bottom: 24px; right: 24px; left: auto; }
    /* bottomLeft — slides in from LEFT edge */
    :host(.placement-bottomLeft) { top: auto;    bottom: 24px; right: auto; left: 24px; }

    /* ── Slide direction vars ──
     * RIGHT placements: slide from right (positive X)
     * LEFT  placements: slide from left  (negative X)
     */
    :host                        { --slide-enter: translateX(calc(100% + 24px)); }
    :host(.placement-topLeft)    { --slide-enter: translateX(calc(-100% - 24px)); }
    :host(.placement-bottomRight){ --slide-enter: translateX(calc(100% + 24px)); }
    :host(.placement-bottomLeft) { --slide-enter: translateX(calc(-100% - 24px)); }

    .nz-notification-container {
      display: flex;
      flex-direction: column;
      gap: 0;
      width: 100%;
    }

    /* ── Wrapper: grid collapse + pure X-axis slide ── */
    .nz-notification {
      pointer-events: auto;
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      margin-bottom: 0;
      /* Slide purely on X-axis from the edge */
      transform: var(--slide-enter);
      transition:
        grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1),
        margin-bottom      0.28s cubic-bezier(0.4, 0, 0.2, 1),
        opacity            0.22s cubic-bezier(0.4, 0, 0.2, 1),
        transform          0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
    }

    /* Inner wrapper required for grid-row collapse trick */
    .nz-notification-notice {
      overflow: hidden;
      min-height: 0;
    }

    /* Visible: slide to resting position */
    .nz-notification-visible {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-bottom: 12px;
      transform: translateX(0);
    }

    /* Leave: slide back out the same edge it came from */
    .nz-notification-leaving {
      grid-template-rows: 0fr;
      opacity: 0;
      margin-bottom: 0;
      transform: var(--slide-enter);
      transition:
        grid-template-rows 0.24s cubic-bezier(0.4, 0, 1, 1),
        margin-bottom      0.24s cubic-bezier(0.4, 0, 1, 1),
        opacity            0.18s cubic-bezier(0.4, 0, 1, 1),
        transform          0.22s cubic-bezier(0.4, 0, 1, 1);
    }

    /* ── Inner card ── */
    .nz-notification-notice {
      position: relative;
      padding: 16px 40px 16px 16px;
      background: #fff;
      border-radius: 10px;
      box-shadow:
        0 6px 16px 0 rgba(0, 0, 0, 0.08),
        0 3px 6px -4px rgba(0, 0, 0, 0.12),
        0 9px 28px 8px rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-height: 0;
    }

    .nz-notification-notice-content {
      flex: 1;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      min-width: 0;
    }

    /* Icon */
    .nz-notification-notice-icon {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      margin-top: 1px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .nz-notification-notice-icon svg,
    .nz-notification-svg-icon ::ng-deep svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    /* Text */
    .nz-notification-notice-message {
      flex: 1;
      min-width: 0;
    }
    .nz-notification-notice-title {
      font-size: 15px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.88);
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .nz-notification-notice-description {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.62);
      line-height: 1.57;
    }

    /* Close button */
    .nz-notification-notice-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 22px;
      height: 22px;
      padding: 4px;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(0, 0, 0, 0.35);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s, background 0.2s;
      flex-shrink: 0;
    }
    .nz-notification-notice-close:hover {
      color: rgba(0, 0, 0, 0.75);
      background: rgba(0, 0, 0, 0.06);
    }
    .nz-notification-notice-close svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
      pointer-events: none;
    }

    /* ── Type colours ── */
    .nz-notification-success .nz-notification-notice-icon { color: #52c41a; }
    .nz-notification-info    .nz-notification-notice-icon { color: #1677ff; }
    .nz-notification-warning .nz-notification-notice-icon { color: #faad14; }
    .nz-notification-error   .nz-notification-notice-icon { color: #ff4d4f; }
    /* Custom type: neutral fallback; caller controls colour via icon itself */
    .nz-notification-custom  .nz-notification-notice-icon { color: rgba(0, 0, 0, 0.65); }

    /* ── Left accent bar per type ── */
    .nz-notification-success .nz-notification-notice { border-left: 3px solid #52c41a; border-radius: 0 10px 10px 0; }
    .nz-notification-info    .nz-notification-notice { border-left: 3px solid #1677ff; border-radius: 0 10px 10px 0; }
    .nz-notification-warning .nz-notification-notice { border-left: 3px solid #faad14; border-radius: 0 10px 10px 0; }
    .nz-notification-error   .nz-notification-notice { border-left: 3px solid #ff4d4f; border-radius: 0 10px 10px 0; }
  `]
})
export class NzNotificationContainer {
  private zone = inject(NgZone);

  notifications = signal<NotificationItem[]>([]);

  private dismissTimers  = new Map<string, ReturnType<typeof setTimeout>>();
  private closeCallbacks = new Map<string, () => void>();

  add(notification: NzNotificationData): void {
    const key      = notification.key ?? this.generateKey();
    const duration = notification.duration ?? 4500;

    const item: NotificationItem = { ...notification, key, duration, state: 'entering' };
    this.notifications.update(list => [...list, item]);

    // Two rAFs: first renders the entering element; second lets the browser
    // paint that "from" frame so the CSS transition has a start state.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.notifications.update(list =>
          list.map(n => n.key === key ? { ...n, state: 'visible' } : n)
        );
      });
    });

    if (duration > 0) {
      const t = setTimeout(() => this.close(key), duration);
      this.dismissTimers.set(key, t);
    }
  }

  close(key: string): void {
    const t = this.dismissTimers.get(key);
    if (t) { clearTimeout(t); this.dismissTimers.delete(key); }

    const item = this.notifications().find(n => n.key === key);
    if (!item) return;
    if (item.onClose) this.closeCallbacks.set(key, item.onClose);

    this.notifications.update(list =>
      list.map(n => n.key === key ? { ...n, state: 'leaving' } : n)
    );

    // Remove after longest out-transition (280 ms → 300 ms buffer)
    setTimeout(() => {
      this.notifications.update(list => list.filter(n => n.key !== key));
      this.closeCallbacks.get(key)?.();
      this.closeCallbacks.delete(key);
    }, 300);
  }

  private generateKey(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}