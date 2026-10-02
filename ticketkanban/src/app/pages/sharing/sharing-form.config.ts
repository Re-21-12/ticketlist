import { FieldType, type IFieldConfig } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { GrantsFormSchema, ShareFormSchema } from './relationship.schema';

/** Texto de consentimiento vigente (la versión la guarda el backend con cada concesión). */
const CONSENT_FIELD: IFieldConfig<'consent'> = {
  key: 'consent',
  label: 'Consentimiento',
  type: FieldType.CHECKBOX,
  hint: 'Entiendo que esta persona podrá ver mis tickets y hacer lo que marqué arriba. Puedo cambiarlo o revocarlo cuando quiera.',
  fullWidth: true,
};

const PERMISSION_FIELDS: IFieldConfig<'canUpdate' | 'notifyTitular'>[] = [
  {
    key: 'canUpdate',
    label: 'Puede editar mis tickets',
    type: FieldType.TOGGLE,
    toggleLabels: { on: 'Sí, puede editar', off: 'Solo lectura' },
    hint: 'Leer siempre va incluido. Eliminar nunca se comparte (solo el administrador elimina) y un rol de solo lectura nunca edita, aunque se lo concedas.',
    fullWidth: true,
  },
  {
    key: 'notifyTitular',
    label: 'Avisarme de sus cambios',
    type: FieldType.TOGGLE,
    toggleLabels: { on: 'Sí, avisarme', off: 'No avisarme' },
    fullWidth: true,
  },
];

export const SHARE_FORM = defineForm({
  name: 'SHARE_FORM',
  schema: ShareFormSchema,
  fields: [
    {
      key: 'alternanteEmail',
      label: 'Correo de la persona',
      type: FieldType.EMAIL,
      placeholder: 'persona@empresa.com',
      hint: 'Debe tener cuenta en Ticketit.',
      fullWidth: true,
    },
    ...PERMISSION_FIELDS,
    CONSENT_FIELD,
  ],
});

export const GRANTS_FORM = defineForm({
  name: 'GRANTS_FORM',
  schema: GrantsFormSchema,
  fields: [...PERMISSION_FIELDS, CONSENT_FIELD],
});
