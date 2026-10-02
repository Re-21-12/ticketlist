import { CatalogItemSchema, CatalogSchema } from '../../database/entity-schemas.js';
import { PersistenceService } from '../../database/persistence.service.js';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const SEVERITIES = ['secondary', 'info', 'success', 'warn', 'danger', 'contrast'] as const;
export type TSeverity = (typeof SEVERITIES)[number];

export interface ICatalog {
  key: string;
  name: string;
  description: string;
  system: boolean;
  createdAt: Date;
}

export interface ICatalogItem {
  uuid: string;
  catalogKey: string;
  code: string;
  label: string;
  order: number;
  active: boolean;
  system: boolean;
  /** Clase PrimeIcons (`pi-clock`) con que se pinta la insignia; `null` = sin ícono. */
  icon: string | null;
  /** Color de la insignia (severidad del tema); `null` = neutro. */
  severity: TSeverity | null;
}

const SEED_AT = new Date('2026-09-01T00:00:00Z');

const system = (key: string, name: string, description: string): ICatalog => ({
  key,
  name,
  description,
  system: true,
  createdAt: SEED_AT,
});

const items = (catalogKey: string, rows: [code: string, label: string, icon: string, severity: TSeverity][]): ICatalogItem[] =>
  rows.map(([code, label, icon, severity], index) => ({
    uuid: randomUUID(),
    catalogKey,
    code,
    label,
    order: (index + 1) * 10,
    active: true,
    system: true,
    icon,
    severity,
  }));

/**
 * Catálogos (tablas dinámicas) EN MEMORIA. Los tres sembrados espejan los enums que valida el
 * schema de tickets: sus códigos son de sistema (no se renombran ni eliminan), pero la etiqueta y
 * el orden se administran. Un catálogo nuevo nace vacío y SIN sistema.
 */
@Injectable()
export class CatalogsRepository implements OnModuleInit {
  constructor(private readonly persistence: PersistenceService) {}

