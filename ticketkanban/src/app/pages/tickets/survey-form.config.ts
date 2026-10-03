import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { defineForm } from '../../shared/dynamic-form/form-definition.interface';
import { SurveyFormSchema } from './ticket.schema';

/** Escala CSAT: 1 estrella = muy mala … 5 = excelente. El texto acompaña siempre a las estrellas. */
export const SURVEY_OPTIONS = [
  { value: 1, label: 'Muy mala' },
  { value: 2, label: 'Mala' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Buena' },
  { value: 5, label: 'Excelente' },
];

/**
 * Encuesta de cierre (CU02): si se resolvió el problema (obligatorio), calificación de 1 a 5 (CSAT, meta del equipo ≥ 4.5) y un
 * comentario opcional.
 */
export const TICKET_SURVEY_FORM = defineForm({
  name: 'TICKET_SURVEY_FORM',
  schema: SurveyFormSchema,
  fields: [
    {
      key: 'resolved',
      label: '¿Se resolvió tu problema?',
      type: FieldType.RADIO,
      options: [
        { value: 'yes', label: 'Sí, se resolvió' },
        { value: 'no', label: 'No, sigue sin resolverse' },
      ],
      fullWidth: true,
    },
    {
      key: 'score',
      label: 'Tu calificación',
      type: FieldType.RATING,
      options: SURVEY_OPTIONS,
      hint: 'De 1 (muy mala) a 5 (excelente). Con ella medimos la satisfacción del servicio; la meta del equipo es 4.5.',
      fullWidth: true,
    },
    {
      key: 'comment',
      label: 'Comentario',
      type: FieldType.TEXTAREA,
      rows: 4,
      placeholder: '¿Qué hicimos bien o qué podemos mejorar?',
      fullWidth: true,
    },
  ],
});
