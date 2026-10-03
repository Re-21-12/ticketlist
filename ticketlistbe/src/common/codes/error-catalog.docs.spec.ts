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
import {
  EmailOnlySchema,
  RecoverPasswordSchema,
  ResetPasswordSchema,
  TotpEnableSchema,
  SignUpSchema,
  VerifyEmailSchema,
} from '../../modules/auth/dtos/account-recovery.dto.js';
import { JobUpdateSchema } from '../../modules/jobs/jobs.schema.js';
import { MetricsPeriodQuerySchema } from '../../modules/metrics/metrics.schema.js';
import {
  AssignSchema,
  CommentCreateSchema,
  SurveyAnswerSchema,
  TransitionSchema,
} from '../../modules/tickets/schemas/ticket-lifecycle.schema.js';
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
  const base = { title: 'Algo roto', description: '', type: 'incident', category: 'software', priority: 'low' };
  const cases: [string, z.ZodType, unknown][] = [
    ['title (min)', TicketCreateSchema, { ...base, title: 'ab' }],
    ['title (max)', TicketCreateSchema, { ...base, title: 'x'.repeat(121) }],
    ['description (max)', TicketCreateSchema, { ...base, description: 'x'.repeat(2001) }],
    ['type', TicketCreateSchema, { ...base, type: 'nope' }],
    ['category', TicketCreateSchema, { ...base, category: 'nope' }],
    ['complexity', TicketCreateSchema, { ...base, complexity: 'nope' }],
    ['otherCategoryDetail (max)', TicketCreateSchema, { ...base, category: 'other', otherCategoryDetail: 'x'.repeat(121) }],
    ['otherCategoryDetail (requerido)', TicketCreateSchema, { ...base, category: 'other' }],
    ['priority', TicketCreateSchema, { ...base, priority: 'x' }],
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
    ['sign-up name (min)', SignUpSchema, { name: 'ab', email: 'a@b.dev', password: 'Clave-Nueva-1!' }],
    ['sign-up name (max)', SignUpSchema, { name: 'x'.repeat(121), email: 'a@b.dev', password: 'Clave-Nueva-1!' }],
    ['sign-up email', SignUpSchema, { name: 'Nora', email: 'nora@', password: 'Clave-Nueva-1!' }],
    ['sign-up password (min)', SignUpSchema, { name: 'Nora', email: 'a@b.dev', password: 'Ab1!' }],
    ['sign-up password (max)', SignUpSchema, { name: 'Nora', email: 'a@b.dev', password: 'Aa1!'.repeat(33) }],
    ['sign-up password (complejidad)', SignUpSchema, { name: 'Nora', email: 'a@b.dev', password: 'sololetras' }],
    ['email-only email', EmailOnlySchema, { email: 'x' }],
    ['verify token', VerifyEmailSchema, { token: '<script>' }],
    ['reset token', ResetPasswordSchema, { token: 'corto', newPassword: 'Clave-Nueva-1!' }],
    ['reset newPassword (complejidad)', ResetPasswordSchema, { token: 'a'.repeat(43), newPassword: 'sololetras' }],
    ['recover code', RecoverPasswordSchema, { method: 'totp', email: 'a@b.dev', code: '12', newPassword: 'Clave-Nueva-1!' }],
    ['totp-enable code', TotpEnableSchema, { code: 'abcdef' }],
    ['avatar icon', UpdateAvatarSchema, { avatarIcon: 'x', avatarColor: null }],
    ['avatar color', UpdateAvatarSchema, { avatarIcon: null, avatarColor: 'x' }],
    ['comment body (vacío)', CommentCreateSchema, { body: '   ' }],
    ['comment body (max)', CommentCreateSchema, { body: 'x'.repeat(2001) }],
    ['transition to', TransitionSchema, { to: 'volando' }],
    ['transition resolution (requerida)', TransitionSchema, { to: 'resolved' }],
    ['survey resolved (requerido)', SurveyAnswerSchema, { score: 3 }],
    ['survey score (tipo)', SurveyAnswerSchema, { resolved: true, score: 'cinco' }],
    ['survey score (max)', SurveyAnswerSchema, { resolved: true, score: 6 }],
    ['job cron', JobUpdateSchema, { enabled: true, cron: 'cada rato' }],
    ['job afterHours (min)', JobUpdateSchema, { enabled: true, cron: '* * * * *', params: { afterHours: 0 } }],
    ['assign email', AssignSchema, { assigneeEmail: 'x' }],
    ['metrics período (orden)', MetricsPeriodQuerySchema, { from: '2026-10-05', to: '2026-10-01' }],
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
