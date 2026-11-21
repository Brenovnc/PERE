import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage, isApiError } from './api-error';
import { AuthenticatedUser, AuthMode, Role } from './auth.models';
import { CsrfService } from './csrf.service';

const endpoints: Record<AuthMode, { url: string; fields: string[] }> = {
  'teacher-login': { url: '/api/auth/teachers/login', fields: ['email', 'password'] },
  'teacher-register': {
    url: '/api/auth/teachers/register',
    fields: ['name', 'email', 'password', 'confirmPassword'],
  },
  'student-login': { url: '/api/auth/students/login', fields: ['email', 'password'] },
  'student-register': {
    url: '/api/auth/students/register',
    fields: ['name', 'email', 'password', 'confirmPassword'],
  },
};

/** Who is signed in. The session lives in an HTTP-only cookie; this service only mirrors it. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly csrf = inject(CsrfService);
  private readonly router = inject(Router);
  private loading: Promise<void> | null = null;

  readonly user = signal<AuthenticatedUser | null>(null);
  /** Message shown on the login screen (session ended, expired, API unreachable). */
  readonly notice = signal('');

  /** Loads the current user once; route guards wait for it before deciding. */
  ready(): Promise<void> {
    this.loading ??= this.loadCurrentUser();
    return this.loading;
  }

  async authenticate(mode: AuthMode, fields: Record<string, string>): Promise<AuthenticatedUser> {
    const endpoint = endpoints[mode];
    const body = Object.fromEntries(endpoint.fields.map((name) => [name, fields[name] ?? '']));
    const user = await firstValueFrom(this.http.post<AuthenticatedUser>(endpoint.url, body));
    this.user.set(user);
    this.notice.set('');
    await this.csrf.refresh();
    return user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', null));
    } catch (error) {
      // A 401 means the cookie had already expired: the user is signed out anyway.
      if (!isApiError(error, 401)) {
        this.notice.set(errorMessage(error, 'Não foi possível encerrar a sessão.'));
        return;
      }
    }
    this.notice.set('Sessão encerrada.');
    await this.signOutLocally();
  }

  handleSessionExpired(): void {
    if (!this.user()) return;
    this.notice.set('Sua sessão expirou. Entre novamente.');
    void this.signOutLocally();
  }

  homeFor(role: Role): string {
    return role === 'TEACHER' ? '/teacher/home' : '/student';
  }

  private async signOutLocally(): Promise<void> {
    this.user.set(null);
    await this.router.navigateByUrl('/');
    await this.csrf.refresh().catch(() => undefined);
  }

  private async loadCurrentUser(): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.http.get<AuthenticatedUser>('/api/auth/me')));
    } catch (error) {
      this.user.set(null);
      if (!isApiError(error, 401))
        this.notice.set(errorMessage(error, 'Não foi possível conectar à API.'));
    }
  }
}
