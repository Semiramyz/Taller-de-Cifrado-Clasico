import { Routes } from '@angular/router';
import { autenticadoGuard, invitadoGuard } from './auth/auth.guards';
import { Cifrado } from './cifrado/cifrado';
import { Login } from './login/login';

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
    canActivate: [invitadoGuard],
    title: 'Inicio de sesión seguro',
  },
  {
    path: '',
    component: Cifrado,
    canActivate: [autenticadoGuard],
    title: 'Taller de cifrado clásico',
  },
  { path: '**', redirectTo: '' },
];
