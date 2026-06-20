// core/directives/click-outside.directive.ts
import { Directive, ElementRef, Output, EventEmitter, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();
  
  private elementRef = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    // Check if event target exists
    if (!event.target) {
      return;
    }
    
    const target = event.target as HTMLElement;
    const nativeElement = this.elementRef.nativeElement;
    
    // Check if the click was outside the element
    if (nativeElement && !nativeElement.contains(target)) {
      this.clickOutside.emit();
    }
  }
}