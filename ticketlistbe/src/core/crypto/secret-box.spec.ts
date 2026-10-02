import { openSecret, sealSecret } from './secret-box.js';

const KEY = 'una-clave-de-prueba-de-al-menos-32-caracteres';

describe('secret-box (AES-256-GCM)', () => {
  it('ida y vuelta, y NO guarda el texto en claro', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', KEY);
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(openSecret(sealed, KEY)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('cada cifrado es distinto (IV aleatorio)', () => {
    expect(sealSecret('x', KEY)).not.toBe(sealSecret('x', KEY));
  });

  it('otra clave o un valor alterado no se abren', () => {
    const sealed = sealSecret('secreto', KEY);
    expect(() => openSecret(sealed, 'otra-clave-distinta-de-al-menos-32-caracteres')).toThrow();
    const parts = sealed.split('.');
    parts[3] = Buffer.from('alterado').toString('base64url');
    expect(() => openSecret(parts.join('.'), KEY)).toThrow();
  });
});
