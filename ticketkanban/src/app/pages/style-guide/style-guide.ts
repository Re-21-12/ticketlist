import { afterRenderEffect, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';
import { TagModule } from '@openng/optimus-ui/tag';
import { RouterLink } from '@angular/router';
import { MotionService } from '../../core/motion/motion.service';
import { PrimaryColorService } from '../../core/theme/primary-color.service';
import { ThemeService } from '../../core/theme/theme.service';
import { contrastRatio } from '../../core/utils/color-contrast.util';
import { resolveCssColor } from '../../core/utils/css-color.util';
import { Breadcrumb } from '../../shared/breadcrumb/breadcrumb';
import type { IBreadcrumbItem } from '../../shared/breadcrumb/breadcrumb.interface';
import { confirmDelete } from '../../shared/confirm/confirm-delete.util';
import { DynamicForm } from '../../shared/dynamic-form/dynamic-form';
import { TICKET_PRIORITY } from '../tickets/ticket.schema';
import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_SEVERITY } from '../tickets/ticket.constants';
import { FIELD_GALLERY_FORM } from './field-gallery.config';
import { CONTRAST_PAIRS, GUIDE_SECTIONS } from './style-guide.constants';
import type { IContrastResult } from './style-guide.interface';

/** Pausa del botón «Cargando» de la demo (simula un request). */
const LOADING_DEMO_MS = 1500;

/**
 * Guía de estilos WCAG 2.2 AA (mock): muestra los componentes REALES de la app (botones,
 * breadcrumb, formulario dinámico, tags, mensajes, toasts, confirmación, movimiento) junto a los
 * criterios que cumplen. El contenido vive en `style-guide.constants.ts`; aquí solo las demos.
 */
@Component({
  selector: 'app-style-guide',
  imports: [ButtonModule, MessageModule, TagModule, RouterLink, Breadcrumb, DynamicForm],
  templateUrl: './style-guide.html',
  styleUrl: './style-guide.css',
})
export class StyleGuide {
  private readonly _themeService = inject(ThemeService);
  private readonly _primaryColorService = inject(PrimaryColorService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  protected readonly _motionService = inject(MotionService);

  protected readonly sections = GUIDE_SECTIONS;
  protected readonly priorities = TICKET_PRIORITY;
  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly prioritySeverity = TICKET_PRIORITY_SEVERITY;
  protected readonly motionTiles = ['Por hacer', 'En progreso', 'Hecho', 'Archivado'];
  protected readonly breadcrumbDemo: IBreadcrumbItem[] = [
    { label: 'Tickets', link: '/tickets' },
    { label: 'Listado', link: '/tickets/list' },
    { label: 'TCK-001', link: null },
  ];
  /** Un campo de cada tipo de control (`field-gallery.config.ts`), en secciones sin stepper. */
  protected readonly galleryForm = FIELD_GALLERY_FORM;

  private readonly $_contrast = signal<IContrastResult[]>([]);
  protected readonly $contrast = this.$_contrast.asReadonly();
  protected readonly $loadingDemo = signal(false);
  protected readonly $panelOpen = signal(false);

  private readonly $_tiles = viewChild<ElementRef<HTMLElement>>('tilesList');

  constructor() {
    // Se mide DESPUÉS de pintar y se vuelve a medir al cambiar el modo o el color principal.
    afterRenderEffect(() => {
      this._themeService.$isDark();
      this._primaryColorService.$customColor();
      this.$_contrast.set(this.measureContrast());
    });
  }

  protected simulateLoading(): void {
    this.$loadingDemo.set(true);
    setTimeout(() => this.$loadingDemo.set(false), LOADING_DEMO_MS);
  }

  protected showToast(severity: 'success' | 'info' | 'warn' | 'error'): void {
    const summaries = { success: 'Ticket guardado', info: 'Hay cambios nuevos', warn: 'La sesión vence pronto', error: 'No se pudo guardar' };
    this._messageService.add({ severity, summary: summaries[severity], detail: 'Mensaje de ejemplo de la guía de estilos.' });
  }

  protected openConfirm(): void {
    confirmDelete(this._confirmationService, {
      header: 'Eliminar ticket',
      message: '¿Eliminar TCK-001? Podrás restaurarlo desde el listado.',
      accept: () => this._messageService.add({ severity: 'info', summary: 'Demo: no se eliminó nada' }),
    });
  }

  protected onDemoSubmit(): void {
    this._messageService.add({ severity: 'success', summary: 'Formulario válido', detail: 'Demo: no se guarda.' });
  }

  protected async playStagger(): Promise<void> {
    const container = this.$_tiles()?.nativeElement;
    if (container) await this._motionService.staggerIn([...container.children]);
  }

  private measureContrast(): IContrastResult[] {
    return CONTRAST_PAIRS.flatMap((pair) => {
      const foregroundHex = resolveCssColor(pair.foreground);
      const backgroundHex = resolveCssColor(pair.background);
      if (!foregroundHex || !backgroundHex) return [];
      const ratio = contrastRatio(foregroundHex, backgroundHex);
      return [{ ...pair, foregroundHex, backgroundHex, ratio, passes: ratio >= pair.minimum }];
    });
  }
}
