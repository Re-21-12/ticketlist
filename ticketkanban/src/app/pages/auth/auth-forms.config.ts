import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import {
  ForgotPasswordFormSchema,
  RecoverWithPasswordFormSchema,
  RecoverWithTotpFormSchema,
  ResetPasswordFormSchema,
  SignInFormSchema,
  SignUpFormSchema,
} from './auth.schema';

const PASSWORD_HINT = 'Al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.';

export const SIGN_IN_FORM = defineForm({
  name: 'SIGN_IN_FORM',
  schema: SignInFormSchema,
  fields: [
    {
      key: 'email',
      label: 'Correo',
      type: FieldType.EMAIL,
      placeholder: 'ana@empresa.com',
      autocomplete: 'username',
      fullWidth: true,
    },
    {
      key: 'password',
      label: 'Contraseña',
      type: FieldType.PASSWORD,
      autocomplete: 'current-password',
      fullWidth: true,
    },
  ],
});

export const SIGN_UP_FORM = defineForm({
  name: 'SIGN_UP_FORM',
  schema: SignUpFormSchema,
  fields: [
    { key: 'name', label: 'Nombre completo', type: FieldType.TEXT, autocomplete: 'name', fullWidth: true },
    {
      key: 'email',
      label: 'Correo',
      type: FieldType.EMAIL,
      placeholder: 'ana@empresa.com',
      autocomplete: 'email',
      fullWidth: true,
    },
    {
      key: 'password',
      label: 'Contraseña',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      hint: PASSWORD_HINT,
      fullWidth: true,
    },
    {
      key: 'confirmPassword',
      label: 'Repite la contraseña',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      fullWidth: true,
    },
  ],
});

export const FORGOT_PASSWORD_FORM = defineForm({
  name: 'FORGOT_PASSWORD_FORM',
  schema: ForgotPasswordFormSchema,
  fields: [
    {
      key: 'email',
      label: 'Correo de tu cuenta',
      type: FieldType.EMAIL,
      placeholder: 'ana@empresa.com',
      autocomplete: 'email',
      fullWidth: true,
    },
  ],
});

export const RESET_PASSWORD_FORM = defineForm({
  name: 'RESET_PASSWORD_FORM',
  schema: ResetPasswordFormSchema,
  fields: [
    {
      key: 'newPassword',
      label: 'Contraseña nueva',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      hint: PASSWORD_HINT,
      fullWidth: true,
    },
    {
      key: 'confirmPassword',
      label: 'Repite la contraseña',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      fullWidth: true,
    },
  ],
});

const EMAIL_FIELD = {
  key: 'email',
  label: 'Correo de tu cuenta',
  type: FieldType.EMAIL,
  placeholder: 'ana@empresa.com',
  autocomplete: 'email',
  fullWidth: true,
} as const;

const NEW_PASSWORD_FIELDS = [
  {
    key: 'newPassword',
    label: 'Contraseña nueva',
    type: FieldType.PASSWORD,
    autocomplete: 'new-password',
    hint: PASSWORD_HINT,
    fullWidth: true,
  },
  {
    key: 'confirmPassword',
    label: 'Repite la contraseña',
    type: FieldType.PASSWORD,
    autocomplete: 'new-password',
    fullWidth: true,
  },
] as const;

/** Recuperar con el código del autenticador (TOTP): la persona elige su contraseña nueva. */
export const RECOVER_TOTP_FORM = defineForm({
  name: 'RECOVER_TOTP_FORM',
  schema: RecoverWithTotpFormSchema,
  fields: [
    EMAIL_FIELD,
    {
      key: 'code',
      label: 'Código del autenticador',
      type: FieldType.TEXT_NUMBER,
      placeholder: '123456',
      autocomplete: 'one-time-code',
      hint: 'Los 6 dígitos que muestra tu app (Google Authenticator, Authy, 1Password…). Cambian cada 30 segundos.',
      fullWidth: true,
    },
    ...NEW_PASSWORD_FIELDS,
  ],
});

/** Recuperar con la contraseña anterior (la actual): la persona elige una nueva. */
export const RECOVER_PASSWORD_FORM = defineForm({
  name: 'RECOVER_PASSWORD_FORM',
  schema: RecoverWithPasswordFormSchema,
  fields: [
    EMAIL_FIELD,
    {
      key: 'currentPassword',
      label: 'Contraseña actual',
      type: FieldType.PASSWORD,
      autocomplete: 'current-password',
      fullWidth: true,
    },
    ...NEW_PASSWORD_FIELDS,
  ],
});
