import type { NextFunction, Request, Response } from 'express';
import { extname } from 'node:path';
import { config } from '../config';
import { obtenerSesion, type Sesion } from '../servicios/sesiones';

export function sesionActual(req: Request): Sesion | null {
  return obtenerSesion(req.cookies?.[config.sesion.nombreCookie]);
}

export function requiereSesion(req: Request, res: Response, next: NextFunction) {
  const sesion = sesionActual(req);
  if (!sesion) {
    return res.status(401).json({ error: 'Debe iniciar sesión.' });
  }
  res.locals['sesion'] = sesion;
  return next();
}

/** Debe usarse después de requiereSesion. */
export function requiereRol(rol: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const sesion = res.locals['sesion'] as Sesion | undefined;
    if (sesion?.rol !== rol) {
      return res.status(403).json({ error: 'No tiene permisos para este recurso.' });
    }
    return next();
  };
}

/**
 * Protege las páginas de Angular antes de renderizarlas: sin sesión válida el servidor
 * redirige a /login, sin importar lo que haga el código del navegador.
 */
export function protegerPaginas(req: Request, res: Response, next: NextFunction) {
  const esPagina =
    req.method === 'GET' &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/@') &&
    !extname(req.path);
  if (!esPagina) {
    return next();
  }

  const autenticado = sesionActual(req) !== null;
  if (req.path === '/login') {
    return autenticado ? res.redirect('/') : next();
  }
  return autenticado ? next() : res.redirect('/login');
}
