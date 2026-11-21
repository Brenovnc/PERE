import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { csrfInterceptor, unauthorizedInterceptor } from './core/http.interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Component input binding lets route data (e.g. the placeholder title) arrive as inputs.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([csrfInterceptor, unauthorizedInterceptor])),
  ],
};
