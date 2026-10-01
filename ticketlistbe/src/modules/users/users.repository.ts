import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { ISessionUser } from '../auth/session/session-user.interface.js';
import { DEV_PASSWORD, USERS_SEED } from './users.seed.js';

interface IStoredUser extends ISessionUser {
  passwordSalt: Buffer;
  passwordHash: Buffer;
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
export class UsersRepository {
  private readonly users: IStoredUser[] = USERS_SEED.map((user) => {
    const salt = randomBytes(16);
    return { ...user, passwordSalt: salt, passwordHash: hash(DEV_PASSWORD, salt) };
  });

  findByUuid(uuid: string): ISessionUser | null {
    return this.toPublic(this.users.find((u) => u.uuid === uuid));
  }

  findByEmail(email: string): ISessionUser | null {
    return this.toPublic(this.users.find((u) => u.email === email.toLowerCase()));
  }

  /** `null` si el correo no existe O la contraseña no coincide (misma respuesta: no se enumeran usuarios). */
  verifyCredentials(email: string, password: string): ISessionUser | null {
    const user = this.users.find((u) => u.email === email.toLowerCase());
    // Se calcula el hash aunque el usuario no exista: mismo costo de tiempo en ambos casos.
    const salt = user?.passwordSalt ?? randomBytes(16);
    const candidate = hash(password, salt);
    if (!user || !timingSafeEqual(candidate, user.passwordHash)) return null;
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
  }

  updateAvatar(uuid: string, avatarIcon: string | null, avatarColor: string | null): ISessionUser | null {
    const user = this.users.find((u) => u.uuid === uuid);
    if (!user) return null;
    user.avatarIcon = avatarIcon;
    user.avatarColor = avatarColor;
    return this.toPublic(user);
  }

  private toPublic(user: IStoredUser | undefined): ISessionUser | null {
    if (!user) return null;
    const { uuid, name, email, role, avatarIcon, avatarColor } = user;
    return { uuid, name, email, role, avatarIcon, avatarColor };
  }
}
