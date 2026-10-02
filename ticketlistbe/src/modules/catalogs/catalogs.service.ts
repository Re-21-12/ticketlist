import { Injectable } from '@nestjs/common';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { CatalogsRepository, type ICatalog, type ICatalogItem } from './catalogs.repository.js';
import type {
  CatalogCreateSchema,
  CatalogDetailSchema,
  CatalogItemCreateSchema,
  CatalogItemResponseSchema,
  CatalogItemUpdateSchema,
  CatalogListSchema,
  CatalogOptionsSchema,
  CatalogSummarySchema,
  CatalogUpdateSchema,
} from './schemas/catalog.schema.js';

type TSummary = z.output<typeof CatalogSummarySchema>;
type TItem = z.output<typeof CatalogItemResponseSchema>;

const toItem = ({ uuid, code, label, order, active, system, icon, severity }: ICatalogItem): TItem => ({
  uuid,
  code,
  label,
  order,
  active,
  system,
  icon,
  severity,
});

/** Catálogos administrables (tablas dinámicas). Los elementos de sistema conservan su código y no se eliminan. */
@Injectable()
export class CatalogsService {
  constructor(private readonly repository: CatalogsRepository) {}

  list(): z.output<typeof CatalogListSchema> {
    return { data: this.repository.list().map((catalog) => this.summary(catalog)) };
  }

  detail(key: string): z.output<typeof CatalogDetailSchema> {
    const catalog = this.mustFind(key);
    return { ...this.summary(catalog), items: this.repository.itemsOf(key).map(toItem) };
  }

  /** Para formularios: solo ítems activos. Lo puede pedir cualquier persona con sesión. */
  /** ¿`code` es un elemento ACTIVO de ese catálogo? (valida campos que apuntan a un catálogo editable). */
  isActiveCode(key: string, code: string): boolean {
    return this.repository.itemsOf(key).some((item) => item.active && item.code === code);
  }

  options(key: string): z.output<typeof CatalogOptionsSchema> {
    this.mustFind(key);
    return {
      data: this.repository
        .itemsOf(key)
        .filter((item) => item.active)
        .map((item) => ({ value: item.code, label: item.label, icon: item.icon, severity: item.severity })),
    };
  }

  create(dto: z.output<typeof CatalogCreateSchema>): TSummary {
    if (this.repository.find(dto.key)) throw new CustomBusinessException(ERROR_CODES.CAT.DUPLICATED_KEY);
    return this.summary(this.repository.create(dto));
  }

  update(key: string, dto: z.output<typeof CatalogUpdateSchema>): TSummary {
    this.mustFind(key);
    return this.summary(this.repository.update(key, dto) as ICatalog);
  }

  /** Un catálogo de sistema no se elimina; uno propio sí (con sus elementos). */
  remove(key: string): void {
    if (this.mustFind(key).system) throw new CustomBusinessException(ERROR_CODES.CAT.SYSTEM_ITEM);
    this.repository.remove(key);
  }

  createItem(key: string, dto: z.output<typeof CatalogItemCreateSchema>): TItem {
    this.mustFind(key);
    if (this.repository.codeExists(key, dto.code)) throw new CustomBusinessException(ERROR_CODES.CAT.DUPLICATED_CODE);
    return toItem(this.repository.createItem(key, dto));
  }

  updateItem(key: string, uuid: string, dto: z.output<typeof CatalogItemUpdateSchema>): TItem {
    const current = this.mustFindItem(key, uuid);
    if (current.system && (dto.code !== current.code || !dto.active)) {
      throw new CustomBusinessException(ERROR_CODES.CAT.SYSTEM_ITEM);
    }
    if (this.repository.codeExists(key, dto.code, uuid)) throw new CustomBusinessException(ERROR_CODES.CAT.DUPLICATED_CODE);
    return toItem(this.repository.updateItem(uuid, dto));
  }

  removeItem(key: string, uuid: string): void {
    if (this.mustFindItem(key, uuid).system) throw new CustomBusinessException(ERROR_CODES.CAT.SYSTEM_ITEM);
    this.repository.removeItem(uuid);
  }

  private summary(catalog: ICatalog): TSummary {
    return {
      key: catalog.key,
      name: catalog.name,
      description: catalog.description,
      system: catalog.system,
      itemCount: this.repository.itemsOf(catalog.key).length,
    };
  }

  private mustFind(key: string): ICatalog {
    const catalog = this.repository.find(key);
    if (!catalog) throw new CustomBusinessException(ERROR_CODES.CAT.NOT_FOUND, { entity: 'Catalog' });
    return catalog;
  }

  private mustFindItem(key: string, uuid: string): ICatalogItem {
    this.mustFind(key);
    const item = this.repository.findItem(key, uuid);
    if (!item) throw new CustomBusinessException(ERROR_CODES.CAT.ITEM_NOT_FOUND, { entity: 'CatalogItem', uuid });
    return item;
  }
}
