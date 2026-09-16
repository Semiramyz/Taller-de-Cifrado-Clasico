import mysql from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  SELECT_USUARIO,
  UsernameDuplicadoError,
  type Usuario,
  type UsuariosRepositorio,
} from './usuarios.repositorio';

type OpcionesMysql = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function mapear(fila: RowDataPacket): Usuario {
  return {
    id: fila['id'],
    username: fila['username'],
    passwordHash: fila['password_hash'],
    rol: fila['rol'],
    intentosFallidos: fila['intentos_fallidos'],
    bloqueadoHasta: fila['bloqueado_hasta'] ? new Date(fila['bloqueado_hasta']) : null,
  };
}

export function crearRepositorioMysql(opciones: OpcionesMysql): UsuariosRepositorio {
  const pool = mysql.createPool({ ...opciones, connectionLimit: 10 });

  return {
    async buscarPorUsername(username) {
      const [filas] = await pool.execute<RowDataPacket[]>(`${SELECT_USUARIO} WHERE u.username = ?`, [
        username,
      ]);
      return filas[0] ? mapear(filas[0]) : null;
    },

    async crear(username, passwordHash, rol) {
      try {
        const [resultado] = await pool.execute<ResultSetHeader>(
          'INSERT INTO usuarios (username, password_hash, rol_id) SELECT ?, ?, id FROM roles WHERE nombre = ?',
          [username, passwordHash, rol],
        );
        if (resultado.affectedRows === 0) {
          throw new Error(`El rol "${rol}" no existe.`);
        }
        return resultado.insertId;
      } catch (error) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new UsernameDuplicadoError();
        }
        throw error;
      }
    },

    async registrarFallo(id, intentosFallidos, bloqueadoHasta) {
      await pool.execute('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?', [
        intentosFallidos,
        bloqueadoHasta,
        id,
      ]);
    },

    async reiniciarFallos(id) {
      await pool.execute(
        'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
        [id],
      );
    },

    async listar() {
      const [filas] = await pool.query<RowDataPacket[]>(`${SELECT_USUARIO} ORDER BY u.id`);
      return filas.map(mapear);
    },
  };
}
