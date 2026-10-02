#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────────────────────────
// Genera los 3 Docker Secrets de Ticketit en deploy/secrets/ (gitignored: nunca se commitean), incluido
// el SEED DE USUARIOS POR ROL, y las contraseñas de Postgres/Redis para la pestaña «Environment» de Dokploy. Mismo patrón que
// `generate-secrets.mjs` de wallet-api (sin dependencias: solo Node).
//
//   node deploy/generate-secrets.mjs            # genera lo que FALTE; no pisa nada que ya exista
//   node deploy/generate-secrets.mjs --force    # regenera TODO (¡ver el aviso del autenticador abajo!)
//   node deploy/generate-secrets.mjs --env      # además imprime las variables de entorno con claves nuevas
//   node deploy/generate-secrets.mjs --domain empresa.com   # correos de las cuentas: admin@empresa.com, …
//
// Archivos (los lee `docker-compose.dokploy.yml` como `../files/secrets/<nombre>`):
//   ticketit_session_secret            firma de la cookie de sesión `sid`
//   ticketit_totp_encryption_key       cifra en reposo los secretos TOTP (autenticador)
//   ticketit_seed_users                JSON con UNA cuenta por rol (ADMIN, SUPERVISOR, AGENT, AUDITOR, VIEWER)
//                                      y contraseñas aleatorias propias (SEED_DEMO_DATA=false)
//
// ⚠ NO regeneres `ticketit_totp_encryption_key` en un sistema que ya está en uso: los autenticadores
//    configurados dejarían de descifrarse y cada persona tendría que volver a configurar el suyo.
//    Por eso, sin `--force`, un archivo existente NUNCA se sobrescribe.
// ────────────────────────────────────────────────────────────────────────────────────────────────
import { randomBytes, randomInt } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const printEnv = args.has('--env');
const argv = process.argv.slice(2);
const domainIndex = argv.indexOf('--domain');
const domain = domainIndex >= 0 ? argv[domainIndex + 1] : 'ticketit.local';
if (!domain || domain.startsWith('--') || !/^[a-z0-9.-]+\.[a-z]{2,}$|^ticketit\.local$/i.test(domain)) {
  console.error('--domain necesita un dominio válido, p. ej. --domain empresa.com');
  process.exit(1);
}

const secretsDir = join(dirname(fileURLToPath(import.meta.url)), 'secrets');
mkdirSync(secretsDir, { recursive: true });

/** Clave aleatoria en hex (256 bits). */
const hex = () => randomBytes(32).toString('hex');

/** Contraseña legible de 24 caracteres con mayúscula, minúscula, número y símbolo (sin caracteres ambiguos). */
function strongPassword(length = 24) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*+-=?'];
  const all = sets.join('');
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Una cuenta por rol: cada una con su contraseña aleatoria (nada de claves compartidas ni públicas). */
const accounts = [
  { name: 'Administrador', email: `admin@${domain}`, role: 'ADMIN', password: strongPassword() },
  { name: 'Supervisor', email: `supervisor@${domain}`, role: 'SUPERVISOR', password: strongPassword() },
  { name: 'Soporte N1', email: `soporte@${domain}`, role: 'AGENT', password: strongPassword() },
  { name: 'Auditor', email: `auditor@${domain}`, role: 'AUDITOR', password: strongPassword() },
  { name: 'Cliente', email: `cliente@${domain}`, role: 'VIEWER', password: strongPassword() },
];
const files = {
  ticketit_session_secret: hex(),
  ticketit_totp_encryption_key: hex(),
  ticketit_seed_users: JSON.stringify(accounts, null, 2),
};

const created = [];
const kept = [];
for (const [name, value] of Object.entries(files)) {
  const path = join(secretsDir, name);
  if (existsSync(path) && !force) {
    kept.push(name);
    continue;
  }
  // Sin salto de línea final: el entrypoint de la API lee el archivo tal cual.
  writeFileSync(path, value, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows: los permisos POSIX no aplican.
  }
  created.push(name);
}

console.log(`Secrets en ${secretsDir}`);
for (const name of created) console.log(`  ✓ generado   ${name}`);
for (const name of kept) console.log(`  · ya existía ${name}  (no se tocó; usa --force para regenerar)`);

if (created.includes('ticketit_seed_users')) {
  console.log('\nCuentas iniciales (guarda las claves AHORA: no se vuelven a mostrar; cada persona debe cambiar la suya al entrar):');
  for (const account of accounts) console.log(`  ${account.role.padEnd(10)} ${account.email.padEnd(32)} ${account.password}`);
  console.log('Más cuentas se crean luego desde Admin → Usuarios; el registro público siempre crea VIEWER.');
}

if (printEnv) {
  console.log('\nVariables para la pestaña «Environment» de Dokploy (claves nuevas; no las reutilices):');
  console.log(`DB_PASSWORD=${hex()}`);
  console.log(`REDIS_PASSWORD=${hex()}`);
  console.log(`TICKETIT_DB_PASSWORD=${hex()}   # solo para la integración con wallet-api`);
}

console.log(`
Siguiente paso: copia la carpeta al VPS, junto al compose de Dokploy (la carpeta «files» sobrevive a los redeploys):
  scp -r deploy/secrets/* root@TU_VPS:/etc/dokploy/compose/<proyecto>/files/secrets/
  ssh root@TU_VPS 'chmod 600 /etc/dokploy/compose/<proyecto>/files/secrets/*'
Respalda ticketit_totp_encryption_key por separado: si se pierde, los autenticadores ya configurados dejan de servir.`);
