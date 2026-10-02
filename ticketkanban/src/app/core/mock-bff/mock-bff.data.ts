import type { z } from 'zod';
import { EAbility, EUserRole } from '../casl/ability.enum';
import type { ShellSchema } from '../session/session.schema';
import type { TTicketCategory, TTicketComplexity, TTicketStatus, TTicketType } from '../../pages/tickets/ticket.types';

type TShellInput = z.input<typeof ShellSchema>;

/** Ticket "persistido" del mock: lo que guarda el servidor; la respuesta (`present`) le suma lo derivado. */
export interface IMockTicket {
  uuid: string;
  code: string;
  ownerUuid: string;
  title: string;
  description: string;
  type: TTicketType;
  category: TTicketCategory;
  /** Departamento de origen (código del catálogo `ticket-department`; `it` = interno de TI). */
  department: string;
  /** Solo el equipo la fija. */
  complexity: TTicketComplexity | null;
  /** Desde cuándo está asignado o en curso (arranca el reloj de la tarjeta). */
  attendedSince: string | null;
  otherCategoryDetail?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: TTicketStatus;
  assigneeEmail: string;
  estimateHours: number | null;
  dueDate: string | null;
  notifyReporter: boolean;
  resolution: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  createdAt: string;
}

/** Los tres tickets de siempre (mismos que `tickets.seed.ts` del backend). */
export const MOCK_TICKETS: IMockTicket[] = [
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01',
    code: 'TCK-001',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002',
    title: 'El login con Google devuelve 500',
    description: 'Ocurre solo con cuentas de Workspace.',
    department: 'hr',
    type: 'incident',
    category: 'access',
    complexity: 'moderate',
    attendedSince: '2026-09-20T16:00:00Z',
    priority: 'critical',
    status: 'in_progress',
    assigneeEmail: 'ana@ticketit.dev',
    estimateHours: 6,
    dueDate: '2026-10-02',
    notifyReporter: true,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    createdAt: '2026-09-20T15:00:00Z',
  },
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02',
    code: 'TCK-002',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000001',
    title: 'Exportar tablero a CSV',
    description: '',
    department: 'it',
    type: 'improvement',
    category: 'software',
    complexity: null,
    attendedSince: null,
    priority: 'medium',
    status: 'new',
    assigneeEmail: '',
    estimateHours: null,
    dueDate: null,
    notifyReporter: false,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    createdAt: '2026-09-22T10:30:00Z',
  },
  {
    uuid: '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e03',
    code: 'TCK-003',
    ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000004',
    title: 'Migrar dominio del correo de soporte',
    description: 'Cambio de proveedor SMTP.',
    department: 'finance',
    type: 'service_request',
    category: 'other',
    complexity: 'simple',
    attendedSince: null,
    otherCategoryDetail: 'Infraestructura',
    priority: 'low',
    status: 'closed',
    assigneeEmail: 'luis@ticketit.dev',
    estimateHours: 3,
    dueDate: '2026-09-25',
    notifyReporter: true,
    resolution: 'Se migró el dominio y se verificaron SPF y DKIM.',
    // Cerrado AYER (relativo a hoy): así la encuesta de satisfacción sigue vigente (7 días) en la demostración.
    resolvedAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    closedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    reopenCount: 0,
    createdAt: '2026-09-18T14:00:00Z',
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

/** Reglas de TITULAR (igual que `CaslAbilityFactory.titularRules`): lo suyo lo ve y lo edita; eliminar es solo del administrador. */
function titularRules(userUuid: string): TShellInput['abilityRules'] {
  const conditions = { ownerUuid: userUuid };
  return [EAbility.READ, EAbility.UPDATE].map((action) => ({
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
  [EUserRole.SUPERVISOR]: {
    user: {
      uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000005',
      name: 'Sergio Supervisor',
      email: 'sergio@ticketit.dev',
      role: EUserRole.SUPERVISOR,
      avatarIcon: null,
      avatarColor: null,
    },
    abilityRules: [],
    menu: MENU,
  },
  [EUserRole.AUDITOR]: {
    user: {
      uuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000007',
      name: 'Aurora Auditora',
      email: 'aurora@ticketit.dev',
      role: EUserRole.AUDITOR,
      avatarIcon: null,
      avatarColor: null,
    },
    abilityRules: [],
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
      { action: EAbility.CREATE, subject: 'Ticket' },
      ...titularRules('0b8a5f6e-1c2d-4e3f-8a9b-000000000003'),
    ],
    menu: MENU,
  },
};

/**
 * Sesión de una cuenta recién registrada: siempre `VIEWER` = cliente (el registro público nunca decide su rol,
 * igual que el backend) → crear tickets + las reglas de titular sobre lo suyo.
 */
export function buildViewerShell(name: string, email: string): TShellInput {
  const uuid = crypto.randomUUID();
  const base = structuredClone(MOCK_SHELLS[EUserRole.VIEWER]);
  return {
    ...base,
    user: { uuid, name, email, role: EUserRole.VIEWER, avatarIcon: null, avatarColor: null },
    abilityRules: [{ action: EAbility.CREATE, subject: 'Ticket' }, ...titularRules(uuid)],
  };
}
