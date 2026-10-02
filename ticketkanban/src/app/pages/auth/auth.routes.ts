import type { Routes } from '@angular/router';
import { guestOnlyGuard } from '../../core/session/guest.guard';

/**
 * Pantallas de acceso, dentro de `AuthLayout` (tarjeta centrada, sin menú). Iniciar sesión y crear
 * cuenta son solo para quien NO tiene sesión; recuperar y verificar sirven con o sin ella (el enlace
 * del correo puede abrirse en cualquier dispositivo).
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'sign-in',
    title: 'Iniciar sesión',
    canActivate: [guestOnlyGuard],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./sign-in/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'sign-up',
    title: 'Crear cuenta',
    canActivate: [guestOnlyGuard],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./sign-up/sign-up').then((m) => m.SignUp),
  },
  {
    path: 'forgot-password',
    title: 'Recuperar contraseña',
    loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Restablecer contraseña',
    loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'verify-email',
    title: 'Verificar correo',
    loadComponent: () => import('./verify-email/verify-email').then((m) => m.VerifyEmail),
  },
];
