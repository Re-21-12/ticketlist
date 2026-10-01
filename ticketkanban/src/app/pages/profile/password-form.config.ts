import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { ChangePasswordFormSchema } from './profile.schema';

/** «Cambiar contraseña»: tres campos → grid plano, sin stepper. Todo lo demás sale del schema Zod. */
export const PASSWORD_FORM = defineForm({
  name: 'PASSWORD_FORM',
  schema: ChangePasswordFormSchema,
  fields: [
    {
      key: 'currentPassword',
      label: 'Contraseña actual',
      type: FieldType.PASSWORD,
      autocomplete: 'current-password',
      fullWidth: true,
    },
    {
      key: 'newPassword',
      label: 'Contraseña nueva',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      hint: 'Al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.',
      fullWidth: true,
    },
    {
      key: 'confirmPassword',
      label: 'Repite la contraseña nueva',
      type: FieldType.PASSWORD,
      autocomplete: 'new-password',
      fullWidth: true,
    },
  ],
});
