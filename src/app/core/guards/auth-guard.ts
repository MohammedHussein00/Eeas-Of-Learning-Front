import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';

export const authGuardFn: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // if (!auth.isAuthenticated()) {
  //   return router.createUrlTree(['/login'], { queryParams: { from: state.url } });
  // }

  // const allowedRoles = route.data?.['roles'] as string[] | undefined;
  // const userRole = auth.getRole() || '';

  // if (allowedRoles && !allowedRoles.includes(userRole)) {
  //   return router.createUrlTree(['/unauthorized']);
  // }

  return true;
};