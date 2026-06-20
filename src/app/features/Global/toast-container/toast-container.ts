// core/components/toast-container/toast-container.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast } from '../../../core/services/toast';
import { LucideAngularModule, CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-angular';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './toast-container.html',
  styleUrls: ['./toast-container.scss'],
})
export class ToastContainer {
  private toastService = inject(Toast);

  readonly toasts = this.toastService.toasts;

  readonly CheckCircleIcon   = CheckCircle;
  readonly XCircleIcon       = XCircle;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly InfoIcon          = Info;
  readonly XIcon             = X;

  dismiss(id: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.toastService.dismiss(id);
  }
}
