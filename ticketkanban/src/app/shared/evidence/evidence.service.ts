import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mockAttachmentUrl } from '../../core/mock-bff/mock-attachments';
import { AttachmentRefSchema } from './evidence.schema';
import type { TAttachmentRef } from './evidence.types';

/** Subida y descarga de evidencia de un ticket (`/api/tickets/:uuid/attachments`): solo transporte + validación Zod. */
@Service()
export class EvidenceService {
  private readonly _http = inject(HttpClient);

  /** Sube UN archivo (multipart, campo `file`). El backend lo valida por su contenido y lo guarda en el bucket. */
  upload(ticketUuid: string, file: File): Observable<TAttachmentRef> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this._http.post<unknown>(`/api/tickets/${encodeURIComponent(ticketUuid)}/attachments`, body).pipe(map((raw) => AttachmentRefSchema.parse(raw)));
  }

  /** Dirección para mostrar o descargar un adjunto (misma origin: viaja la cookie de sesión). En mock, un `blob:`. */
  url(ticketUuid: string, attachmentId: string): string {
    if (environment.useMockBff) return mockAttachmentUrl(attachmentId) ?? '';
    return `/api/tickets/${encodeURIComponent(ticketUuid)}/attachments/${encodeURIComponent(attachmentId)}`;
  }
}
