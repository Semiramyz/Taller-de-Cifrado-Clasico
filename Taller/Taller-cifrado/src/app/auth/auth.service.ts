import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type UsuarioSesion = {
  username: string;
  rol: string;
};

export type UsuarioAdmin = {
  id: number;
  username: string;
  rol: string;
  hashVisible: string;
  intentosFallidos: number;
  bloqueadoHasta: string | null;
};

/**
 * Cliente de la API de autenticación. No toma decisiones de seguridad: solo envía
 * las credenciales y refleja lo que responde el servidor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly usuario = signal<UsuarioSesion | null>(null);

  async cargarSesion(): Promise<UsuarioSesion | null> {
    try {
      const { usuario } = await firstValueFrom(
        this.http.get<{ usuario: UsuarioSesion }>('/api/auth/sesion'),
      );
      this.usuario.set(usuario);
    } catch {
      this.usuario.set(null);
    }
    return this.usuario();
  }

  async login(username: string, password: string): Promise<void> {
    const { usuario } = await firstValueFrom(
      this.http.post<{ usuario: UsuarioSesion }>('/api/auth/login', { username, password }),
    );
    this.usuario.set(usuario);
  }

  async registrar(username: string, password: string): Promise<string> {
    const { mensaje } = await firstValueFrom(
      this.http.post<{ mensaje: string }>('/api/auth/registro', { username, password }),
    );
    return mensaje;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.usuario.set(null);
    }
  }

  async listarUsuarios(): Promise<UsuarioAdmin[]> {
    const { usuarios } = await firstValueFrom(
      this.http.get<{ usuarios: UsuarioAdmin[] }>('/api/admin/usuarios'),
    );
    return usuarios;
  }

  async desbloquear(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`/api/admin/usuarios/${id}/desbloquear`, {}));
  }
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { error?: string } | null;
    if (cuerpo?.error) {
      return cuerpo.error;
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
  }
  return 'Ocurrió un error inesperado.';
}
