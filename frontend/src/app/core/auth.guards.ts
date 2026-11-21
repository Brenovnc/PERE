import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Role } from './auth.models';
import { AuthService } from './auth.service';

/** The login screen is only for visitors; signed-in users go to their own area. */
export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  await auth.ready();
  const user = auth.user();
  return user ? inject(Router).parseUrl(auth.homeFor(user.role)) : true;
};

/** Restricts an area to one role; visitors go to the login screen and other roles to their own area. */
export function roleGuard(role: Role): CanMatchFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ready();
    const user = auth.user();
    if (!user) return router.parseUrl(role === 'STUDENT' ? '/?modo=aluno' : '/');
    return user.role === role ? true : router.parseUrl(auth.homeFor(user.role));
  };
}