  /**
   * Con Postgres: lo guardado manda (etiquetas, orden, ícono y color que un administrador editó) y se AGREGAN las
   * semillas que falten por clave natural (catálogo `key`, elemento `catalogKey + code`): un lanzamiento con un
   * catálogo o un elemento nuevo lo recibe sin pisar nada.
   */
  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    const [storedCatalogs, storedItems] = await Promise.all([
      this.persistence.load(CatalogSchema),
      this.persistence.load(CatalogItemSchema),
    ]);
    const knownCatalogs = new Set(storedCatalogs.map((c) => c.key));
    const knownItems = new Set(storedItems.map((i) => `${i.catalogKey}|${i.code}`));
    const newCatalogs = this.catalogs.filter((c) => !knownCatalogs.has(c.key));
    const newItems = this.catalogItems.filter((i) => !knownItems.has(`${i.catalogKey}|${i.code}`));
    if (newCatalogs.length > 0) this.persistence.save(CatalogSchema, newCatalogs);
    if (newItems.length > 0) this.persistence.save(CatalogItemSchema, newItems);
    this.catalogs = [...storedCatalogs, ...newCatalogs];
    this.catalogItems = [...storedItems, ...newItems];
  }

  private catalogs: ICatalog[] = [
    system('ticket-type', 'Tipo de ticket', 'Incidencia o solicitud (paso 3 de CU05).'),
    system('ticket-category', 'Categoría de ticket', 'Área funcional del caso (paso 4 de CU05).'),
    system('ticket-priority', 'Urgencia de ticket', 'Urgencia con la que se atiende (paso 5 de CU05).'),
    system('ticket-complexity', 'Complejidad de ticket', 'Esfuerzo estimado; la fija el equipo de soporte.'),
    system('ticket-department', 'Departamento de origen', 'De qué área viene la solicitud; «TI (interno)» cuando nace dentro del propio equipo de TI. Se pueden agregar departamentos.'),
    system('ticket-status', 'Estado de ticket', 'Ciclo de vida del ticket (los códigos son fijos).'),
  ];

  /** Los códigos de los catálogos de sistema espejan los enums del schema de tickets; ícono y color se administran. */
  private catalogItems: ICatalogItem[] = [
    ...items('ticket-type', [
      ['incident', 'Incidente', 'pi-bolt', 'danger'],
      ['service_request', 'Solicitud de servicio', 'pi-briefcase', 'info'],
      ['inquiry', 'Consulta', 'pi-question-circle', 'secondary'],
      ['improvement', 'Mejora', 'pi-lightbulb', 'success'],
    ]),
    ...items('ticket-category', [
      ['hardware', 'Hardware', 'pi-desktop', 'secondary'],
      ['software', 'Software', 'pi-code', 'info'],
      ['network', 'Red y conectividad', 'pi-wifi', 'info'],
      ['access', 'Accesos y cuentas', 'pi-key', 'warn'],
      ['email', 'Correo', 'pi-envelope', 'secondary'],
      ['other', 'Otra', 'pi-ellipsis-h', 'contrast'],
    ]),
    ...items('ticket-priority', [
      ['low', 'Baja', 'pi-angle-down', 'secondary'],
      ['medium', 'Media', 'pi-minus', 'info'],
      ['high', 'Alta', 'pi-angle-up', 'warn'],
      ['critical', 'Crítica', 'pi-exclamation-triangle', 'danger'],
    ]),
    ...items('ticket-complexity', [
      ['simple', 'Simple', 'pi-circle', 'success'],
      ['moderate', 'Moderada', 'pi-circle-fill', 'warn'],
      ['complex', 'Compleja', 'pi-sitemap', 'danger'],
    ]),
    // Departamentos: solo `it` es de sistema (lo usa el programa como valor por defecto); el resto lo administra la organización.
    ...items('ticket-department', [
      ['it', 'TI (interno)', 'pi-desktop', 'contrast'],
      ['hr', 'Recursos Humanos', 'pi-users', 'info'],
      ['finance', 'Finanzas', 'pi-wallet', 'success'],
      ['sales', 'Ventas', 'pi-chart-line', 'warn'],
      ['operations', 'Operaciones', 'pi-cog', 'secondary'],
      ['admin', 'Administración', 'pi-briefcase', 'secondary'],
    ]).map((item) => ({ ...item, system: item.code === 'it' })),
    ...items('ticket-status', [
      ['new', 'Nuevo', 'pi-inbox', 'info'],
      ['assigned', 'Asignado', 'pi-user-plus', 'info'],
      ['in_progress', 'En atención', 'pi-clock', 'warn'],
      ['pending_customer', 'Pendiente del cliente', 'pi-hourglass', 'secondary'],
      ['escalated', 'Escalado (N2/N3)', 'pi-angle-double-up', 'danger'],
      ['resolved', 'Resuelto', 'pi-check', 'success'],
      ['closed', 'Cerrado', 'pi-lock', 'contrast'],
      ['reopened', 'Reabierto', 'pi-replay', 'warn'],
    ]),
  ];

  list(): ICatalog[] {
    return [...this.catalogs].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  find(key: string): ICatalog | null {
    return this.catalogs.find((c) => c.key === key) ?? null;
  }

  create(input: Pick<ICatalog, 'key' | 'name' | 'description'>): ICatalog {
    const catalog: ICatalog = { ...input, system: false, createdAt: new Date() };
    this.catalogs = [...this.catalogs, catalog];
    this.persistence.save(CatalogSchema, catalog);
    return catalog;
  }

  update(key: string, changes: Pick<ICatalog, 'name' | 'description'>): ICatalog | null {
    const current = this.find(key);
    if (!current) return null;
    const updated = { ...current, ...changes };
    this.catalogs = this.catalogs.map((c) => (c.key === key ? updated : c));
    this.persistence.save(CatalogSchema, updated);
    return updated;
  }

  remove(key: string): void {
    this.catalogs = this.catalogs.filter((c) => c.key !== key);
    this.catalogItems = this.catalogItems.filter((i) => i.catalogKey !== key);
    this.persistence.remove(CatalogItemSchema, { catalogKey: key });
    this.persistence.remove(CatalogSchema, { key });
  }

  itemsOf(key: string): ICatalogItem[] {
    return this.catalogItems
      .filter((i) => i.catalogKey === key)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'));
  }

  findItem(key: string, uuid: string): ICatalogItem | null {
    return this.catalogItems.find((i) => i.catalogKey === key && i.uuid === uuid) ?? null;
  }

  codeExists(key: string, code: string, exceptUuid?: string): boolean {
    return this.catalogItems.some(
      (i) => i.catalogKey === key && i.code.toLowerCase() === code.toLowerCase() && i.uuid !== exceptUuid,
    );
  }

  createItem(key: string, input: Pick<ICatalogItem, 'code' | 'label' | 'order' | 'active' | 'icon' | 'severity'>): ICatalogItem {
    const item: ICatalogItem = { uuid: randomUUID(), catalogKey: key, system: false, ...input };
    this.catalogItems = [...this.catalogItems, item];
    this.persistence.save(CatalogItemSchema, item);
    return item;
  }

  updateItem(uuid: string, changes: Partial<Pick<ICatalogItem, 'code' | 'label' | 'order' | 'active' | 'icon' | 'severity'>>): ICatalogItem {
    let updated!: ICatalogItem;
    this.catalogItems = this.catalogItems.map((i) => (i.uuid === uuid ? (updated = { ...i, ...changes }) : i));
    this.persistence.save(CatalogItemSchema, updated);
    return updated;
  }

  removeItem(uuid: string): void {
    this.catalogItems = this.catalogItems.filter((i) => i.uuid !== uuid);
    this.persistence.remove(CatalogItemSchema, { uuid });
  }
}
