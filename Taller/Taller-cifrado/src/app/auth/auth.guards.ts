import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Los guards solo mejoran la navegación en el navegador. La protección real está en
 * el middleware protegerPaginas de Express, que valida la cookie antes de renderizar.
 */
export const autenticadoGuard: CanActivateFn = async () => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.cargarSesion()) ? true : router.parseUrl('/login');
};

export const invitadoGuard: CanActivateFn = async () => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.cargarSesion()) ? router.parseUrl('/') : true;
};
