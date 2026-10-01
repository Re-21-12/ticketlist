import { FieldType } from '../field-config.interface';
import { resolveFieldIcon } from './infer-field-icon.util';

describe('resolveFieldIcon', () => {
  it('un icon explícito gana, y "" lo desactiva', () => {
    expect(resolveFieldIcon({ key: 'title', type: FieldType.TEXT, icon: 'pi pi-star' })).toBe(
      'pi pi-star',
    );
    expect(resolveFieldIcon({ key: 'title', type: FieldType.TEXT, icon: '' })).toBe('');
  });

  it('se infiere del nombre del campo', () => {
    expect(resolveFieldIcon({ key: 'assigneeEmail', type: FieldType.EMAIL })).toBe('pi pi-envelope');
    expect(resolveFieldIcon({ key: 'dueDate', type: FieldType.DATE })).toBe('pi pi-calendar');
    expect(resolveFieldIcon({ key: 'estimateHours', type: FieldType.INTEGER })).toBe('pi pi-clock');
  });

  it('cae al tipo de control cuando el nombre no dice nada', () => {
    expect(resolveFieldIcon({ key: 'zzz', type: FieldType.PHONE })).toBe('pi pi-phone');
  });

  it('los grupos y archivos no llevan ícono', () => {
    expect(resolveFieldIcon({ key: 'priority', type: FieldType.RADIO_BUTTON })).toBe('');
    expect(resolveFieldIcon({ key: 'file', type: FieldType.FILE })).toBe('');
  });
});
