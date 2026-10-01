import {
  applyWhen,
  disabled,
  hidden,
  maxLength,
  readonly,
  validateStandardSchema,
  type SchemaFn,
  type SchemaPath,
} from '@angular/forms/signals';
import type * as z from 'zod';
import type { IFormDefinition } from './form-definition.interface';
import {
  deriveAllConstraints,
  probeMessage,
  TEXTUAL_TYPES,
} from './utils/field-constraints.util';

type TModel = Record<string, unknown>;
type TAnyPath = SchemaPath<unknown>;

/**
 * Traduce una `IFormDefinition` al schema de Signal Forms.
 *
 * Con wallet-api el builder tenía que mapear a mano cada metadata (`minLength` → `minLength()`,
 * `pattern` → `pattern()`, `minDate` → validator custom…). Aquí toda la validación es UNA línea:
 * `validateStandardSchema(root, zodSchema)` — Zod implementa Standard Schema y Signal Forms
 * reparte cada issue al campo según su `path`. El builder solo añade el estado de UI
 * (hidden/disabled/readonly/revealField), que no es responsabilidad de Zod.
 */
export function buildSchemaFn(
  definition: IFormDefinition,
  options: { readonlyMode: boolean },
): SchemaFn<TModel> {
  const revealTargets = new Set(
    definition.fields.flatMap((field) => (field.revealField ?? []).map((rule) => rule.key)),
  );

  const constraints = deriveAllConstraints(definition.schema, definition.fields);

  return (root) => {
    // Validación: 100% Zod (mismo schema que parsea el BFF).
    validateStandardSchema(root as never, definition.schema);

    const paths = root as unknown as Record<string, TAnyPath>;

    for (const field of definition.fields) {
      const path = paths[field.key];
      if (!path) continue;
      const state = field.state ?? {};

      // Límite de escritura: `[formField]` pone el atributo `maxlength` en el <input>/<textarea>
      // SOLO si el schema declara una regla nativa `maxLength()` (Angular prohíbe enlazar el atributo
      // a mano). El máximo sale del schema Zod y el mensaje también, así nunca divergen. Es un tope
      // de TECLADO: Zod sigue siendo quien valida (un valor precargado más largo también falla ahí).
      const max = constraints.get(field.key)?.maxLength;
      if (max != null && TEXTUAL_TYPES.has(field.type)) {
        const fieldSchema = definition.schema.shape[field.key] as z.ZodType;
        const message = probeMessage(fieldSchema, 'x'.repeat(max + 1));
        maxLength(path as never, max, message ? { message } : undefined);
      }

      // Un objetivo de revealField no recibe hidden/disabled constantes: los controla su regla.
      if (state.hidden && !revealTargets.has(field.key)) hidden(path, () => true);
      if (state.disabled && !revealTargets.has(field.key)) {
        disabled(path, state.disabledReason ?? (() => true));
      }
      if (state.readonly) readonly(path, () => true);
      if (options.readonlyMode) disabled(path, 'El formulario está en modo de solo lectura');
    }

    for (const field of definition.fields) {
      for (const rule of field.revealField ?? []) {
        const source = paths[field.key];
        const target = paths[rule.key];
        if (!source || !target) continue;
        // Texto legible de la opción que activa el campo (no el valor técnico).
        const triggerLabel =
          field.options?.find((option) => String(option.value) === String(rule.whenValue))?.label ??
          String(rule.whenValue);
        // hidden + disabled bajo UNA condición (`applyWhen`): mientras el campo disparador no tenga
        // el valor, el objetivo no se muestra ni se valida, y si algo lo deja visible (readonlyMode,
        // un `state.hidden: false`) explica POR QUÉ está deshabilitado — como wallet-api.
        applyWhen(
          target,
          ({ valueOf }) => String(valueOf(source)) !== String(rule.whenValue),
          (p) => {
            hidden(p, () => true);
            disabled(p, `Selecciona «${triggerLabel}» para habilitar este campo`);
          },
        );
      }
    }
  };
}
