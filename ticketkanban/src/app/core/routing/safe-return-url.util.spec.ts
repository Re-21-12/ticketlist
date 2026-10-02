import { DEFAULT_RETURN_URL, safeReturnUrl } from './safe-return-url.util';

/** `\` — se arma con su código para que ningún editor ni escape de cadena la altere. */
const BACKSLASH = String.fromCharCode(92);

describe('safeReturnUrl (evita el open redirect del inicio de sesión)', () => {
  it('acepta rutas internas, con subrutas y query', () => {
    expect(safeReturnUrl('/tickets')).toBe('/tickets');
    expect(safeReturnUrl('/tickets/list?page=2')).toBe('/tickets/list?page=2');
    expect(safeReturnUrl('/profile?tab=sessions')).toBe('/profile?tab=sessions');
  });

  it('sin valor o vacío → destino por defecto', () => {
    expect(safeReturnUrl(null)).toBe(DEFAULT_RETURN_URL);
    expect(safeReturnUrl(undefined)).toBe(DEFAULT_RETURN_URL);
    expect(safeReturnUrl('')).toBe(DEFAULT_RETURN_URL);
  });

  it.each([
    ['https://sitio-malo.com'],
    ['//sitio-malo.com'],
    ['/' + BACKSLASH + 'sitio-malo.com'],
    ['javascript:alert(1)'],
    ['tickets'],
    ['/tickets\nSet-Cookie: x=1'],
    ['/a' + BACKSLASH + 'b'],
  ])('rechaza %s', (candidate) => {
    expect(safeReturnUrl(candidate)).toBe(DEFAULT_RETURN_URL);
  });

  it('no vuelve a una pantalla de acceso (evita el bucle sign-in → sign-in)', () => {
    for (const path of ['/sign-in', '/sign-up', '/forgot-password', '/reset-password?token=x', '/verify-email', '/access']) {
      expect(safeReturnUrl(path)).toBe(DEFAULT_RETURN_URL);
    }
  });
});
