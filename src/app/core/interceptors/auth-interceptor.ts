import {
  HttpInterceptorFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { Cookie } from '../services/cookie';
import { Auth } from '../services/auth';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

/** Build a cloned request with fresh auth headers */
const buildAuthReq = (
  req: Parameters<HttpInterceptorFn>[0],
  token: string | null,
  deviceId: string,
  language: string,
  retry = false
) =>
  req.clone({
    setHeaders: {
      'X-Language': language,
      'X-App-Id': deviceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(retry ? { 'X-Retry': '1' } : {}),
    },
  });

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const cookies = inject(Cookie);
  const router  = inject(Router);
  const auth    = inject(Auth);

  const token    = cookies.retrieveCookie('etHy0B87RlH9CXykEzclg');
  const deviceId = cookies.retrieveCookie('xD3vId8kPqR2mNwT') || 'web_unknown';
  const language = cookies.retrieveCookie('lang') || 'en';

  const authReq = buildAuthReq(req, token, deviceId, language);

  return next(authReq).pipe(
    // Use a plain function so we can use async/await inside via Promise-wrapped Observable
    (source) =>
      new Observable<HttpEvent<unknown>>(observer => {
        source.subscribe({
          next:     v  => observer.next(v),
          complete: () => observer.complete(),
          error: (err: unknown) => {
            if (!(err instanceof HttpErrorResponse)) {
              observer.error(err);
              return;
            }

            // ── Non-401 errors ────────────────────────────────────────────
            if (err.status !== 401) {
              if (err.status === 403) {
                const msg = (err.error as { message?: string })?.message ?? '';
                if (/session|token|expired|invalid/i.test(msg)) {
                  auth.logout();
                  router.navigateByUrl('/login');
                }
              }
              observer.error(err);
              return;
            }

            // ── 401 on a retried request → give up ────────────────────────
            if (authReq.headers.has('X-Retry')) {
              auth.logout();
              router.navigateByUrl('/login');
              observer.error(err);
              return;
            }

            // ── Device not registered → force login ───────────────────────
            const errorCode = (err.error as { errorCode?: string })?.errorCode;
            if (errorCode === 'DEVICE_NOT_REGISTERED') {
              auth.logout();
              router.navigateByUrl('/login');
              observer.error(err);
              return;
            }

            // ── No tokens stored → force login ────────────────────────────
            const refreshToken = cookies.retrieveCookie('qJSPpdVT7imnSyny9bdHRT');
            const accessToken  = cookies.retrieveCookie('etHy0B87RlH9CXykEzclg');
            if (!refreshToken || !accessToken) {
              auth.logout();
              router.navigateByUrl('/login');
              observer.error(err);
              return;
            }

            // ── Another refresh already in flight → queue this request ────
            if (isRefreshing) {
              failedQueue.push({
                resolve: (newToken: string) => {
                  const retryReq = buildAuthReq(req, newToken, deviceId, language, true);
                  next(retryReq).subscribe({
                    next:     v  => observer.next(v),
                    error:    e  => observer.error(e),
                    complete: () => observer.complete(),
                  });
                },
                reject: (e: unknown) => observer.error(e),
              });
              return;
            }

            // ── Start refresh ─────────────────────────────────────────────
            isRefreshing = true;

            auth
              .refreshToken(refreshToken, accessToken)
              .then(res => {
                if (!res?.success || !res.data?.accessToken) {
                  throw new Error('Refresh response invalid');
                }

                const newToken = res.data.accessToken;
                cookies.setCookie('etHy0B87RlH9CXykEzclg', newToken);
                if (res.data.refreshToken) {
                  cookies.setCookie('qJSPpdVT7imnSyny9bdHRT', res.data.refreshToken);
                }

                processQueue(null, newToken);
                isRefreshing = false;

                // Retry the original request with the new token
                const retryReq = buildAuthReq(req, newToken, deviceId, language, true);
                next(retryReq).subscribe({
                  next:     v  => observer.next(v),
                  error:    e  => observer.error(e),
                  complete: () => observer.complete(),
                });
              })
              .catch((refreshErr: unknown) => {
                processQueue(refreshErr, null);
                isRefreshing = false;
                auth.logout();
                router.navigateByUrl('/login');
                observer.error(refreshErr);
              });
          },
        });
      })
  );
};
