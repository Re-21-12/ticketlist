/** Claves de localStorage de la apariencia. `index.html` lee `THEME_STORAGE_KEY` ANTES de que
 *  Angular arranque (evita el destello del tema equivocado) — si cambias el valor, cámbialo allí. */
export const THEME_STORAGE_KEY = 'ticketit_theme';
export const PRIMARY_COLOR_STORAGE_KEY = 'ticketit_primary_color';

/** Clase en `<html>` que activa el modo oscuro — la misma que `darkModeSelector` de optimus-ui. */
export const DARK_MODE_CLASS = 'app-dark';

/** Color de marca por defecto (el esmeralda de Aura), SIEMPRE pasado por el cálculo accesible. */
export const DEFAULT_PRIMARY_HEX = '#10b981';

/** Colores sugeridos en la pantalla de Apariencia (el picker permite cualquiera). */
export const PRIMARY_COLOR_PRESETS: readonly { hex: string; label: string }[] = [
  { hex: '#10b981', label: 'Esmeralda (predeterminado)' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#f43f5e', label: 'Rosa' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#0f766e', label: 'Verde azulado' },
];
