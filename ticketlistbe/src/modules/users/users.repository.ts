import { UserSchema } from '../../database/entity-schemas.js';
import { PersistenceService } from '../../database/persistence.service.js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import { parseSeedUsers, seedDemoData, type TEnv } from '../../config/env.schema.js';
import { openSecret, sealSecret } from '../../core/crypto/secret-box.js';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { EUserRole } from '../auth/casl/ability.enum.js';
import type { ISessionUser } from '../auth/session/session-user.interface.js';
import { verifyTotp } from '../auth/session/totp.util.js';
import { DEV_PASSWORD, USERS_SEED } from './users.seed.js';

export interface IStoredUser extends ISessionUser {
  passwordSalt: Buffer;
  passwordHash: Buffer;
  /** `null` = el correo todavía no se verificó (no puede iniciar sesión). */
  emailVerifiedAt: Date | null;
  /** `null` = cuenta activa. Una cuenta deshabilitada no inicia sesión y su sesión deja de valer. */
  disabledAt: Date | null;
  createdAt: Date;
  /** Secreto TOTP ya CONFIRMADO (activo), CIFRADO en reposo (`sealSecret`); `null` = sin autenticador. */
  totpSecret: string | null;
  /** Secreto generado que aún no se confirmó con un código (también cifrado). */
  totpPendingSecret: string | null;
  /** Último paso de tiempo aceptado: un código no se reutiliza (anti-replay). */
  totpLastStep: number;
  /** Intentos fallidos SEGUIDOS de inicio de sesión (un acierto lo reinicia). */
  failedLogins: number;
  /** `null` = cuenta desbloqueada. Bloqueada: solo un administrador la desbloquea. */
  lockedAt: Date | null;
}

/** Vista administrativa de un usuario (nunca incluye hash ni sal). */
export interface IAdminUser extends ISessionUser {
  emailVerified: boolean;
  disabled: boolean;
  /** Bloqueada por intentos fallidos de inicio de sesión (la desbloquea un administrador). */
  locked: boolean;
  lockedAt: Date | null;
  createdAt: Date;
}

const KEY_LENGTH = 64;

