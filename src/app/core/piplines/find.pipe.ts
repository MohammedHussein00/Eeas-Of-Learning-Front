// src/app/shared/pipes/find.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'find',
  standalone: true
})
export class FindPipe implements PipeTransform {
  transform<T extends Record<string, any>>(
    array: T[] | null | undefined,
    key: string | number,
    value?: any
  ): T | undefined {
    if (!array) return undefined;
    
    if (value !== undefined) {
      // Find by key-value pair
      return array.find(item => item[key] === value);
    }
    
    // Find by checking if any property equals the key
    return array.find(item => {
      for (const prop in item) {
        if (item[prop] === key) {
          return true;
        }
      }
      return false;
    });
  }
}