import { RenderMode, ServerRoute } from '@angular/ssr';

// Render por solicitud (no prerender): así el servidor valida la sesión antes de entregar cada página.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
