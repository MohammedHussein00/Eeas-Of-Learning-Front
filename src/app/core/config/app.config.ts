// core/config/app.config.ts
import { InjectionToken } from '@angular/core';

export interface AppConfiguration {
  baseUrl: string;
  apiVersion?: string;
  appVersion?: string;
}

// Define the injection token
export const APP_CONFIG = new InjectionToken<AppConfiguration>('APP_CONFIG');

// Default configuration
export const DEFAULT_APP_CONFIG: AppConfiguration = {
  baseUrl: 'https://localhost:7091',
  apiVersion: 'v1',
  appVersion: '1.0.0'
};