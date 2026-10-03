import { loadEnv, parseSeedUsers, persistenceEnabled, seedDemoData } from './env.schema.js';

const PROD = {
  NODE_ENV: 'production',
  SESSION_SECRET: 's'.repeat(40),
  TOTP_ENCRYPTION_KEY: 't'.repeat(40),
  REDIS_URL: 'redis://redis:6379',
  DATABASE_URL: 'postgres://u:p@db:5432/ticketit',
  S3_ENDPOINT: 'minio',
  S3_ACCESS_KEY: 'ticketit',
  S3_SECRET_KEY: 'una-clave-larga-del-bucket',
};

describe('loadEnv · production', () => {
  it('sin datos de demostración exige la contraseña del primer administrador', () => {
    expect(() => loadEnv({ ...PROD })).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/);
    const env = loadEnv({ ...PROD, BOOTSTRAP_ADMIN_PASSWORD: 'Clave-Inicial-2026!' });
    expect(seedDemoData(env)).toBe(false);
    expect(env.BOOTSTRAP_ADMIN_EMAIL).toBe('admin@ticketit.local');
  });

  it('la demostración se pide EXPLÍCITO (SEED_DEMO_DATA=true) y entonces no hace falta el administrador', () => {
    expect(seedDemoData(loadEnv({ ...PROD, SEED_DEMO_DATA: 'true' }))).toBe(true);
  });

  it('una contraseña inicial corta se rechaza', () => {
    expect(() => loadEnv({ ...PROD, BOOTSTRAP_ADMIN_PASSWORD: 'corta' })).toThrow();
  });

  it('production exige el bucket de evidencia (S3_*): sin él los archivos se perderían al reiniciar', () => {
    const base = { ...PROD, BOOTSTRAP_ADMIN_PASSWORD: 'Clave-Inicial-2026!' };
    expect(loadEnv(base).S3_BUCKET).toBe('ticketit-evidence');
    for (const missing of ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
      const { [missing]: _omitted, ...rest } = base as Record<string, string>;
      expect(() => loadEnv(rest as NodeJS.ProcessEnv), missing).toThrow(/S3_ENDPOINT/);
    }
  });

  it('production exige la base de datos y prohíbe borrarla o apagar la persistencia', () => {
    const base = { ...PROD, BOOTSTRAP_ADMIN_PASSWORD: 'Clave-Inicial-2026!' };
    expect(() => loadEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...base, DB_RESET_ON_START: 'true' })).toThrow(/DB_RESET_ON_START/);
    expect(() => loadEnv({ ...base, DB_PERSISTENCE: 'false' })).toThrow(/persistirse/);
    expect(loadEnv(base).DB_AUTO_MIGRATE).toBe(true);
  });

  it('la persistencia va por defecto con DATABASE_URL, salvo en pruebas (NODE_ENV=test) que la piden expresamente', () => {
    const url = 'postgres://u:p@localhost:5432/t';
    expect(persistenceEnabled(loadEnv({ NODE_ENV: 'development', DATABASE_URL: url }))).toBe(true);
    expect(persistenceEnabled(loadEnv({ NODE_ENV: 'development' }))).toBe(false);
    expect(persistenceEnabled(loadEnv({ NODE_ENV: 'test', DATABASE_URL: url }))).toBe(false);
    expect(persistenceEnabled(loadEnv({ NODE_ENV: 'test', DATABASE_URL: url, DB_PERSISTENCE: 'true' }))).toBe(true);
  });

  it('en desarrollo y pruebas la demostración va por defecto', () => {
    expect(seedDemoData(loadEnv({ NODE_ENV: 'development' }))).toBe(true);
    expect(seedDemoData(loadEnv({ NODE_ENV: 'test' }))).toBe(true);
  });

  describe('SEED_USERS_JSON (una cuenta por rol)', () => {
    const users = [
      { name: 'Administrador', email: 'Admin@Empresa.com', role: 'ADMIN', password: 'Clave-Admin-2026!' },
      { name: 'Soporte', email: 'soporte@empresa.com', role: 'AGENT', password: 'Clave-Soporte-2026!' },
    ];

    it('en production alcanza con un ADMIN ahí (no hace falta BOOTSTRAP_ADMIN_PASSWORD) y normaliza el correo', () => {
      const env = loadEnv({ ...PROD, SEED_USERS_JSON: JSON.stringify(users) });
      expect(parseSeedUsers(env.SEED_USERS_JSON).map((u) => u.email)).toEqual(['admin@empresa.com', 'soporte@empresa.com']);
    });

    it('sin ningún ADMIN en la lista ni BOOTSTRAP_ADMIN_PASSWORD no arranca', () => {
      expect(() => loadEnv({ ...PROD, SEED_USERS_JSON: JSON.stringify(users.slice(1)) })).toThrow(/ADMIN/);
    });

    it('rechaza JSON roto, rol desconocido, clave corta y correos repetidos', () => {
      expect(() => parseSeedUsers('{no')).toThrow(/JSON válido/);
      expect(() => parseSeedUsers(JSON.stringify([{ ...users[0], role: 'ROOT' }]))).toThrow(/inválido/);
      expect(() => parseSeedUsers(JSON.stringify([{ ...users[0], password: 'corta' }]))).toThrow(/inválido/);
      expect(() => parseSeedUsers(JSON.stringify([users[0], users[0]]))).toThrow(/repite/);
    });
  });
});
