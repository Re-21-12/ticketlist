import { DefaultNamingStrategy } from 'typeorm';

const toSnake = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Columnas en `snake_case` (`ownerUuid` → `owner_uuid`), como en los diccionarios de datos (`docs/data-dictionary`). */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    return customName ?? [...embeddedPrefixes.map(toSnake), toSnake(propertyName)].join('_');
  }
}
