import type { ConfirmationService } from '@openng/optimus-ui/api';

/** Lo que varía por pantalla en una confirmación de borrado (el resto es fijo en todo el repo). */
export interface IConfirmDeleteOptions {
  header: string;
  message: string;
  accept: () => void;
  acceptLabel?: string;
}

/**
 * Confirmación de borrado con la config estándar (port de wallet-api): «Eliminar» danger,
 * «Cancelar» secundario outlined, foco inicial en CANCELAR (acción destructiva nunca por
 * defecto — WCAG 3.3.4). Requiere `<p-confirmdialog>` en app.html.
 */
export function confirmDelete(confirmationService: ConfirmationService, options: IConfirmDeleteOptions): void {
  confirmationService.confirm({
    header: options.header,
    message: options.message,
    acceptButtonProps: { severity: 'danger', label: options.acceptLabel ?? 'Eliminar' },
    rejectButtonProps: { severity: 'secondary', outlined: true, label: 'Cancelar' },
    defaultFocus: 'reject',
    accept: options.accept,
  });
}
