import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, mensajeDeError } from '../auth/auth.service';

type Modo = 'login' | 'registro';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private temporizador: ReturnType<typeof setInterval> | undefined;

  protected readonly modo = signal<Modo>('login');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');
  protected readonly segundosBloqueo = signal(0);

  protected cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.password.set('');
    this.error.set('');
    this.exito.set('');
  }

  protected onUsernameInput(event: Event): void {
    this.username.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected async enviar(event: Event): Promise<void> {
    event.preventDefault();
    if (this.cargando() || this.segundosBloqueo() > 0) {
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    this.exito.set('');

    try {
      if (this.modo() === 'login') {
        await this.auth.login(this.username(), this.password());
        await this.router.navigateByUrl('/');
      } else {
        const mensaje = await this.auth.registrar(this.username(), this.password());
        this.cambiarModo('login');
        this.exito.set(`${mensaje} Ya puede iniciar sesión.`);
      }
    } catch (error) {
      this.password.set('');
      this.error.set(mensajeDeError(error));

      const segundos = (error as HttpErrorResponse).error?.segundosRestantes;
      if (error instanceof HttpErrorResponse && error.status === 429 && typeof segundos === 'number') {
        this.iniciarCuentaRegresiva(segundos);
      }
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.temporizador);
  }

  private iniciarCuentaRegresiva(segundos: number): void {
    clearInterval(this.temporizador);
    this.segundosBloqueo.set(segundos);
    this.temporizador = setInterval(() => {
      const restantes = this.segundosBloqueo() - 1;
      this.segundosBloqueo.set(Math.max(restantes, 0));
      if (restantes <= 0) {
        clearInterval(this.temporizador);
        this.error.set('');
      }
    }, 1000);
  }
}
