import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService, mensajeDeError, type UsuarioAdmin } from '../auth/auth.service';

@Component({
  selector: 'app-panel-usuarios',
  templateUrl: './panel-usuarios.html',
  styleUrl: './panel-usuarios.css',
})
export class PanelUsuarios implements OnInit {
  private readonly auth = inject(AuthService);

  protected readonly usuarios = signal<UsuarioAdmin[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.auth.listarUsuarios());
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async desbloquear(id: number): Promise<void> {
    try {
      await this.auth.desbloquear(id);
      await this.cargar();
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  protected estaBloqueado(usuario: UsuarioAdmin): boolean {
    return usuario.bloqueadoHasta !== null && new Date(usuario.bloqueadoHasta).getTime() > Date.now();
  }

  protected formatearFecha(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('es-CO') : '—';
  }
}
