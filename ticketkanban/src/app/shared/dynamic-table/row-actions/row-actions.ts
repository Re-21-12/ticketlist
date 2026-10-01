import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { CanPipe } from '../../../core/casl/can.pipe';
import type { TSubjects } from '../../../core/casl/casl.types';
import type { TTableAction, TTableRow } from '../dynamic-table.interface';

/**
 * Botones de una fila (port de `RowActions` de wallet-api). No navega ni llama al backend: solo
 * emite. Editar/Eliminar se muestran si la acción está habilitada Y la sesión puede hacerlo
 * sobre ESTA fila (pipe `can` con la instancia → evalúa reglas con condiciones). Si no se puede
 * editar pero sí ver, «Ver» sigue disponible. Alineados a la derecha (regla de wallet-api).
 */
@Component({
  selector: 'app-row-actions',
  imports: [ButtonModule, TooltipModule, CanPipe],
  templateUrl: './row-actions.html',
  styleUrl: './row-actions.css',
})
export class RowActions {
  readonly $row = input.required<TTableRow>();
  readonly $subject = input.required<TSubjects>();
  readonly $actions = input<TTableAction[]>(['view', 'update', 'delete']);
  /** Nombre legible de la fila para lectores de pantalla («Editar TCK-001»). */
  readonly $rowLabel = input('');
  readonly $busy = input(false);

  readonly $view = output<TTableRow>();
  readonly $edit = output<TTableRow>();
  readonly $delete = output<TTableRow>();

  protected readonly $hasView = computed(() => this.$actions().includes('view'));
  protected readonly $hasUpdate = computed(() => this.$actions().includes('update'));
  protected readonly $hasDelete = computed(() => this.$actions().includes('delete'));
}
