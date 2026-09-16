import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  SELECT_USUARIO,
  UsernameDuplicadoError,
  type Usuario,
  type UsuariosRepositorio,
} from './usuarios.repositorio';

type FilaUsuario = {
  id: number;
  username: string;
  password_hash: string;
  rol: string;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
};

function mapear(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    username: fila.username,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta ? new Date(fila.bloqueado_hasta) : null,
  };
}

export function crearRepositorioSqlite(ruta: string): UsuariosRepositorio {
  // getBuiltinModule evita que el bundler de Angular reescriba "node:sqlite" como paquete npm.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

  mkdirSync(dirname(resolve(ruta)), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON;');

  const inicializada = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'`)
    .get();
  if (!inicializada) {
    db.exec(readFileSync(resolve('database/schema.sqlite.sql'), 'utf8'));
  }

  const buscar = db.prepare(`${SELECT_USUARIO} WHERE u.username = ?`);
  const insertar = db.prepare(
    'INSERT INTO usuarios (username, password_hash, rol_id) SELECT ?, ?, id FROM roles WHERE nombre = ?',
  );
  const actualizarFallos = db.prepare(
    'UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
  );
  const listar = db.prepare(`${SELECT_USUARIO} ORDER BY u.id`);

  return {
    async buscarPorUsername(username) {
      const fila = buscar.get(username) as FilaUsuario | undefined;
      return fila ? mapear(fila) : null;
    },

    async crear(username, passwordHash, rol) {
      try {
        const resultado = insertar.run(username, passwordHash, rol);
        if (resultado.changes === 0) {
          throw new Error(`El rol "${rol}" no existe.`);
        }
        return Number(resultado.lastInsertRowid);
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          throw new UsernameDuplicadoError();
        }
        throw error;
      }
    },

    async registrarFallo(id, intentosFallidos, bloqueadoHasta) {
      actualizarFallos.run(intentosFallidos, bloqueadoHasta?.toISOString() ?? null, id);
    },

    async reiniciarFallos(id) {
      actualizarFallos.run(0, null, id);
    },

    async listar() {
      return (listar.all() as FilaUsuario[]).map(mapear);
    },
  };
}
