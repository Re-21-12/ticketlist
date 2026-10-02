import { base32Decode, base32Encode, generateTotpSecret, otpauthUrl, totpCode, totpStep, verifyTotp } from './totp.util.js';

// Vectores de RFC 6238 (apéndice B): secreto ASCII «12345678901234567890», SHA-1.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp.util', () => {
  it('base32 ida y vuelta', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('vector RFC 6238 a t=%i', (seconds, expected) => {
    expect(totpCode(RFC_SECRET, totpStep(seconds * 1000), 8)).toBe(expected);
  });

  it('acepta el paso actual y ±1; rechaza más lejos y formatos raros', () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 3), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', now)).toBeNull();
  });

  it('otpauth:// lleva secreto, emisor y periodo', () => {
    const url = otpauthUrl('ABC234', 'ana@ticketit.dev');
    expect(url).toContain('otpauth://totp/Ticketit%3Aana%40ticketit.dev');
    expect(url).toContain('secret=ABC234');
    expect(url).toContain('period=30');
  });
});
