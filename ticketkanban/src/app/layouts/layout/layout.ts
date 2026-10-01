import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AbilityServiceSignal } from '@casl/angular';
import { filter, map } from 'rxjs';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DrawerModule } from '@openng/optimus-ui/drawer';
import { SelectModule } from '@openng/optimus-ui/select';
import { EUserRole } from '../../core/casl/ability.enum';
import { ROLE_LABELS } from '../../core/casl/role-labels.constants';
import type { AppAbility } from '../../core/casl/casl.types';
import { resolveVisibleMenuItems } from '../../core/casl/menu-visibility.util';
import { isRoutable, routableRoots } from '../../core/routing/routable.util';
import { SessionStore } from '../../core/session/session.store';
import { ThemeService } from '../../core/theme/theme.service';
import { UserAvatar } from '../../core/ui/user-avatar/user-avatar';
import { Breadcrumb } from '../../shared/breadcrumb/breadcrumb';
import type { IBreadcrumbItem } from '../../shared/breadcrumb/breadcrumb.interface';
import type { INavItem, TNavNode } from './layout.interface';

/** Opciones del selector de rol de prueba (solo desarrollo: `environment.devSignIn`). */
const ROLE_OPTIONS = Object.values(EUserRole).map((value) => ({ value, label: ROLE_LABELS[value] }));

/**
 * Shell de la app (port simplificado del `Layout` de wallet-api): sidebar data-driven con
 * submenús, topbar con breadcrumb derivado de la URL y `<router-outlet>`. En mobile el menú es un
 * drawer que abre por la derecha (mano dominante), igual que en wallet-api.
 *
 * Menú: el catálogo llega de `GET /api/bff/shell`; QUIÉN ve cada ítem lo decide CASL acá con
 * `subject` + `requiredAction` (una sola fuente de permisos: las reglas de la sesión). Como
 * `AbilityServiceSignal.can()` lee un signal, `$navItems` se recalcula solo al cambiar el rol.
 */
@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
    FormsModule,
    ButtonModule,
    DrawerModule,
    SelectModule,
    Breadcrumb,
    UserAvatar,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private readonly _router = inject(Router);
  private readonly _abilityService = inject<AbilityServiceSignal<AppAbility>>(AbilityServiceSignal);
  protected readonly _sessionStore = inject(SessionStore);
  protected readonly _themeService = inject(ThemeService);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly $drawerOpen = signal(false);
  protected readonly $switchingRole = signal(false);

  /**
   * El menú lo publica el BFF; si publica un destino que el front aún no tiene, el comodín `**` lo
   * devolvería al inicio en silencio («el menú no me redirige»). Solo se muestran destinos que el
   * router sabe atender.
   */
  private readonly $_navItems = computed(() => {
    const roots = routableRoots(this._router.config);
    return resolveVisibleMenuItems(
      this._sessionStore.$menu(),
      this._abilityService,
      this._sessionStore.$role(),
    ).filter((item) => isRoutable(item.route, roots));
  });

  /** URL + `title` de la ruta hoja activa, reactivos a cada navegación. */
  private readonly $_location = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.readLocation()),
    ),
    { initialValue: this.readLocation() },
  );

  /** Ítems sueltos + grupos, conservando el orden en que aparece cada grupo. */
  protected readonly $navTree = computed<TNavNode[]>(() => {
    const nodes: TNavNode[] = [];
    const groups = new Map<string, Extract<TNavNode, { kind: 'group' }>>();
    for (const item of this.$_navItems()) {
      if (!item.group) {
        nodes.push({ kind: 'item', item });
        continue;
      }
      let group = groups.get(item.group);
      if (!group) {
        group = { kind: 'group', label: item.group, items: [] };
        groups.set(item.group, group);
        nodes.push(group);
      }
      group.items.push(item);
    }
    return nodes;
  });

  /**
   * Breadcrumb: la sección es el primer segmento de la URL resuelto contra el menú; el último
   * crumb es el `title` de la ruta activa. Basado en la URL, no en el historial, para que
   * funcione igual tras refrescar o entrar por link directo.
   */
  protected readonly $breadcrumbs = computed<IBreadcrumbItem[]>(() => {
    const { path, title: current } = this.$_location();
    const [section] = path.split('/').filter(Boolean);
    const sectionItem: INavItem | undefined = this._sessionStore
      .$menu()
      .find((item) => item.route === `/${section}`);
    if (!sectionItem || sectionItem.route === path) return [{ label: current, link: null }];
    return [
      { label: sectionItem.label, link: sectionItem.route },
      { label: current, link: null },
    ];
  });

  /**
   * Cambia de rol (SOLO desarrollo): inicia sesión como el usuario sembrado de ese rol. Si la
   * pantalla actual deja de estar permitida, se re-evalúan los guards navegando a la misma URL:
   * `canGuard` redirige si ya no aplica.
   */
  protected async onRoleChange(role: EUserRole): Promise<void> {
    await this.runSessionChange(() => this._sessionStore.signInAs(role));
  }

  protected async onSignOut(): Promise<void> {
    await this.runSessionChange(() => this._sessionStore.signOut());
  }

  private async runSessionChange(change: () => Promise<void>): Promise<void> {
    this.$switchingRole.set(true);
    try {
      await change();
      await this._router.navigateByUrl(this._router.url, { onSameUrlNavigation: 'reload' });
    } finally {
      this.$switchingRole.set(false);
    }
  }

  private readLocation(): { path: string; title: string } {
    let route: ActivatedRouteSnapshot = this._router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return { path: this._router.url.split('?')[0], title: route.title ?? '' };
  }
}
