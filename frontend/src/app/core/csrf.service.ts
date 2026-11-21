import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Keeps the antiforgery token required by the API on POST/PUT/PATCH/DELETE.
 * The token is tied to the signed-in user, so it must be refreshed after login and logout.
 */
@Injectable({ providedIn: 'root' })
export class CsrfService {
  private readonly http = inject(HttpClient);
  private token: Promise<string> | null = null;

  getToken(): Promise<string> {
    return this.token ?? this.refresh();
  }

  refresh(): Promise<string> {
    const request = firstValueFrom(this.http.get<{ token: string }>('/api/auth/csrf')).then(
      (r) => r.token,
    );
    // Concurrent callers share the same request; a failed request is not cached.
    this.token = request.catch((error: unknown) => {
      this.token = null;
      throw error;
    });
    return this.token;
  }
}
