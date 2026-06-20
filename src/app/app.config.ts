import { ApplicationConfig, provideZonelessChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideTransloco, TranslocoService } from '@ngneat/transloco';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  CloseOutline,
  CheckCircleFill,
  InfoCircleFill,
  ExclamationCircleFill,
  CloseCircleFill,
} from '@ant-design/icons-angular/icons';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptorFn } from './core/interceptors/auth-interceptor';
import { TranslocoHttpLoader } from './transloco-loader';
import { APP_CONFIG } from './core/config/app.config';

const icons = [CloseOutline, CheckCircleFill, InfoCircleFill, ExclamationCircleFill, CloseCircleFill];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptorFn]), withFetch()),
    provideAnimationsAsync(),
    provideNzI18n(en_US),
    provideNzIcons(icons),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: false,
        missingHandler: { useFallbackTranslation: true, logMissingKey: true },
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      return firstValueFrom(transloco.load('en'));
    }),
    {
      provide: APP_CONFIG,
      useValue: {
        baseUrl: 'https://localhost:7091',
      },
    },
  ],
};