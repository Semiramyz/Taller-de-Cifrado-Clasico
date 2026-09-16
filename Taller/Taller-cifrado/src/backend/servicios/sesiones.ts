import { randomBytes } from 'node:crypto';
import { config } from '../config';
import type { Usuario } from '../db/usuarios.repositorio';

export type Sesion = {
  usuarioId: number;
  username: string;
  rol: string;
  expiraEn: number;
};

/** Sesiones del lado del servidor: el navegador solo recibe un token aleatorio opaco. */
const sesiones = new Map<string, Sesion>();

export function crearSesion(usuario: Usuario): string {
  const token = randomBytes(32).toString('base64url');
  sesiones.set(token, {
    usuarioId: usuario.id,
    username: usuario.username,
    rol: usuario.rol,
    expiraEn: Date.now() + config.sesion.duracionMs,
  });
  return token;
}

export function obtenerSesion(token: unknown): Sesion | null {
  if (typeof token !== 'string') {
    return null;
  }

  const sesion = sesiones.get(token);
  if (!sesion) {
    return null;
  }

  if (sesion.expiraEn <= Date.now()) {
    sesiones.delete(token);
    return null;
  }

  return sesion;
}

export function destruirSesion(token: unknown): void {
  if (typeof token === 'string') {
    sesiones.delete(token);
  }
}

setInterval(() => {
  const ahora = Date.now();
  for (const [token, sesion] of sesiones) {
    if (sesion.expiraEn <= ahora) {
      sesiones.delete(token);
    }
  }
}, 10 * 60 * 1000).unref();
