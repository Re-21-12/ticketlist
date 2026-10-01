// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// ── Convenciones de nomenclatura (heredadas de wallet-api, ver AGENTS.md "Nomenclatura") ────
// En wallet-api son `warn` (hay código legacy sin migrar); aquí el proyecto nace limpio → `error`.

const SIGNAL_FACTORIES = new Set([
  'signal',
  'computed',
  'input',
  'output',
  'model',
  'viewChild',
  'viewChildren',
  'contentChild',
  'contentChildren',
  'linkedSignal',
  // Extensión respecto a wallet-api: toSignal() también devuelve un Signal.
  'toSignal',
]);

/** `signal(...)` → 'signal'; `input.required(...)` → 'input'; `this.$_x.asReadonly()` → 'asReadonly'. */
function factoryName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') {
    if (callee.object?.type === 'Identifier') return callee.object.name;
    if (callee.property?.type === 'Identifier') return callee.property.name;
  }
  return null;
}

function fieldName(node) {
  return node.key.type === 'Identifier' ? node.key.name : null;
}

const isPrivate = (node) => node.accessibility === 'private';
const isSignalInit = (init) =>
  init?.type === 'CallExpression' &&
  (SIGNAL_FACTORIES.has(factoryName(init.callee)) || factoryName(init.callee) === 'asReadonly');
const isInjectInit = (init) =>
  init?.type === 'CallExpression' && factoryName(init.callee) === 'inject';

const ticketitNamingPlugin = {
  rules: {
    /** Signals: `$algo`; signals `private`: `$_algo` (misma combinación que wallet-api, `$_itemUrl`). */
    'signals-dollar-prefix': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        return {
          PropertyDefinition(node) {
            if (!isSignalInit(node.value)) return;
            const name = fieldName(node);
            if (!name) return;
            if (isPrivate(node) && !name.startsWith('$_')) {
              context.report({ node: node.key, message: `Signal privada '${name}': usar prefijo '$_'.` });
            } else if (!isPrivate(node) && !name.startsWith('$')) {
              context.report({ node: node.key, message: `Signal '${name}': usar prefijo '$'.` });
            } else if (!isPrivate(node) && name.startsWith('$_')) {
              context.report({ node: node.key, message: `'${name}' no es private: el prefijo '$_' es solo para signals private.` });
            }
          },
        };
      },
    },
    /** Todo `inject()` en un campo: `_algo` (también si es protected/público para el template). */
    'inject-underscore-prefix': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        return {
          PropertyDefinition(node) {
            if (!isInjectInit(node.value)) return;
            const name = fieldName(node);
            if (name && !name.startsWith('_')) {
              context.report({ node: node.key, message: `Servicio inyectado '${name}': usar prefijo '_'.` });
            }
          },
        };
      },
    },
    /** Campos `private` que no son signal ni inject: `_algo` (constantes UPPER_CASE exentas). */
    'private-underscore-prefix': {
      meta: { type: 'suggestion', schema: [] },
      create(context) {
        return {
          PropertyDefinition(node) {
            if (!isPrivate(node) || isSignalInit(node.value) || isInjectInit(node.value)) return;
            const name = fieldName(node);
            if (name && !name.startsWith('_') && !/^[A-Z0-9_]+$/.test(name)) {
              context.report({ node: node.key, message: `Campo privado '${name}': usar prefijo '_'.` });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', '**/*.d.ts'] },
  {
    files: ['src/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    plugins: { '@ticketit': ticketitNamingPlugin },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@ticketit/signals-dollar-prefix': 'error',
      '@ticketit/inject-underscore-prefix': 'error',
      '@ticketit/private-underscore-prefix': 'error',
      // Tipos: interfaces `I`, type alias `T`, enums `E` (igual que wallet-api: IPaginatedResult,
      // TSubjects, EAbility). Excepción: `AppAbility`, companion object oficial de @casl/angular
      // (tipo + valor con el mismo nombre).
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
          prefix: ['T'],
          filter: { regex: '^AppAbility$', match: false },
        },
        { selector: 'enum', format: ['PascalCase'], prefix: ['E'] },
      ],
      // Escape hatch documentado en dynamic-field.ts (cvaNode) — permitido con comentario.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