function hash(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Usuarios (en memoria). Contraseña con `scrypt` + salt por usuario (nativo de Node; en wallet-api
 * es argon2) y comparación en tiempo constante (`timingSafeEqual`) para no filtrar por timing.
 */
@Injectable()
export class UsersRepository implements OnModuleInit {
  /**
   * Con datos de demostración: los usuarios de desarrollo (contraseña conocida). Sin ellos (production): SOLO el
   * cuentas de `SEED_USERS_JSON` (una por rol, contraseñas propias) y/o el administrador de `BOOTSTRAP_ADMIN_PASSWORD`;
   * todo lo demás nace del registro público (siempre VIEWER) y de lo que un administrador cambie.
   */
  private users: IStoredUser[];

  // Se arma en el constructor (no en un inicializador de campo): los campos se inicializan ANTES de asignar `env`.
  constructor(
    @Inject(APP_ENV) private readonly env: TEnv,
    private readonly persistence: PersistenceService,
  ) {
    this.users = this.initialUsers();
  }

  /**
   * Con Postgres: las cuentas guardadas mandan (contraseñas, roles, bloqueos, TOTP) y de las iniciales (`SEED_USERS_JSON`,
   * `BOOTSTRAP_ADMIN_*` o la demostración) solo entran las que NO existen por correo: una contraseña que la persona
   * cambió nunca se pisa al reiniciar.
   */
  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    const stored = (await this.persistence.load(UserSchema)).map((row) => ({
      ...row,
      passwordSalt: Buffer.from(row.passwordSalt),
      passwordHash: Buffer.from(row.passwordHash),
    }));
    const known = new Set(stored.map((user) => user.email));
    const created = this.users.filter((user) => !known.has(user.email));
    if (created.length > 0) this.persistence.save(UserSchema, created);
    this.users = [...stored, ...created];
  }

  private persist(user: IStoredUser): void {
    this.persistence.save(UserSchema, user);
  }

  private initialUsers(): IStoredUser[] {
    const seeded = (user: ISessionUser, password: string, createdAt: Date): IStoredUser => {
      const salt = randomBytes(16);
      // Las cuentas iniciales nacen con el correo verificado.
      return { ...user, passwordSalt: salt, passwordHash: hash(password, salt), emailVerifiedAt: new Date(), disabledAt: null, createdAt, totpSecret: null, totpPendingSecret: null, totpLastStep: 0, failedLogins: 0, lockedAt: null };
    };
    if (seedDemoData(this.env)) return USERS_SEED.map((user) => seeded(user, DEV_PASSWORD, new Date('2026-09-01T00:00:00Z')));
    // Production: las cuentas de `SEED_USERS_JSON` (una por rol) y, si se pidió, el administrador inicial de BOOTSTRAP_*.
    const accounts = parseSeedUsers(this.env.SEED_USERS_JSON).map((user) =>
      seeded({ uuid: randomUUID(), name: user.name, email: user.email, role: user.role, avatarIcon: null, avatarColor: null }, user.password, new Date()),
    );
    const password = this.env.BOOTSTRAP_ADMIN_PASSWORD;
    const email = this.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    if (password && !accounts.some((account) => account.email === email)) {
      accounts.push(
        seeded({ uuid: randomUUID(), name: this.env.BOOTSTRAP_ADMIN_NAME, email, role: EUserRole.ADMIN, avatarIcon: null, avatarColor: null }, password, new Date()),
      );
    }
    return accounts;
  }

  findByUuid(uuid: string): ISessionUser | null {
    return this.toPublic(this.users.find((u) => u.uuid === uuid && !u.disabledAt));
  }

  findByEmail(email: string): ISessionUser | null {
    return this.toPublic(this.users.find((u) => u.email === email.toLowerCase() && !u.disabledAt));
  }

  /**
   * Personal al que se le puede asignar un ticket: correo VERIFICADO y rol con permiso de trabajarlo
   * (ADMIN o AGENT; un VIEWER no puede editar tickets, así que asignárselos no tendría sentido).
   * Ordenado por nombre para que la lista sea estable.
   */
  listAssignable(): ISessionUser[] {
    return this.users
      .filter((u) => u.emailVerifiedAt && (u.role === EUserRole.ADMIN || u.role === EUserRole.AGENT))
      .map((u) => this.toPublic(u) as ISessionUser)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /** Cuentas ACTIVAS con un rol (p. ej. avisar a los supervisores de una calificación baja). */
  listByRole(role: EUserRole): ISessionUser[] {
    return this.users.filter((u) => u.role === role && !u.disabledAt).map((u) => this.toPublic(u) as ISessionUser);
  }

  emailExists(email: string): boolean {
    return this.users.some((u) => u.email === email.toLowerCase());
  }

  /**
   * Alta de cuenta. Siempre con el rol de MENOR privilegio (`VIEWER`): un administrador sube el rol
   * después; el registro público nunca decide su propio rol. Nace ACTIVA: no hay confirmación por correo.
   */
  create(input: { name: string; email: string; password: string }): ISessionUser {
    const salt = randomBytes(16);
    const user: IStoredUser = {
      uuid: randomUUID(),
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      role: EUserRole.VIEWER,
      avatarIcon: null,
      avatarColor: null,
      passwordSalt: salt,
      passwordHash: hash(input.password, salt),
      // Sin confirmación por correo: no hay SMTP y el registro es inmediato (la cuenta nace verificada).
      emailVerifiedAt: new Date(),
      disabledAt: null,
      createdAt: new Date(),
      totpSecret: null,
      totpPendingSecret: null,
      totpLastStep: 0,
      failedLogins: 0,
      lockedAt: null,
    };
    this.users.push(user);
    this.persist(user);
    return this.toPublic(user) as ISessionUser;
  }

  isEmailVerified(uuid: string): boolean {
    return !!this.users.find((u) => u.uuid === uuid)?.emailVerifiedAt;
  }

  markEmailVerified(uuid: string): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (user && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      this.persist(user);
    }
  }

  /** `null` si el correo no existe O la contraseña no coincide (misma respuesta: no se enumeran usuarios). */
  verifyCredentials(email: string, password: string): ISessionUser | null {
    const user = this.users.find((u) => u.email === email.toLowerCase());
    // Se calcula el hash aunque el usuario no exista: mismo costo de tiempo en ambos casos.
    const salt = user?.passwordSalt ?? randomBytes(16);
    const candidate = hash(password, salt);
    if (!user || !timingSafeEqual(candidate, user.passwordHash) || user.disabledAt) return null;
    return this.toPublic(user);
  }

  /** ¿Esta es la contraseña vigente del usuario? (para confirmar antes de cambiarla). */
  verifyPassword(uuid: string, password: string): boolean {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return false;
    return timingSafeEqual(hash(password, user.passwordSalt), user.passwordHash);
  }

  /** Guarda un hash NUEVO con sal NUEVA (nunca se reutiliza la sal anterior). */
  setPassword(uuid: string, password: string): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return;
    user.passwordSalt = randomBytes(16);
    user.passwordHash = hash(password, user.passwordSalt);
    this.persist(user);
  }

  // ── Bloqueo por intentos fallidos ────────────────────────────────────────────────────────
  /** ¿La cuenta de este correo está bloqueada? (cuenta inexistente: `false`, como cualquier otra). */
  isLocked(email: string): boolean {
    return !!this.users.find((u) => u.email === email.toLowerCase())?.lockedAt;
  }

  /**
   * Cuenta un intento fallido de una cuenta que EXISTE y está activa; al llegar a `max` la bloquea.
   * Devuelve `true` solo en el intento que la bloqueó. Una cuenta inexistente no cuenta nada.
   */
  registerFailedLogin(email: string, max: number): boolean {
    const user = this.users.find((u) => u.email === email.toLowerCase());
    if (!user || user.disabledAt || user.lockedAt) return false;
    user.failedLogins += 1;
    if (user.failedLogins >= max) user.lockedAt = new Date();
    this.persist(user);
    return !!user.lockedAt;
  }

  clearFailedLogins(uuid: string): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (user && user.failedLogins !== 0) {
      user.failedLogins = 0;
      this.persist(user);
    }
  }

  /** Solo la administración lo llama (`PATCH /api/users/:uuid/status` con `locked: false`). */
  unlock(uuid: string): IAdminUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return null;
    user.lockedAt = null;
    user.failedLogins = 0;
    this.persist(user);
    return this.toAdmin(user);
  }

  // ── Autenticador (TOTP) ──────────────────────────────────────────────────────────────
  isTotpEnabled(uuid: string): boolean {
    return !!this.users.find((u) => u.uuid === uuid)?.totpSecret;
  }

  /** Guarda un secreto NUEVO pendiente de confirmar (reemplaza a uno pendiente anterior). */
  beginTotp(uuid: string, secret: string): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return;
    user.totpPendingSecret = sealSecret(secret, this.env.TOTP_ENCRYPTION_KEY);
    this.persist(user);
  }

  pendingTotpSecret(uuid: string): string | null {
    const sealed = this.users.find((u) => u.uuid === uuid)?.totpPendingSecret;
    return sealed ? openSecret(sealed, this.env.TOTP_ENCRYPTION_KEY) : null;
  }

  /** El secreto pendiente pasa a activo; `step` es el paso del código con que se confirmó. */
  activateTotp(uuid: string, step: number): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user?.totpPendingSecret) return;
    user.totpSecret = user.totpPendingSecret;
    user.totpPendingSecret = null;
    user.totpLastStep = step;
    this.persist(user);
  }

  disableTotp(uuid: string): void {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return;
    user.totpSecret = null;
    user.totpPendingSecret = null;
    user.totpLastStep = 0;
    this.persist(user);
  }

  /**
   * ¿El código es válido AHORA para el autenticador activo? Un paso ya usado (o anterior) se rechaza, y al
   * aceptar se registra el paso. `false` también si la cuenta no existe o no tiene autenticador.
   */
  consumeTotp(uuid: string, code: string, atMs: number): boolean {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user?.totpSecret) return false;
    const step = verifyTotp(openSecret(user.totpSecret, this.env.TOTP_ENCRYPTION_KEY), code, atMs);
    if (step === null || step <= user.totpLastStep) return false;
    user.totpLastStep = step;
    this.persist(user);
    return true;
  }

  /** Para confirmar el alta: valida contra el secreto PENDIENTE (sin consumir nada). */
  matchPendingTotp(uuid: string, code: string, atMs: number): number | null {
    const secret = this.pendingTotpSecret(uuid);
    return secret ? verifyTotp(secret, code, atMs) : null;
  }

  updateAvatar(uuid: string, avatarIcon: string | null, avatarColor: string | null): ISessionUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return null;
    user.avatarIcon = avatarIcon;
    user.avatarColor = avatarColor;
    this.persist(user);
    return this.toPublic(user);
  }

  /** Administración: todos los usuarios (activos o no) con búsqueda y filtro de rol, paginados. */
  listAdmin(filters: { search?: string; role?: EUserRole; page: number; take: number }): [IAdminUser[], number] {
    const term = filters.search?.trim().toLowerCase();
    const matches = this.users
      .filter((u) => (!filters.role || u.role === filters.role))
      .filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const start = (filters.page - 1) * filters.take;
    return [matches.slice(start, start + filters.take).map((u) => this.toAdmin(u)), matches.length];
  }

  findAdminByUuid(uuid: string): IAdminUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    return user ? this.toAdmin(user) : null;
  }

  countActiveAdmins(): number {
    return this.users.filter((u) => u.role === EUserRole.ADMIN && !u.disabledAt).length;
  }

  setRole(uuid: string, role: EUserRole): IAdminUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return null;
    user.role = role;
    this.persist(user);
    return this.toAdmin(user);
  }

  setDisabled(uuid: string, disabled: boolean): IAdminUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return null;
    user.disabledAt = disabled ? new Date() : null;
    this.persist(user);
    return this.toAdmin(user);
  }

  private toAdmin(user: IStoredUser): IAdminUser {
    return {
      ...(this.toPublic(user) as ISessionUser),
      emailVerified: !!user.emailVerifiedAt,
      disabled: !!user.disabledAt,
      locked: !!user.lockedAt,
      lockedAt: user.lockedAt,
      createdAt: user.createdAt,
    };
  }

  private toPublic(user: IStoredUser | undefined): ISessionUser | null {
    if (!user) return null;
    const { uuid, name, email, role, avatarIcon, avatarColor } = user;
    return { uuid, name, email, role, avatarIcon, avatarColor };
  }
}
