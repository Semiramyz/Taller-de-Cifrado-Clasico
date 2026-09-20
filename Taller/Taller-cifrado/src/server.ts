import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import { config } from './backend/config';
import { cabecerasSeguridad, forzarHttps } from './backend/middlewares/https';
import { protegerPaginas } from './backend/middlewares/sesion';
import { adminRutas } from './backend/rutas/admin.rutas';
import { authRutas } from './backend/rutas/auth.rutas';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * Angular SSR valida por su cuenta las cabeceras de proxy, al margen de lo que
 * haga Express: si no se le declara cuales acepta, las descarta con un aviso y
 * reconstruye la URL de la peticion como http, lo que rompe los enlaces
 * absolutos y el canonical de las paginas renderizadas en el servidor.
 *
 * El dominio publico debe figurar ademas en angular.json, en
 * security.allowedHosts; de lo contrario el SSR responde 400 Bad Request a
 * toda peticion cuya cabecera Host no sea localhost.
 */
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders:
    config.https.proxiesDeConfianza > 0
      ? ['x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-for']
      : [],
});

app.disable('x-powered-by');

/**
 * La aplicacion se publica detras de nginx, que es quien termina el TLS y
 * reenvia en claro por el loopback. Sin 'trust proxy' Express veria todas las
 * peticiones como inseguras: req.secure seria siempre false, req.ip devolveria
 * 127.0.0.1 -y el control de fuerza bruta contaria los intentos de todo
 * internet en una sola IP- y la cookie marcada Secure no llegaria a enviarse.
 */
if (config.https.proxiesDeConfianza > 0) {
  app.set('trust proxy', config.https.proxiesDeConfianza);
}

app.use(cabecerasSeguridad);
app.use(forzarHttps);
app.use(cookieParser());

/**
 * API de autenticación: toda la validación de credenciales, el hashing con BCrypt
 * y el control de intentos fallidos ocurre aquí, en el servidor.
 */
app.use(
  '/api',
  express.json({ limit: '10kb' }),
  express.urlencoded({ extended: false, limit: '10kb' }),
);
app.use('/api/auth', authRutas);
app.use('/api/admin', adminRutas);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});
app.use('/api', (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: 'Solicitud inválida.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Sin sesión válida no se renderiza la página del taller: redirige a /login.
 */
app.use(protegerPaginas);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
    if (config.https.forzar) {
      console.log(`TLS delegado en nginx; se exige https para ${config.https.dominio}.`);
    }
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
