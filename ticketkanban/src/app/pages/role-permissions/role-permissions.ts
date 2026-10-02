import { Component, inject } from '@angular/core';
import { CrudPage } from '../../shared/crud-page/crud-page';
import { ROLE_PERMISSION_CRUD } from './role-permission-form.config';
import { RolePermissionsService } from './role-permissions.service';

/**
 * «Permisos por rol»: quién (rol) puede qué (acción) sobre qué (recurso) y bajo qué condición.
 * Un cambio rige desde la siguiente carga de sesión de las personas de ese rol.
 */
@Component({
  selector: 'app-role-permissions',
  imports: [CrudPage],
  templateUrl: './role-permissions.html',
  styleUrl: './role-permissions.css',
})
export class RolePermissions {
  protected readonly _service = inject(RolePermissionsService);
  protected readonly config = ROLE_PERMISSION_CRUD;
}
