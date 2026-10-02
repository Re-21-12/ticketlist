import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from '@openng/optimus-ui/select';
import { CrudPage } from '../../shared/crud-page/crud-page';
import { RELATIONSHIP_ADMIN_CRUD } from './relation-permission-form.config';
import { RelationPermissionsService } from './relation-permissions.service';

/**
 * «Relaciones»: quién comparte sus tickets con quién y qué puede hacer cada persona. Solo lectura +
 * revocar (por abuso o a pedido): una relación revocada queda como historial.
 */
@Component({
  selector: 'app-relation-permissions',
  imports: [CrudPage, FormsModule, SelectModule],
  templateUrl: './relation-permissions.html',
  styleUrl: './relation-permissions.css',
})
export class RelationPermissions {
  protected readonly _service = inject(RelationPermissionsService);
  protected readonly config = RELATIONSHIP_ADMIN_CRUD;
  protected readonly statusOptions = [
    { label: 'Activas', value: 'ACTIVE' },
    { label: 'Revocadas (historial)', value: 'REVOKED' },
  ];
  protected readonly $status = signal('');

  protected setStatus(status: string | null): void {
    this.$status.set(status ?? '');
    this._service.filterStatus(status ?? '');
  }
}
