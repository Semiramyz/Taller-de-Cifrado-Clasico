import { config } from '../config';
import {
  obtenerRepositorio,
  UsernameDuplicadoError,
  type Usuario,
} from '../db/usuarios.repositorio';
import { generarHash, verificarPassword } from './password.servicio';

export type ResultadoLogin =
  | { tipo: 'exito'; usuario: Usuario }
  | { tipo: 'credenciales-invalidas' }
  | { tipo: 'cuenta-bloqueada'; segundosRestantes: number };

let hashFicticio: Promise<string> | undefined;

/**
 * Si el usuario no existe igual se ejecuta un bcrypt.compare, para que el tiempo de
 * respuesta no revele qué nombres de usuario están registrados.
 */
function obtenerHashFicticio(): Promise<string> {
  hashFicticio ??= generarHash('usuario-inexistente');
  return hashFicticio;
}

export async function autenticar(username: string, password: string): Promise<ResultadoLogin> {
  const repositorio = await obtenerRepositorio();
  const usuario = await repositorio.buscarPorUsername(username);

  if (!usuario) {
    await verificarPassword(password, await obtenerHashFicticio());
    return { tipo: 'credenciales-invalidas' };
  }

  const ahora = Date.now();
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta.getTime() > ahora) {
    return {
      tipo: 'cuenta-bloqueada',
      segundosRestantes: Math.ceil((usuario.bloqueadoHasta.getTime() - ahora) / 1000),
    };
  }

  if (await verificarPassword(password, usuario.passwordHash)) {
    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await repositorio.reiniciarFallos(usuario.id);
    }
    return { tipo: 'exito', usuario };
  }

  // Si había un bloqueo ya vencido, el conteo vuelve a empezar.
  const intentos = (usuario.bloqueadoHasta ? 0 : usuario.intentosFallidos) + 1;
  if (intentos >= config.fuerzaBruta.maxIntentos) {
    await repositorio.registrarFallo(
      usuario.id,
      intentos,
      new Date(ahora + config.fuerzaBruta.bloqueoMs),
    );
    return {
      tipo: 'cuenta-bloqueada',
      segundosRestantes: Math.ceil(config.fuerzaBruta.bloqueoMs / 1000),
    };
  }

  await repositorio.registrarFallo(usuario.id, intentos, null);
  return { tipo: 'credenciales-invalidas' };
}

/** Devuelve false si el nombre de usuario ya existe. */
export async function registrarUsuario(username: string, password: string): Promise<boolean> {
  const repositorio = await obtenerRepositorio();
  if (await repositorio.buscarPorUsername(username)) {
    return false;
  }

  try {
    await repositorio.crear(username, await generarHash(password), 'Usuario');
    return true;
  } catch (error) {
    if (error instanceof UsernameDuplicadoError) {
      return false;
    }
    throw error;
  }
}

export async function listarUsuarios(): Promise<Usuario[]> {
  return (await obtenerRepositorio()).listar();
}

export async function desbloquearUsuario(id: number): Promise<void> {
  await (await obtenerRepositorio()).reiniciarFallos(id);
}
