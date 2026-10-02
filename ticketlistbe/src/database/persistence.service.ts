import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource, type EntitySchema } from 'typeorm';
import { APP_ENV } from '../config/config.module.js';
import { persistenceEnabled, type TEnv } from '../config/env.schema.js';
import { buildDataSourceOptions } from './data-source.js';

/**
 * Persistencia con TypeORM (Postgres) de los repositorios en memoria.
 *
 * MODELO (leer antes de tocarlo): cada repositorio sigue sirviendo las LECTURAS desde su copia en memoria
 * (el código de servicios, guards y CASL es síncrono) y esta clase guarda cada cambio en Postgres por una COLA
 * SERIALIZADA (se escribe en el orden en que ocurrió). Al arrancar, cada repositorio se HIDRATA desde la base
 * (`load`) y le agrega sus semillas faltantes. Consecuencias:
 *   · la base es la fuente de verdad que sobrevive a reinicios y despliegues;
 *   · UNA sola instancia de la API: dos réplicas tendrían copias en memoria que divergen (la sesión y los
 *     contadores ya viven en Redis; el dominio todavía no);
 *   · una escritura que falla se registra (`failures`) y se sigue: `/api/health/ready` avisa si la cola falló.
 *
 * Sin `DATABASE_URL` (o con `DB_PERSISTENCE=false`) todo es no-op y la app funciona solo en memoria (pruebas).
 */
@Injectable()
export class PersistenceService implements OnApplicationShutdown {
  private readonly logger = new Logger('Persistence');
  readonly enabled: boolean;
  /** Conexión abierta y migraciones aplicadas. Los repositorios la esperan antes de hidratarse. */
  readonly ready: Promise<void>;
  private dataSource: DataSource | null = null;
  private queue: Promise<void> = Promise.resolve();
  private failureCount = 0;

  constructor(@Inject(APP_ENV) private readonly env: TEnv) {
    this.enabled = persistenceEnabled(env);
    this.ready = this.enabled ? this.connect() : Promise.resolve();
    // Si falla, los repositorios lo relanzan al esperar `ready` (el arranque aborta); esto evita el aviso de «unhandled».
    this.ready.catch(() => undefined);
  }

  get failures(): number {
    return this.failureCount;
  }

  private async connect(): Promise<void> {
    const url = this.env.DATABASE_URL as string;
    const dataSource = new DataSource(buildDataSourceOptions(url));
    await dataSource.initialize();
    if (this.env.DB_AUTO_MIGRATE) {
      const applied = await dataSource.runMigrations({ transaction: 'each' });
      for (const migration of applied) this.logger.log(`Migración aplicada: ${migration.name}`);
    }
    if (this.env.DB_RESET_ON_START) {
      // Solo pruebas (loadEnv lo prohíbe en production): cada instancia arranca con las tablas vacías (conserva el esquema).
      const tables = dataSource.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(', ');
      await dataSource.query(`TRUNCATE TABLE ${tables} CASCADE`);
      this.logger.warn('DB_RESET_ON_START: tablas vaciadas');
    }
    this.dataSource = dataSource;
    this.logger.log('Postgres conectado (TypeORM)');
  }

  /** Todas las filas de una tabla (hidratación al arrancar). */
  async load<T extends object>(schema: EntitySchema<T>): Promise<T[]> {
    await this.ready;
    return (await this.db().getRepository(schema).find()) as T[];
  }

  /** Inserta o actualiza (por clave primaria) en la cola de escritura. No espera: es fire-and-forget ordenado. */
  save<T extends object>(schema: EntitySchema<T>, rows: T | readonly T[]): void {
    if (!this.enabled) return;
    const list = Array.isArray(rows) ? [...rows] : [rows as T];
    this.enqueue(`save ${String(schema.options.name)}`, async () => {
      await this.db().getRepository(schema).save(list as never[]);
    });
  }

  /** Borra por criterio (solo catálogos: el resto usa borrado lógico). */
  remove<T extends object>(schema: EntitySchema<T>, criteria: Partial<T>): void {
    if (!this.enabled) return;
    this.enqueue(`remove ${String(schema.options.name)}`, async () => {
      await this.db().getRepository(schema).delete(criteria as never);
    });
  }

  /** Espera a que todas las escrituras encoladas terminen (pruebas, apagado ordenado). */
  async flush(): Promise<void> {
    await this.queue;
  }

  /** ¿La base responde y la cola de escritura no ha fallado? (`/api/health/ready`). */
  async healthy(): Promise<boolean> {
    if (!this.enabled) return true;
    try {
      await this.ready;
      await this.db().query('SELECT 1');
      return this.failureCount === 0;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.enabled) return;
    await this.flush();
    await this.dataSource?.destroy();
  }

  private db(): DataSource {
    if (!this.dataSource) throw new Error('PersistenceService: la conexión aún no está lista');
    return this.dataSource;
  }

  private enqueue(label: string, work: () => Promise<void>): void {
    this.queue = this.queue.then(work).catch((error: unknown) => {
      this.failureCount += 1;
      this.logger.error(`Falló «${label}»: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}
