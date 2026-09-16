import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

type RegistroIP = {
  conteo: number;
  primerIntento: number;
  bloqueadoHasta: number;
};

const { maxIntentos, ventanaMs, bloqueoMs } = config.fuerzaBruta;

/** Almacenamiento temporal en memoria (en producción con varias instancias: Redis). */
const intentosIP = new Map<string, RegistroIP>();

function obtenerIP(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'desconocida';
}

export function responderBloqueoIP(res: Response, msRestantes: number): Response {
  const segundosRestantes = Math.ceil(msRestantes / 1000);
  res.set('Retry-After', String(segundosRestantes));
  return res.status(429).json({
    error: `Demasiados intentos fallidos. Su IP ha sido bloqueada temporalmente. Intente de nuevo en ${segundosRestantes} segundos.`,
    segundosRestantes,
  });
}

/**
 * Se ejecuta antes del controlador de /login: si la IP está bloqueada corta la
 * solicitud con 429 Too Many Requests sin llegar a consultar la base de datos.
 */
export function proteccionFuerzaBruta(req: Request, res: Response, next: NextFunction) {
  const ip = obtenerIP(req);
  const ahora = Date.now();

  let registro = intentosIP.get(ip);
  if (!registro) {
    registro = { conteo: 0, primerIntento: ahora, bloqueadoHasta: 0 };
    intentosIP.set(ip, registro);
  }

  if (registro.bloqueadoHasta > ahora) {
    return responderBloqueoIP(res, registro.bloqueadoHasta - ahora);
  }

  // Reiniciar conteo si expiró la ventana de tiempo
  if (ahora - registro.primerIntento > ventanaMs) {
    registro.conteo = 0;
    registro.primerIntento = ahora;
  }

  res.locals['registroIP'] = registro;
  return next();
}

/** Lo llama el controlador cuando las credenciales no son válidas. */
export function registrarIntentoFallido(res: Response): {
  bloqueada: boolean;
  intentosRestantes: number;
} {
  const registro = res.locals['registroIP'] as RegistroIP;
  const ahora = Date.now();

  if (registro.conteo === 0) {
    registro.primerIntento = ahora;
  }
  registro.conteo += 1;

  if (registro.conteo >= maxIntentos) {
    registro.bloqueadoHasta = ahora + bloqueoMs;
    registro.conteo = 0;
    return { bloqueada: true, intentosRestantes: 0 };
  }

  return { bloqueada: false, intentosRestantes: maxIntentos - registro.conteo };
}

/** Un login exitoso rompe la racha de intentos fallidos consecutivos. */
export function reiniciarIntentos(res: Response): void {
  const registro = res.locals['registroIP'] as RegistroIP;
  registro.conteo = 0;
}

setInterval(() => {
  const ahora = Date.now();
  for (const [ip, registro] of intentosIP) {
    if (registro.bloqueadoHasta <= ahora && ahora - registro.primerIntento > ventanaMs) {
      intentosIP.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();
