import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import { protegerPaginas } from './backend/middlewares/sesion';
import { adminRutas } from './backend/rutas/admin.rutas';
import { authRutas } from './backend/rutas/auth.rutas';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
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
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
