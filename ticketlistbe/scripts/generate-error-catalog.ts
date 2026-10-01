/**
 * Regenera las tablas de docs/standard/error-catalog.md desde `ERROR_CODES` y
 * `VALIDATION_ERRORS`. Uso: `bun run docs:errors`. Correrlo tras agregar/editar un código o un
 * mensaje de validación — `error-catalog.docs.spec.ts` falla mientras el .md esté desactualizado.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replaceGeneratedBlock } from '../src/common/codes/error-catalog.render.js';

const docPath = resolve(import.meta.dirname, '../docs/standard/error-catalog.md');
const updated = replaceGeneratedBlock(readFileSync(docPath, 'utf8'));
writeFileSync(docPath, updated);
console.log(`Catálogo de errores actualizado: ${docPath}`);
