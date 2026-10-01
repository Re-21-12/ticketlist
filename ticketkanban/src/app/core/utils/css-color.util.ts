/**
 * Color EFECTIVO de una custom property (`--app-text`) como hex `#rrggbb`, o `null` si no se puede
 * resolver. Se resuelve pintándolo en un elemento de prueba: el navegador ya aplicó el modo
 * oscuro, el color del usuario y cualquier `var()` anidado, así que se mide lo que se ve.
 */
export function resolveCssColor(token: string, host: HTMLElement = document.body): string | null {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computedColorToHex(computed);
}

/** `rgb(16, 185, 129)`, `rgba(…)` o `color(srgb 0.06 0.72 0.5)` → `#10b981`. */
export function computedColorToHex(value: string): string | null {
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  if (rgb) return toHex(rgb.slice(1, 4).map(Number));
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgb) return toHex(srgb.slice(1, 4).map((channel) => Math.round(Number(channel) * 255)));
  return null;
}

function toHex(channels: number[]): string {
  return `#${channels.map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('')}`;
}
