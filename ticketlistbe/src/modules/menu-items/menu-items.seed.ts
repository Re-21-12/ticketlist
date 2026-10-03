import { EAbility } from '../auth/casl/ability.enum.js';
import type { MenuItemEntity } from './menu-item.entity.js';

type TSeed = Pick<MenuItemEntity, 'key' | 'label' | 'route' | 'group' | 'icon' | 'subject' | 'requiredAction' | 'order'>;

/**
 * Menú inicial (en wallet-api: migración/seed de `menu_items`). QUIÉN ve cada ítem lo decide CASL en
 * el front (`subject` + `requiredAction`); aquí solo se describe el catálogo.
 */
const SEED: TSeed[] = [
  // «Mis tickets» (CU01): lo que registraste, con su estado actual, historial y avisos en tiempo real.
  { key: 'my-tickets', label: 'Mis tickets', route: '/my-tickets', group: 'Tickets', icon: 'pi-inbox', subject: 'Ticket', requiredAction: null, order: 5 },
  { key: 'board', label: 'Tablero', route: '/tickets', group: 'Tickets', icon: 'pi-th-large', subject: 'Ticket', requiredAction: null, order: 10 },
  { key: 'list', label: 'Listado', route: '/tickets/list', group: 'Tickets', icon: 'pi-list', subject: 'Ticket', requiredAction: null, order: 20 },
  { key: 'new-ticket', label: 'Nuevo ticket', route: '/tickets/new', group: 'Tickets', icon: 'pi-plus', subject: 'Ticket', requiredAction: EAbility.CREATE, order: 30 },
  { key: 'sharing', label: 'Compartir mis tickets', route: '/sharing', group: 'Tickets', icon: 'pi-share-alt', subject: 'Relationship', requiredAction: EAbility.CREATE, order: 40 },
  // Servicio: métricas del equipo (supervisión) y las propias de cada agente (FCR, SLA, CSAT — docs/standard/metrics.md).
  { key: 'metrics', label: 'Métricas del equipo', route: '/metrics', group: 'Servicio', icon: 'pi-chart-line', subject: 'Metric', requiredAction: EAbility.READ, order: 10 },
  { key: 'my-metrics', label: 'Mis métricas', route: '/my-metrics', group: 'Servicio', icon: 'pi-chart-bar', subject: 'MyMetric', requiredAction: EAbility.READ, order: 20 },
  // «Mi perfil» reúne información, seguridad, sesiones, notificaciones, avatar y apariencia (como wallet-api).
  { key: 'profile', label: 'Mi perfil', route: '/profile', group: 'Preferencias', icon: 'pi-user', subject: null, requiredAction: null, order: 10 },
  { key: 'appearance', label: 'Apariencia', route: '/appearance', group: 'Preferencias', icon: 'pi-palette', subject: null, requiredAction: null, order: 20 },
  { key: 'style-guide', label: 'Guía de estilos', route: '/style-guide', group: 'Preferencias', icon: 'pi-book', subject: null, requiredAction: null, order: 30 },
  { key: 'role-matrix', label: 'Matriz de roles', route: '/role-matrix', group: 'Administración', icon: 'pi-table', subject: 'RolePermission', requiredAction: EAbility.READ, order: 10 },
  { key: 'role-permissions', label: 'Permisos por rol', route: '/role-permissions', group: 'Administración', icon: 'pi-shield', subject: 'RolePermission', requiredAction: EAbility.READ, order: 20 },
  { key: 'users', label: 'Usuarios', route: '/users', group: 'Administración', icon: 'pi-users', subject: 'User', requiredAction: EAbility.READ, order: 30 },
  { key: 'relation-permissions', label: 'Relaciones', route: '/relation-permissions', group: 'Administración', icon: 'pi-sitemap', subject: 'Relationship', requiredAction: EAbility.MANAGE, order: 40 },
  { key: 'menu-items', label: 'Menú', route: '/menu-items', group: 'Administración', icon: 'pi-bars', subject: 'MenuItem', requiredAction: EAbility.READ, order: 50 },
  { key: 'catalogs', label: 'Catálogos', route: '/catalogs', group: 'Administración', icon: 'pi-database', subject: 'Catalog', requiredAction: EAbility.READ, order: 60 },
  { key: 'jobs', label: 'Tareas programadas', route: '/jobs', group: 'Administración', icon: 'pi-clock', subject: 'ScheduledJob', requiredAction: EAbility.READ, order: 80 },
  { key: 'audit-logs', label: 'Auditoría', route: '/audit-logs', group: 'Administración', icon: 'pi-history', subject: 'AuditLog', requiredAction: EAbility.READ, order: 70 },
];

const at = new Date('2026-09-01T00:00:00Z');

export const MENU_ITEMS_SEED: MenuItemEntity[] = SEED.map((row, index) => ({
  ...row,
  active: true,
  id: 0,
  uuid: `3e000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  createdAt: at,
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  isDeleted: false,
  restoredAt: null,
  restoredBy: null,
}));
