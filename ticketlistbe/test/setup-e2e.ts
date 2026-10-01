import { randomBytes } from 'node:crypto';

/**
 * Aislamiento de los e2e contra Redis REAL: cada prueba usa un prefijo de claves propio, así los
 * contadores de rate limit, las sesiones y los tokens de una prueba no contaminan a la siguiente (ni a
 * la corrida anterior, que sigue viva en Redis hasta que expiran sus claves). Con el almacén en
 * memoria no hace falta, pero es inofensivo. Se registra ANTES que el `beforeEach` de cada spec.
 */
beforeEach(() => {
  process.env['REDIS_KEY_PREFIX'] = `ticketit-test-${randomBytes(4).toString('hex')}:`;
});
