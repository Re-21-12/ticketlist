import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';
import { confirmDelete } from '../../shared/confirm/confirm-delete.util';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import { GRANTS_FORM, SHARE_FORM } from './sharing-form.config';
import type { TRelationship } from './relationship.types';
import { SharingService } from './sharing.service';
import { Illustration } from '../../shared/ui/illustration/illustration';

/**
 * «Compartir mis tickets»: el titular da acceso a SUS tickets a otra persona (el alternante), con
 * permisos granulares y consentimiento. Revocar conserva el historial. Abajo: lo que otras personas
 * compartieron conmigo (solo lectura).
 */
@Component({
  selector: 'app-sharing',
  imports: [Illustration, ButtonModule, DatePipe],
  providers: [DialogService, FormDialogService],
  templateUrl: './sharing.html',
  styleUrl: './sharing.css',
})
export class Sharing {
  private readonly _service = inject(SharingService);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  protected readonly $saving = signal(false);

  private readonly $_all = computed<TRelationship[]>(() => {
    const state = this._service.$listState();
    return state.kind === 'success' ? state.data : [];
  });
  protected readonly $loading = computed(() => this._service.$listState().kind === 'loading');
  protected readonly $failed = computed(() => this._service.$listState().kind === 'error');

  /** Lo que comparto yo (vigente primero, luego el historial de revocadas). */
  protected readonly $byMe = computed(() =>
    this.$_all()
      .filter((relationship) => relationship.myRole === 'TITULAR')
      .sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.createdAt.localeCompare(a.createdAt)),
  );
  protected readonly $withMe = computed(() =>
    this.$_all().filter((relationship) => relationship.myRole === 'ALTERNANTE' && relationship.status === 'ACTIVE'),
  );

  protected onShare(): void {
    void this._formDialogService.open({
      header: 'Compartir mis tickets',
      definition: SHARE_FORM,
      // `consent` arranca sin marcar (casilla en falso): hay que aceptarlo cada vez.
      initialData: { canUpdate: false, notifyTitular: true },
      submitLabel: 'Compartir',
      submitting: this.$saving,
      onSubmit: (form) => void this.run(() => firstValueFrom(this._service.share(form)), 'Tickets compartidos'),
    });
  }

  protected onEdit(relationship: TRelationship): void {
    const grant = relationship.grants[0];
    void this._formDialogService.open({
      header: `Permisos de ${relationship.alternanteEmail}`,
      definition: GRANTS_FORM,
      // El consentimiento se vuelve a dar al cambiar lo concedido (cada cambio guarda la versión vigente).
      initialData: {
        canUpdate: grant?.canUpdate ?? false,
        notifyTitular: grant?.notifyTitular ?? true,
      },
      submitting: this.$saving,
      onSubmit: (form) =>
        void this.run(() => firstValueFrom(this._service.updateGrants(relationship.uuid, form)), 'Permisos actualizados'),
    });
  }

  protected onRevoke(relationship: TRelationship): void {
    confirmDelete(this._confirmationService, {
      header: 'Dejar de compartir',
      message: `¿Dejar de compartir tus tickets con ${relationship.alternanteEmail}? Perderá el acceso de inmediato; el historial se conserva.`,
      acceptLabel: 'Dejar de compartir',
      accept: () => void this.run(() => firstValueFrom(this._service.revoke(relationship.uuid)), 'Acceso revocado'),
    });
  }

  /** Resumen en palabras de lo concedido (el estado no depende solo de íconos o color). */
  protected summary(relationship: TRelationship): string {
    const grant = relationship.grants[0];
    if (!grant) return 'Sin permisos';
    const parts = ['Leer', ...(grant.canUpdate ? ['editar'] : [])];
    return parts.join(' · ');
  }

  private async run(request: () => Promise<unknown>, summary: string): Promise<void> {
    this.$saving.set(true);
    try {
      await request();
      this._formDialogService.close();
      this._service.reload();
      this._messageService.add({ severity: 'success', summary, life: 3000 });
    } catch {
      // El toast del error lo muestra errorInterceptor; el modal queda abierto para reintentar.
    } finally {
      this.$saving.set(false);
    }
  }
}
