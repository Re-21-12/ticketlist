import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from '@openng/optimus-ui/select';
import { CrudPage } from '../../shared/crud-page/crud-page';
import { AUDIT_ACTION_OPTIONS, AUDIT_LOG_CRUD, AUDIT_OUTCOME_OPTIONS } from './audit-log-form.config';
import type { IAuditFilters } from './audit-log.types';
import { AuditLogsService } from './audit-logs.service';

/**
 * «Auditoría»: quién hizo qué y con qué resultado (también lo DENEGADO). Solo lectura. Filtros por
 * acción y resultado; la búsqueda de texto y la paginación las hace el servidor.
 */
@Component({
  selector: 'app-audit-logs',
  imports: [CrudPage, FormsModule, SelectModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css',
})
export class AuditLogs {
  protected readonly _service = inject(AuditLogsService);
  protected readonly config = AUDIT_LOG_CRUD;

  protected readonly actionOptions = AUDIT_ACTION_OPTIONS;
  protected readonly outcomeOptions = AUDIT_OUTCOME_OPTIONS;
  protected readonly $action = signal('');
  protected readonly $outcome = signal('');

  protected setAction(action: string | null): void {
    this.$action.set(action ?? '');
    this.apply();
  }

  protected setOutcome(outcome: string | null): void {
    this.$outcome.set(outcome ?? '');
    this.apply();
  }

  private apply(): void {
    const filters: IAuditFilters = { action: this.$action(), outcome: this.$outcome() };
    this._service.filterBy(filters);
  }
}
