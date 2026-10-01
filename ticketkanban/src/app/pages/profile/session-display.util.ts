export interface ISessionDisplay {
  /** «Chrome en Windows». */
  label: string;
  /** Clase `pi pi-*`: móvil o escritorio. */
  icon: string;
}

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/**
 * Nombre legible del dispositivo a partir del `User-Agent` (dato del cliente: solo para mostrar, nunca
 * para decidir nada de seguridad). El orden importa: Edge y Opera también dicen «Chrome».
 */
export function describeUserAgent(userAgent: string): ISessionDisplay {
  const browser = BROWSERS.find(([test]) => test.test(userAgent))?.[1];
  const system = SYSTEMS.find(([test]) => test.test(userAgent))?.[1];
  const mobile = /Android|iPhone|iPad|iPod|Mobile/.test(userAgent);
  const label =
    browser && system ? `${browser} en ${system}` : (browser ?? system ?? 'Dispositivo desconocido');
  return { label, icon: mobile ? 'pi pi-mobile' : 'pi pi-desktop' };
}
