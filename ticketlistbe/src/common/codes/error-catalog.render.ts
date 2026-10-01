import { ERROR_CODES } from './error-codes.js';
import type { IErrorDetail } from '../../core/interfaces/Icustom-code.interface.js';
import { VALIDATION_ERRORS, type IValidationMessage } from './validation-errors.js';

/**
 * Renderiza las tablas GENERADAS de docs/standard/error-catalog.md desde el código (fuente única).
 * Lo usan `scripts/generate-error-catalog.ts` (`bun run docs:errors`, escribe el .md) y
 * `error-catalog.docs.spec.ts` (falla si el .md quedó desactualizado).
 */
export const CATALOG_START = '<!-- error-catalog:generated:start -->';
export const CATALOG_END = '<!-- error-catalog:generated:end -->';

interface ILayer {
  title: string;
  description: string;
  match: (code: string) => boolean;
}

/** Capas en el orden del documento, decididas por el prefijo del código (`<Capa><Módulo>-E###`). */
const LAYERS: ILayer[] = [
  {
    title: 'Base de datos / Repositorio (R)',
    description:
      'Acceso a datos: registro inexistente, ya eliminado, y violaciones de constraints de PostgreSQL (`RDB-E<SQLSTATE>`, las mapea el filtro por `driverError.code`).',
    match: (code) => code.startsWith('R'),
  },
  {
    title: 'Servicio (S)',
    description:
      'Reglas de negocio y autorización por registro (`BaseService.assertCan`) o por tipo (`CaslGuard`).',
    match: (code) => code.startsWith('S') && !code.startsWith('SYS'),
  },
  {
    title: 'Controlador / DTO (C)',
    description:
      'Request inválido. `CVAL-E001` agrupa TODOS los errores de validación Zod; el detalle por campo va en `issues` (ver §4).',
    match: (code) => code.startsWith('C'),
  },
  {
    title: 'Sistema',
    description: 'Errores no mapeados. `NEST-E<status>` lo genera el filtro para `HttpException` de Nest sin código de negocio.',
    match: (code) => code.startsWith('SYS'),
  },
];

function allErrorDetails(): { key: string; detail: IErrorDetail }[] {
  return Object.entries(ERROR_CODES).flatMap(([module, entries]) =>
    Object.entries(entries as Record<string, IErrorDetail>).map(([name, detail]) => ({
      key: /^\d+$/.test(name) ? `${module}['${name}']` : `${module}.${name}`,
      detail,
    })),
  );
}

const escape = (text: string) => text.replace(/\|/g, '\\|');

function renderErrorTables(): string {
  const details = allErrorDetails();
  return LAYERS.map((layer, index) => {
    const rows = details
      .filter(({ detail }) => layer.match(detail.code))
      .map(
        ({ key, detail }) =>
          `| \`${detail.code}\` | ${detail.httpStatus} | \`ERROR_CODES.${key}\` | ${escape(detail.messageEs)} | ${escape(detail.messageEn)} |`,
      );
    return [
      `### 3.${index + 1} ${layer.title}`,
      '',
      layer.description,
      '',
      '| Código | HTTP | Clave en el catálogo | Mensaje (es) | Mensaje (en) |',
      '|---|---|---|---|---|',
      ...(rows.length ? rows : ['| — | — | — | — | — |']),
    ].join('\n');
  }).join('\n\n');
}

function renderValidationTable(): string {
  const rows = Object.entries(VALIDATION_ERRORS).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, IValidationMessage>).map(([name, entry]) => {
      const params = [...entry.messageEs.matchAll(/\{(\w+)\}/g)].map((m) => `\`${m[1]}\``);
      return `| \`VALIDATION_ERRORS.${group}.${name}\` | ${params.join(', ') || '—'} | ${escape(entry.messageEs)} | ${escape(entry.messageEn)} |`;
    }),
  );
  return [
    '### 4.1 Catálogo de mensajes (`validation-errors.ts`)',
    '',
    '| Clave | Parámetros | Mensaje (es) | Mensaje (en) |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

/** Bloque completo entre marcadores, tal como debe quedar en el .md. */
export function renderErrorCatalog(): string {
  return [
    CATALOG_START,
    '<!-- NO editar a mano: generado desde el código con `bun run docs:errors`. -->',
    '',
    '## 3. Catálogo de códigos por capa',
    '',
    renderErrorTables(),
    '',
    '## 4. Validación de DTOs (Zod)',
    '',
    renderValidationTable(),
    CATALOG_END,
  ].join('\n');
}

/** Reemplaza el bloque generado dentro del contenido del .md. */
export function replaceGeneratedBlock(markdown: string): string {
  const start = markdown.indexOf(CATALOG_START);
  const end = markdown.indexOf(CATALOG_END);
  if (start === -1 || end === -1) {
    throw new Error(`Faltan los marcadores ${CATALOG_START} / ${CATALOG_END} en el documento.`);
  }
  return markdown.slice(0, start) + renderErrorCatalog() + markdown.slice(end + CATALOG_END.length);
}
