import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { IPickedEvidence } from '../../shared/evidence/evidence-picker/evidence-picker';
import { EvidenceService } from '../../shared/evidence/evidence.service';
import { MyTicketsService } from '../my-tickets/my-tickets.service';

/**
 * Sube la evidencia elegida (`app-evidence-picker`) a un ticket RECIÉN CREADO y la deja como un comentario público
 * («Evidencia adjunta al registrar el ticket») para que aparezca en el historial. Lo usan el alta rápida y el diálogo
 * «Nuevo ticket»: el bucket guarda la evidencia POR ticket, así que no se puede subir antes de que exista.
 */
@Service()
export class EvidenceAttachService {
  private readonly _evidence = inject(EvidenceService);
  private readonly _thread = inject(MyTicketsService);

  /** Devuelve cuántos archivos NO se pudieron subir (el ticket ya existe: nunca lanza). */
  async attach(ticketUuid: string, files: readonly IPickedEvidence[]): Promise<number> {
    if (files.length === 0) return 0;
    const ids: string[] = [];
    for (const { file } of files) {
      try {
        ids.push((await firstValueFrom(this._evidence.upload(ticketUuid, file))).id);
      } catch {
        // El servidor es la última palabra (tipo por firma, duración): `errorInterceptor` ya mostró el motivo.
      }
    }
    if (ids.length > 0) {
      try {
        await firstValueFrom(this._thread.comment(ticketUuid, 'Evidencia adjunta al registrar el ticket.', ids));
      } catch {
        return files.length;
      }
    }
    return files.length - ids.length;
  }

  /** Texto del aviso cuando algún archivo no subió (el ticket sí se creó). */
  static missingDetail(failed: number): string {
    return `El ticket se creó, pero ${failed} ${failed === 1 ? 'archivo no se subió' : 'archivos no se subieron'}. Agrégalo como comentario desde «Mis tickets».`;
  }
}
