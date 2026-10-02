import { Component, inject } from '@angular/core';
import { CrudPage } from '../../shared/crud-page/crud-page';
import { USER_CRUD } from './user-form.config';
import { UsersService } from './users.service';

/** «Usuarios»: ver cuentas, cambiar el rol y deshabilitar/habilitar. Sin alta ni borrado manual. */
@Component({
  selector: 'app-users',
  imports: [CrudPage],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  protected readonly _service = inject(UsersService);
  protected readonly config = USER_CRUD;
}
