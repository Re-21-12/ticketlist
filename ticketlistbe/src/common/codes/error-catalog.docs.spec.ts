import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as z from 'zod';
import { UuidParamSchema } from '../../core/dtos/uuid-param.dto.js';
import type { IErrorDetail } from '../../core/interfaces/Icustom-code.interface.js';
import { TicketQuerySchema } from '../../modules/tickets/dtos/ticket-query.dto.js';
import { TicketCreateSchema } from '../../modules/tickets/schemas/ticket.schema.js';
import { RolePermissionCreateSchema } from '../../modules/access-control/role-permissions/schemas/role-permission.schema.js';
import { SignInSchema } from '../../modules/auth/dtos/sign-in.dto.js';
import { RelationshipCreateSchema } from '../../modules/relationships/schemas/relationship.schema.js';
import { ChangePasswordSchema } from '../../modules/auth/dtos/change-password.dto.js';
import { UpdateAvatarSchema } from '../../modules/users/dtos/update-avatar.dto.js';
import { CATALOG_END, CATALOG_START, renderErrorCatalog } from './error-catalog.render.js';
import { ERROR_CODES } from './error-codes.js';

/**
 * La documentación del catálogo de errores es parte del contrato: este test falla si
 * docs/standard/error-catalog.md no refleja el código.
 */
// CRLF → LF: en Windows (o con core.autocrlf) el .md puede venir con CRLF; el bloque generado es LF.
const doc = readFileSync(resolve(process.cwd(), 'docs/standard/error-catalog.md'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

function section(from: string, to: string): string {
  const start = doc.indexOf(from);
  const end = doc.indexOf(to, start);
  return doc.slice(start, end);
}

describe('docs/standard/error-catalog.md', () => {
  it('§3 y §4.1 (generados) están al día con ERROR_CODES y VALIDATION_ERRORS — si falla: bun run docs:errors', () => {
    const generated = doc.slice(doc.indexOf(CATALOG_START), doc.indexOf(CATALOG_END) + CATALOG_END.length);
    expect(generated).toBe(renderErrorCatalog());
  });

  it('§5 documenta dónde se lanza cada código de negocio', () => {
    const whereThrown = section('## 5.', '## 6.');
    const codes = Object.values(ERROR_CODES).flatMap((entries) =>
      Object.values(entries as Record<string, IErrorDetail>).map((d) => d.code),
    );
    for (const code of codes) {
      const documented = code.startsWith('RDB-') ? whereThrown.includes('`RDB-E*`') : whereThrown.includes(`\`${code}\``);
      expect(documented, `${code} falta en §5`).toBe(true);
    }
  });

  /** Cada fila de §4.2 se verifica ejecutando el schema real: mismo campo, `code` y mensaje. */
  const base = { title: 'Algo roto', description: '', category: 'bug', priority: 'low' };
  const cases: [string, z.ZodType, unknown][] = [
    ['title (min)', TicketCreateSchema, { ...base, title: 'ab' }],
    ['title (max)', TicketCreateSchema, { ...base, title: 'x'.repeat(121) }],
    ['description (max)', TicketCreateSchema, { ...base, description: 'x'.repeat(2001) }],
    ['category', TicketCreateSchema, { ...base, category: 'nope' }],
    ['otherCategoryDetail (max)', TicketCreateSchema, { ...base, category: 'other', otherCategoryDetail: 'x'.repeat(121) }],
    ['otherCategoryDetail (requerido)', TicketCreateSchema, { ...base, category: 'other' }],
    ['priority', TicketCreateSchema, { ...base, priority: 'x' }],
    ['status', TicketCreateSchema, { ...base, status: 'x' }],
    ['assigneeEmail', TicketCreateSchema, { ...base, assigneeEmail: 'ana@' }],
    ['estimateHours (tipo)', TicketCreateSchema, { ...base, estimateHours: 'x' }],
    ['estimateHours (entero)', TicketCreateSchema, { ...base, estimateHours: 1.5 }],
    ['estimateHours (min)', TicketCreateSchema, { ...base, estimateHours: 0 }],
    ['estimateHours (max)', TicketCreateSchema, { ...base, estimateHours: 201 }],
    ['dueDate', TicketCreateSchema, { ...base, dueDate: '31/12/2026' }],
    ['page', TicketQuerySchema, { page: '0' }],
    ['take', TicketQuerySchema, { take: '101' }],
    ['uuid', UuidParamSchema, { uuid: 'x' }],
    ['sign-in email', SignInSchema, { email: 'ana@', password: 'ticketit-dev' }],
    ['sign-in password', SignInSchema, { email: 'ana@ticketit.dev', password: 'corta' }],
    ['role-permission role', RolePermissionCreateSchema, { role: 'X', subject: 'Ticket', action: 'read' }],
    ['relationship email', RelationshipCreateSchema, { alternanteEmail: 'x', consent: true, grants: [{ objectType: 'Ticket' }] }],
    ['relationship grants', RelationshipCreateSchema, { alternanteEmail: 'a@b.dev', consent: true, grants: [] }],
    ['relationship objectType', RelationshipCreateSchema, { alternanteEmail: 'a@b.dev', consent: true, grants: [{ objectType: 'X' }] }],
    ['change-password currentPassword', ChangePasswordSchema, { currentPassword: '', newPassword: 'Clave-Fuerte-1!' }],
    ['change-password newPassword (min)', ChangePasswordSchema, { currentPassword: 'x', newPassword: 'Ab1!' }],
    ['change-password newPassword (max)', ChangePasswordSchema, { currentPassword: 'x', newPassword: 'Aa1!'.repeat(33) }],
    ['change-password newPassword (complejidad)', ChangePasswordSchema, { currentPassword: 'x', newPassword: 'sololetras' }],
    ['avatar icon', UpdateAvatarSchema, { avatarIcon: 'x', avatarColor: null }],
    ['avatar color', UpdateAvatarSchema, { avatarIcon: null, avatarColor: 'x' }],
    ['relationship consent', RelationshipCreateSchema, { alternanteEmail: 'a@b.dev', grants: [{ objectType: 'Ticket' }] }],
  ];

  it.each(cases)('§4.2 %s: la fila documentada coincide con el issue real', (_, schema, input) => {
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    const field = issue.path.join('.');
    const rows = section('### 4.2', '## 5.')
      .split('\n')
      .filter((line) => line.startsWith(`| \`${field}\``));
    const row = rows.find((line) => line.includes(issue.message) && line.includes(`\`${issue.code}\``));
    expect(row, `falta fila en §4.2 para ${field} · ${issue.code} · «${issue.message}»`).toBeDefined();
  });
});
