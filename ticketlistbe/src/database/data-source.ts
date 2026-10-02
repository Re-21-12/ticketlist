import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITY_SCHEMAS } from './entity-schemas.js';
import { MIGRATIONS } from './migrations/index.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

/**
 * Opciones de conexión (Postgres). `synchronize` SIEMPRE apagado: el esquema lo gestionan las migraciones
 * (`src/database/migrations`). Las usan la app (`PersistenceService`) y la CLI de TypeORM (este mismo archivo
 * exporta el `DataSource` por defecto para `bun run migration:*`).
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITY_SCHEMAS,
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: process.env['DB_LOGGING'] === 'true' ? ['query', 'error', 'migration'] : ['error', 'migration'],
  };
}

const url = process.env['DATABASE_URL'] ?? 'postgres://ticketit:ticketit-dev@localhost:5433/ticketit';
export default new DataSource(buildDataSourceOptions(url));
