import { EUserRole } from '../auth/casl/ability.enum.js';
import type { ISessionUser } from '../auth/session/session-user.interface.js';

/** Contraseña de TODOS los usuarios de desarrollo (documentada en docs/standard/cookies-session.md). */
export const DEV_PASSWORD = 'ticketit-dev';

export const USERS_SEED: ISessionUser[] = [
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001',
    name: 'Marta Admin',
    email: 'marta@ticketit.dev',
    role: EUserRole.ADMIN,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
    name: 'Ana Agente',
    email: 'ana@ticketit.dev',
    role: EUserRole.AGENT,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000003',
    name: 'Víctor Lector',
    email: 'victor@ticketit.dev',
    role: EUserRole.VIEWER,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004',
    name: 'Luis Agente',
    email: 'luis@ticketit.dev',
    role: EUserRole.AGENT,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000005',
    name: 'Sergio Supervisor',
    email: 'sergio@ticketit.dev',
    role: EUserRole.SUPERVISOR,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000006',
    name: 'Rosa Recursos Humanos',
    email: 'rosa@ticketit.dev',
    role: EUserRole.VIEWER,
    avatarIcon: null,
    avatarColor: null,
  },
  {
    uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000007',
    name: 'Aurora Auditora',
    email: 'aurora@ticketit.dev',
    role: EUserRole.AUDITOR,
    avatarIcon: null,
    avatarColor: null,
  },
];
