// notification/types.ts
import { LucideIconData } from 'lucide-angular';

export type NzNotificationType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface NzNotificationData {
  key?: string;
  type?: NzNotificationType;
  title?: string;
  content: string;
  duration?: number;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  closable?: boolean;
  onClose?: () => void;
  onClick?: () => void;
  /** Custom Lucide icon (overrides built-in type icon) */
  icon?: LucideIconData;
  /** Custom SVG string icon (overrides built-in type icon) */
  iconSvg?: string;
}

export interface NzMessageData {
  key?: string;
  type?: NzNotificationType;
  content: string;
  duration?: number;
  onClose?: () => void;
  /** Custom Lucide icon (overrides built-in type icon) */
  icon?: LucideIconData;
  /** Custom SVG string icon (overrides built-in type icon) */
  iconSvg?: string;
}