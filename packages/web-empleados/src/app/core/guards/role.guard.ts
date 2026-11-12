import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@resttek/web-shared';

export const roleGuard = (roles: string[]): CanActivateFn => () => {
  const role = inject(AuthStore).userRole();
  return !!role && roles.includes(role) ? true : inject(Router).createUrlTree(['/']);
};
