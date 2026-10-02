import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { firstValueFrom } from 'rxjs';
import { EAbility, EUserRole } from '../../core/casl/ability.enum';
import { ACTION_LABELS, SUBJECT_LABELS } from '../../core/casl/casl-labels.constants';
import { SUBJECTS, type TSubjects } from '../../core/casl/casl.types';
import { ROLE_LABELS } from '../../core/casl/role-labels.constants';
import { UserAvatar } from '../../core/ui/user-avatar/user-avatar';
import type { TRolePermission } from '../role-permissions/role-permission.types';
import { cellFor, hasAnyAccess, MATRIX_ACTIONS, type IMatrixCell } from './role-matrix.util';
import { RoleMatrixService } from './role-matrix.service';
import { Illustration } from '../../shared/ui/illustration/illustration';

export type TMatrixFilter = 'all' | 'allowed' | 'none';

interface IMatrixRow {
  subject: TSubjects;
  label: string;
  cells: (IMatrixCell & { action: EAbility; actionLabel: string })[];
}

/**
 * «Matriz de roles»: tarjetas resumen, selector de rol y la matriz recurso × acción del rol elegido,
 * más sus miembros. Un clic concede o quita el permiso (sin condición); lo que viene de «Administrar»
 * o «Todo el sistema» se muestra como heredado y no se apaga aquí. Para condiciones («solo lo asignado a
 * mí») está «Permisos por rol».
 */
@Component({
  selector: 'app-role-matrix',
  imports: [Illustration, FormsModule, RouterLink, InputTextModule, SelectModule, UserAvatar],
  templateUrl: './role-matrix.html',
  styleUrl: './role-matrix.css',
})
export class RoleMatrix {
  private readonly _service = inject(RoleMatrixService);
  private readonly _messageService = inject(MessageService);

  protected readonly actions = MATRIX_ACTIONS;
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly filterOptions: { label: string; value: TMatrixFilter }[] = [
    { label: 'Todos los recursos', value: 'all' },
    { label: 'Con algún permiso', value: 'allowed' },
    { label: 'Sin ningún permiso', value: 'none' },
  ];

  protected readonly $role = signal<EUserRole>(EUserRole.ADMIN);
  protected readonly $search = signal('');
  protected readonly $filter = signal<TMatrixFilter>('all');
  /** Celda en vuelo (`Ticket|create`): se deshabilita para que un doble clic no cree dos reglas. */
  protected readonly $busyCell = signal<string | null>(null);

  protected readonly $loading = computed(
    () => this._service.$rulesState().kind === 'loading' || this._service.$usersState().kind === 'loading',
  );
  protected readonly $failed = computed(
    () => this._service.$rulesState().kind === 'error' || this._service.$usersState().kind === 'error',
  );

  private readonly $_rules = computed<TRolePermission[]>(() => {
    const state = this._service.$rulesState();
    return state.kind === 'success' ? state.data.data : [];
  });
  private readonly $_users = computed(() => {
    const state = this._service.$usersState();
    return state.kind === 'success' ? state.data.data : [];
  });

  /** Hay más reglas de las que se cargaron (el backend entrega 100 por página). */
  protected readonly $truncated = computed(() => {
    const state = this._service.$rulesState();
    return state.kind === 'success' && state.data.meta.total > state.data.data.length;
  });

  protected readonly $roles = computed(() =>
    Object.values(EUserRole).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      members: this.$_users().filter((user) => user.role === role && !user.disabled).length,
      rules: this.$_rules().filter((rule) => rule.role === role).length,
    })),
  );

  protected readonly $stats = computed(() => ({
    roles: this.$roles().length,
    users: this.$_users().length,
    rules: this.$_rules().length,
    conditional: this.$_rules().filter((rule) => rule.condition !== 'NONE').length,
  }));

  protected readonly $selected = computed(() => this.$roles().find((entry) => entry.role === this.$role()));
  protected readonly $members = computed(() => this.$_users().filter((user) => user.role === this.$role()));

  protected readonly $rows = computed<IMatrixRow[]>(() => {
    const role = this.$role();
    const rules = this.$_rules();
    const term = this.$search().trim().toLowerCase();
    const filter = this.$filter();
    return SUBJECTS.filter((subject) => subject !== 'all')
      .map((subject) => ({
        subject,
        label: SUBJECT_LABELS[subject],
        cells: MATRIX_ACTIONS.map((action) => ({
          ...cellFor(rules, role, subject, action),
          action,
          actionLabel: ACTION_LABELS[action],
        })),
      }))
      .filter((row) => !term || row.label.toLowerCase().includes(term))
      .filter((row) => {
        const any = hasAnyAccess(rules, role, row.subject);
        return filter === 'all' || (filter === 'allowed' ? any : !any);
      });
  });

  protected select(role: EUserRole): void {
    this.$role.set(role);
  }

  protected cellTitle(row: IMatrixRow, cell: IMatrixRow['cells'][number]): string {
    const base = `${cell.actionLabel} · ${row.label}`;
    if (cell.state === 'inherited') return `${base}: lo concede «Administrar»; edítalo en Permisos por rol`;
    if (cell.state === 'on' && cell.conditional) return `${base}: con condición (solo una parte)`;
    return base;
  }

  protected async toggle(row: IMatrixRow, cell: IMatrixRow['cells'][number], checkbox: HTMLInputElement): Promise<void> {
    if (cell.state === 'inherited') return;
    const granted = checkbox.checked;
    const key = `${row.subject}|${cell.action}`;
    this.$busyCell.set(key);
    const role = this.$role();
    try {
      if (granted) await firstValueFrom(this._service.grant(role, row.subject, cell.action));
      else await firstValueFrom(this._service.revoke(cell.rules));
      this._service.reload();
      this._messageService.add({
        severity: 'success',
        summary: granted ? 'Permiso concedido' : 'Permiso quitado',
        detail: `${ROLE_LABELS[role]} · ${cell.actionLabel} · ${row.label}`,
        life: 3000,
      });
    } catch {
      // El toast del error lo muestra errorInterceptor; la casilla vuelve a mostrar lo que SÍ quedó guardado.
      checkbox.checked = !granted;
      this._service.reload();
    } finally {
      this.$busyCell.set(null);
    }
  }
}
