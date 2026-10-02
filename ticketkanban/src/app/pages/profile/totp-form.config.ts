import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { TotpDisableFormSchema, TotpEnableFormSchema } from './profile.schema';

/** Confirmar el alta del autenticador con el primer código que muestra la app. */
export const TOTP_ENABLE_FORM = defineForm({
  name: 'TOTP_ENABLE_FORM',
  schema: TotpEnableFormSchema,
  fields: [
    {
      key: 'code',
      label: 'Código de 6 dígitos',
      type: FieldType.TEXT_NUMBER,
      placeholder: '123456',
      autocomplete: 'one-time-code',
      hint: 'Escribe el que muestra tu app ahora mismo; así sabemos que quedó bien configurada.',
      fullWidth: true,
    },
  ],
});

/** Quitar el autenticador exige la contraseña actual. */
export const TOTP_DISABLE_FORM = defineForm({
  name: 'TOTP_DISABLE_FORM',
  schema: TotpDisableFormSchema,
  fields: [
    {
      key: 'currentPassword',
      label: 'Contraseña actual',
      type: FieldType.PASSWORD,
      autocomplete: 'current-password',
      fullWidth: true,
    },
  ],
});
