import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { isApiError } from './api-error';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Sends cookies with every request and adds the X-CSRF-TOKEN header to state-changing requests.
 * If the API rejects the token (for example, after it restarted), fetches a new one and retries once.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const request = req.clone({ withCredentials: true });
  if (safeMethods.has(request.method)) return next(request);

  const csrf = inject(CsrfService);
  const send = (token: string) => next(request.clone({ setHeaders: { 'X-CSRF-TOKEN': token } }));
  return from(csrf.getToken()).pipe(
    switchMap(send),
    catchError((error: unknown) =>
      isApiError(error, 400, 'csrf_validation_failed')
        ? from(csrf.refresh()).pipe(switchMap(send))
        : throwError(() => error),
    ),
  );
};

/** A 401 outside the auth endpoints means the session cookie expired: return to the login screen. */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (isApiError(error, 401) && !req.url.startsWith('/api/auth/')) auth.handleSessionExpired();
      return throwError(() => error);
    }),
  );
};
