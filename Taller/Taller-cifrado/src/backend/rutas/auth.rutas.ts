import { Router, type CookieOptions } from 'express';
import { config } from '../config';
import {
  proteccionFuerzaBruta,
  registrarIntentoFallido,
  reiniciarIntentos,
  responderBloqueoIP,
} from '../middlewares/proteccion-fuerza-bruta';
import { requiereSesion } from '../middlewares/sesion';
import { autenticar, registrarUsuario } from '../servicios/auth.servicio';
import { crearSesion, destruirSesion, type Sesion } from '../servicios/sesiones';

const USERNAME_VALIDO = /^[a-z0-9._@-]{3,50}$/;
/** BCrypt solo procesa los primeros 72 bytes de la contraseña. */
const MAX_BYTES_PASSWORD = 72;

const opcionesCookie: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.sesion.cookieSegura,
  path: '/',
};

function leerCredenciales(body: unknown): { username: string; password: string } {
  const datos = (body ?? {}) as Record<string, unknown>;
  const username = datos['username'];
  const password = datos['password'];
  return {
    username: typeof username === 'string' ? username.trim().toLowerCase() : '',
    password: typeof password === 'string' ? password : '',
  };
}

function validarRegistro(username: string, password: string): string | null {
  if (!USERNAME_VALIDO.test(username)) {
    return 'El usuario debe tener entre 3 y 50 caracteres (letras, números, . _ @ -).';
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.';
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES_PASSWORD) {
    return `La contraseña no puede superar ${MAX_BYTES_PASSWORD} bytes.`;
  }
  return null;
}

export const authRutas = Router();

authRutas.post('/login', proteccionFuerzaBruta, async (req, res) => {
  const { username, password } = leerCredenciales(req.body);
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  const resultado = await autenticar(username, password);

  if (resultado.tipo === 'exito') {
    reiniciarIntentos(res);
    // Se descarta cualquier sesión previa para evitar fijación de sesión.
    destruirSesion(req.cookies?.[config.sesion.nombreCookie]);
    const token = crearSesion(resultado.usuario);
    res.cookie(config.sesion.nombreCookie, token, {
      ...opcionesCookie,
      maxAge: config.sesion.duracionMs,
    });
    return res.json({
      usuario: { username: resultado.usuario.username, rol: resultado.usuario.rol },
    });
  }

  const fallo = registrarIntentoFallido(res);
  if (fallo.bloqueada) {
    return responderBloqueoIP(res, config.fuerzaBruta.bloqueoMs);
  }

  if (resultado.tipo === 'cuenta-bloqueada') {
    return res.status(423).json({
      error: `La cuenta está bloqueada temporalmente por múltiples intentos fallidos. Intente de nuevo en ${resultado.segundosRestantes} segundos.`,
      segundosRestantes: resultado.segundosRestantes,
    });
  }

  return res.status(401).json({
    error: `Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: ${fallo.intentosRestantes}.`,
    intentosRestantes: fallo.intentosRestantes,
  });
});

authRutas.post('/registro', async (req, res) => {
  const { username, password } = leerCredenciales(req.body);
  const error = validarRegistro(username, password);
  if (error) {
    return res.status(400).json({ error });
  }

  if (!(await registrarUsuario(username, password))) {
    return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
  }

  return res.status(201).json({ mensaje: 'Usuario registrado correctamente.' });
});

authRutas.get('/sesion', requiereSesion, (_req, res) => {
  const sesion = res.locals['sesion'] as Sesion;
  res.json({ usuario: { username: sesion.username, rol: sesion.rol } });
});

authRutas.post('/logout', (req, res) => {
  destruirSesion(req.cookies?.[config.sesion.nombreCookie]);
  res.clearCookie(config.sesion.nombreCookie, opcionesCookie);
  res.json({ mensaje: 'Sesión cerrada.' });
});
