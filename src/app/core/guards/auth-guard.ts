import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';

const HOME_BY_ROLE: Record<string, string> = {
  Admin:   '/dash/dashboard',
  Teacher: '/teacher/dashboard',
  Student: '/student/dashboard',
};

export const authGuardFn: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { from: state.url } });
  }

  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  const userRole = auth.getRole() ?? '';

  if (allowedRoles?.length && !allowedRoles.includes(userRole)) {
    // Send the user to their own area instead of a dead end.
    return router.createUrlTree([HOME_BY_ROLE[userRole] ?? '/login']);
  }

  return true;
};
