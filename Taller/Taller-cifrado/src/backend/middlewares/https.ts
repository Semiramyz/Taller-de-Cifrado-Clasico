import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * Redirige a HTTPS cualquier peticion que haya llegado en claro.
 *
 * nginx ya devuelve un 301 en el puerto 80, de modo que en el despliegue del
 * taller este middleware no deberia dispararse nunca. Esta aqui como segunda
 * linea de defensa: si algun dia la aplicacion se publicara sin el proxy
 * delante, o si alguien alcanzara el puerto 4000 directamente, el trafico
 * seguiria sin servirse en claro.
 *
 * Para que req.secure sea fiable, server.ts activa 'trust proxy': sin ello
 * Express ignora la cabecera X-Forwarded-Proto que envia nginx y considera
 * insegura toda peticion, lo que produciria un bucle de redirecciones.
 */
export function forzarHttps(req: Request, res: Response, next: NextFunction) {
  if (!config.https.forzar || req.secure) {
    return next();
  }

  // Los metodos distintos de GET/HEAD no se redirigen: un 301 sobre un POST
  // haria que el navegador reenviara el cuerpo -las credenciales- por un canal
  // que ya sabemos inseguro. Se rechaza de plano.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ error: 'Esta operacion requiere HTTPS.' });
  }

  const host = req.headers.host ?? config.https.dominio;
  return res.redirect(301, `https://${host}${req.originalUrl}`);
}

/**
 * Cabeceras de seguridad de la respuesta.
 *
 * Se emiten desde la aplicacion, y no desde nginx, para que viajen con ella
 * en cualquier despliegue y para que no aparezcan duplicadas. La unica
 * excepcion es Strict-Transport-Security, que corresponde a nginx por ser
 * quien termina el TLS.
 */
export function cabecerasSeguridad(_req: Request, res: Response, next: NextFunction) {
  // Impide que el navegador adivine el tipo de un recurso e interprete como
  // script algo que se sirvio como texto.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Ninguna pagina del taller debe poder incrustarse en un marco ajeno
  // (defensa contra clickjacking sobre el formulario de inicio de sesion).
  res.setHeader('X-Frame-Options', 'DENY');
  // Al salir hacia otro sitio solo se revela el origen, nunca la ruta completa.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  return next();
}
