import { DOCUMENT, inject, Service, signal } from '@angular/core';
import { DARK_MODE_CLASS, THEME_STORAGE_KEY } from './theme.constants';

/**
 * Modo claro/oscuro elegido por el usuario (port de `ThemeService` de wallet-api). Persiste en
 * localStorage; el primer valor lo aplica un script inline en `index.html` con la misma clave
 * para que no haya destello antes de que Angular arranque. Sin preferencia guardada, sigue al SO.
 */
@Service()
export class ThemeService {
  private readonly _document = inject(DOCUMENT);

  private readonly $_isDark = signal(this.readInitial());
  readonly $isDark = this.$_isDark.asReadonly();

  constructor() {
    this.applyToDom(this.$_isDark());
  }

  toggle(): void {
    this.set(!this.$_isDark());
  }

  set(isDark: boolean): void {
    this.$_isDark.set(isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Modo privado / storage bloqueado: la preferencia vale solo para esta sesión.
    }
    this.applyToDom(isDark);
  }

  private applyToDom(isDark: boolean): void {
    const root = this._document.documentElement;
    root.classList.toggle(DARK_MODE_CLASS, isDark);
    // Controles nativos (scrollbars, date inputs) acordes al tema.
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }

  private readInitial(): boolean {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) return stored === 'dark';
    } catch {
      // sin storage → sigue al SO
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
