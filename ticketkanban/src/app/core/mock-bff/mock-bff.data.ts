import type { z } from 'zod';
import { EAbility, EUserRole } from '../casl/ability.enum';
import type { ShellSchema } from '../session/session.schema';
import type { TicketSchema } from '../../pages/tickets/ticket.schema';

type TShellInput = z.input<typeof ShellSchema>;

/** Tickets "persistidos" del mock (JSON crudo, fechas como string ISO como llegan por HTTP). */
export const MOCK_TICKETS: z.input<typeof TicketSchema>[] = [
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
    code: 'TCK-001',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
    title: 'El login con Google devuelve 500',
    description: 'Ocurre solo con cuentas de Workspace.',
    category: 'bug',
    priority: 'critical',
    status: 'in_progress',
    assigneeEmail: 'ana@ticketit.dev',
    estimateHours: 6,
    dueDate: '2026-10-02',
    notifyReporter: true,
    createdAt: '2026-09-20T15:00:00Z',
  },
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02',
    code: 'TCK-002',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001',
    title: 'Exportar tablero a CSV',
    description: '',
    category: 'feature',
    priority: 'medium',
    status: 'todo',
    assigneeEmail: '',
    estimateHours: null,
    dueDate: null,
    notifyReporter: false,
    createdAt: '2026-09-22T10:30:00Z',
  },
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e03',
    code: 'TCK-003',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004',
    title: 'Migrar dominio del correo de soporte',
    description: 'Cambio de proveedor SMTP.',
    category: 'other',
    otherCategoryDetail: 'Infraestructura',
    priority: 'low',
    status: 'done',
    assigneeEmail: 'luis@ticketit.dev',
    estimateHours: 3,
    dueDate: '2026-09-25',
    notifyReporter: true,
    createdAt: '2026-09-18T08:00:00Z',
  },
];

const MENU: TShellInput['menu'] = [
  { key: 'board', label: 'Tablero', route: '/tickets', group: 'Tickets', subject: 'Ticket' },
  { key: 'list', label: 'Listado', route: '/tickets/list', group: 'Tickets', subject: 'Ticket' },
  {
    key: 'new-ticket',
    label: 'Nuevo ticket',
    route: '/tickets/new',
    group: 'Tickets',
    subject: 'Ticket',
    requiredAction: EAbility.CREATE,
  },
  { key: 'appearance', label: 'Apariencia', route: '/appearance', group: 'Preferencias' },
  { key: 'profile', label: 'Mi perfil', route: '/profile', group: 'Preferencias' },
  { key: 'style-guide', label: 'Guía de estilos', route: '/style-guide', group: 'Preferencias' },
];

/** Reglas de TITULAR (igual que `CaslAbilityFactory.titularRules`): sobre lo suyo siempre puede. */
function titularRules(userUuid: string): TShellInput['abilityRules'] {
  const conditions = { ownerUuid: userUuid };
  return [EAbility.READ, EAbility.UPDATE, EAbility.DELETE, EAbility.RESTORE].map((action) => ({
    action,
    subject: 'Ticket' as const,
    conditions,
  }));
}

/**
 * Sesión por usuario sembrado (mismos usuarios que ticketlistbe `users.seed.ts`). Las reglas son
 * lo que resolvería el backend (`CaslAbilityFactory`): RBAC del rol + titular. El AGENTE muestra
 * una regla CON CONDICIONES: solo edita tickets asignados a su correo o de los que es titular.
 */
export const MOCK_SHELLS: Record<EUserRole, TShellInput> = {
  [EUserRole.ADMIN]: {
    user: {
      uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001',
      name: 'Marta Admin',
      email: 'marta@ticketit.dev',
      role: EUserRole.ADMIN,
      avatarIcon: null,
      avatarColor: null,
    },
    abilityRules: [{ action: EAbility.MANAGE, subject: 'all' }],
    menu: MENU,
  },
  [EUserRole.AGENT]: {
    user: {
      uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
      name: 'Ana Agente',
      email: 'ana@ticketit.dev',
      role: EUserRole.AGENT,
      avatarIcon: null,
      avatarColor: null,
    },
    abilityRules: [
      { action: EAbility.READ, subject: 'Ticket' },
      { action: EAbility.CREATE, subject: 'Ticket' },
      {
        action: EAbility.UPDATE,
        subject: 'Ticket',
        conditions: { assigneeEmail: 'ana@ticketit.dev' },
      },
      ...titularRules('0b8a5f6e-1c2d-4e3f-8a9b-000000000002'),
    ],
    menu: MENU,
  },
  [EUserRole.VIEWER]: {
    user: {
      uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000003',
      name: 'Víctor Lector',
      email: 'victor@ticketit.dev',
      role: EUserRole.VIEWER,
      avatarIcon: null,
      avatarColor: null,
    },
    abilityRules: [
      { action: EAbility.READ, subject: 'Ticket' },
      ...titularRules('0b8a5f6e-1c2d-4e3f-8a9b-000000000003'),
    ],
    menu: MENU,
  },
};
