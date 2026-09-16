import { config } from '../config';

export type Usuario = {
  id: number;
  username: string;
  passwordHash: string;
  rol: string;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
};

export interface UsuariosRepositorio {
  buscarPorUsername(username: string): Promise<Usuario | null>;
  crear(username: string, passwordHash: string, rol: string): Promise<number>;
  registrarFallo(id: number, intentosFallidos: number, bloqueadoHasta: Date | null): Promise<void>;
  reiniciarFallos(id: number): Promise<void>;
  listar(): Promise<Usuario[]>;
}

export class UsernameDuplicadoError extends Error {
  constructor() {
    super('El nombre de usuario ya está registrado.');
  }
}

export const SELECT_USUARIO = `
  SELECT u.id, u.username, u.password_hash, r.nombre AS rol, u.intentos_fallidos, u.bloqueado_hasta
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id`;

let repositorio: Promise<UsuariosRepositorio> | undefined;

/**
 * La conexión se abre de forma diferida: el build de Angular importa server.ts
 * para extraer rutas y no debe tocar la base de datos.
 */
export function obtenerRepositorio(): Promise<UsuariosRepositorio> {
  repositorio ??= (
    config.db.cliente === 'mysql'
      ? import('./mysql.repositorio').then((m) => m.crearRepositorioMysql(config.db.mysql))
      : import('./sqlite.repositorio').then((m) => m.crearRepositorioSqlite(config.db.sqliteRuta))
  ).catch((error: unknown) => {
    repositorio = undefined;
    throw error;
  });

  return repositorio;
}
