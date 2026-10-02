import { loadEnv } from '../../config/env.schema.js';
import { EUserRole } from '../auth/casl/ability.enum.js';
import { PersistenceService } from '../../database/persistence.service.js';
import { UsersRepository } from './users.repository.js';

// Sin DATABASE_URL la persistencia queda apagada: se prueba solo la siembra de cuentas (como en production, sin demostración).
const PROD = { NODE_ENV: 'test', SEED_DEMO_DATA: 'false' };

const SEED = [
  { name: 'Administrador', email: 'admin@empresa.com', role: 'ADMIN', password: 'Clave-Admin-2026!' },
  { name: 'Supervisor', email: 'supervisor@empresa.com', role: 'SUPERVISOR', password: 'Clave-Super-2026!' },
  { name: 'Soporte', email: 'soporte@empresa.com', role: 'AGENT', password: 'Clave-Soporte-2026!' },
  { name: 'Auditor', email: 'auditor@empresa.com', role: 'AUDITOR', password: 'Clave-Audit-2026!' },
  { name: 'Cliente', email: 'cliente@empresa.com', role: 'VIEWER', password: 'Clave-Cliente-2026!' },
];

describe('UsersRepository · cuentas iniciales de producción', () => {
  const repo = (extra: Record<string, string> = {}) => {
    const env = loadEnv({ ...PROD, SEED_USERS_JSON: JSON.stringify(SEED), ...extra });
    return new UsersRepository(env, new PersistenceService(env)); // sin DATABASE_URL la persistencia queda apagada
  };

  it('siembra una cuenta por rol con SU contraseña, y ninguna cuenta de demostración', () => {
    const users = repo();
    for (const seed of SEED) {
      const user = users.verifyCredentials(seed.email, seed.password);
      expect(user?.role, seed.email).toBe(seed.role);
      expect(users.isEmailVerified(user!.uuid)).toBe(true);
    }
    expect(users.verifyCredentials('marta@ticketit.dev', 'ticketit-dev')).toBeNull(); // la clave pública no existe
    expect(users.verifyCredentials('admin@empresa.com', 'otra-clave')).toBeNull();
  });

  it('el administrador de BOOTSTRAP_* se suma si su correo no está ya en la lista', () => {
    const users = repo({ BOOTSTRAP_ADMIN_EMAIL: 'root@empresa.com', BOOTSTRAP_ADMIN_PASSWORD: 'Clave-Root-2026!!' });
    expect(users.verifyCredentials('root@empresa.com', 'Clave-Root-2026!!')?.role).toBe(EUserRole.ADMIN);
    expect(users.verifyCredentials('admin@empresa.com', 'Clave-Admin-2026!')?.role).toBe(EUserRole.ADMIN);
  });
});
