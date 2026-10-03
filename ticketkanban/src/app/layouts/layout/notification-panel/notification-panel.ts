import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { OverlayBadgeModule } from '@openng/optimus-ui/overlaybadge';
import { Popover, PopoverModule } from '@openng/optimus-ui/popover';
import { NotificationStreamService } from '../../../core/realtime/notification-stream.service';
import { SessionStore } from '../../../core/session/session.store';
import { NOTIFICATION_ICONS } from '../../../pages/profile/profile.constants';
import { ProfileStore } from '../../../pages/profile/profile.store';
import type { TNotification } from '../../../pages/profile/profile.types';
import { INBOX_LIMIT, INBOX_POLL_MS, NOTIFICATION_ROUTES, REQUESTER_TICKET_TYPES } from './notification-panel.constants';

/**
 * Buzón de notificaciones del topbar (port del `NotificationPanel` de wallet-api): campana con contador y un popover
 * con las últimas pendientes. Marcar una como leída la saca de la bandeja (el historial completo está en Mi perfil →
 * Notificaciones). Abrir una la marca leída y lleva a su pantalla. Sin tiempo real en el backend, se consulta cada
 * minuto (solo con la pestaña visible) y un aviso emergente anuncia las nuevas.
 */
@Component({
  selector: 'app-notification-panel',
  imports: [DatePipe, ButtonModule, OverlayBadgeModule, PopoverModule],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.css',
})
export class NotificationPanel {
  private readonly _profileStore = inject(ProfileStore);
  private readonly _sessionStore = inject(SessionStore);
  private readonly _router = inject(Router);
  private readonly _messageService = inject(MessageService);
  private readonly _stream = inject(NotificationStreamService);
  protected readonly icons = NOTIFICATION_ICONS;

  /** Pendientes (las más nuevas primero), sin pasar de `INBOX_LIMIT`. */
  protected readonly $pending = computed(() => {
    const state = this._profileStore.$notificationsState();
    return state.kind === 'success' ? state.data.data.filter((n) => !n.readAt).slice(0, INBOX_LIMIT) : [];
  });
  protected readonly $unread = this._profileStore.$unreadNotifications;
  protected readonly $loading = computed(() => this._profileStore.$notificationsState().kind === 'loading');
  protected readonly $failed = computed(() => this._profileStore.$notificationsState().kind === 'error');
  /** Nombre accesible de la campana: incluye cuántas hay sin leer. */
  protected readonly $label = computed(() => (this.$unread() > 0 ? `Notificaciones: ${this.$unread()} sin leer` : 'Notificaciones'));

  private _lastUnread: number | null = null;

  constructor() {
    // Otra persona inició sesión en la misma pestaña: la bandeja es de la cuenta, no del navegador, y el canal en
    // vivo también (el stream del servidor es de UNA sesión): se reabre y se vuelve a pedir la lista.
    effect(() => {
      // Leer el uuid hace que el efecto dependa de QUIÉN tiene la sesión.
      if (!this._sessionStore.$user()?.uuid) return;
      this._lastUnread = null;
      this._profileStore.reloadNotifications();
      this._stream.reconnect();
    });

    // Tiempo real (SSE): cada aviso nuevo y cada reconexión refrescan la bandeja al instante.
    this._stream.events$.pipe(takeUntilDestroyed()).subscribe(() => this._profileStore.reloadNotifications());
    this._stream.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this._profileStore.reloadNotifications());
    inject(DestroyRef).onDestroy(() => this._stream.disconnect());

    // Aviso emergente cuando llegan nuevas (no en la primera carga de cada cuenta).
    effect(() => {
      const unread = this.$unread();
      const state = this._profileStore.$notificationsState();
      if (state.kind !== 'success') return;
      if (this._lastUnread !== null && unread > this._lastUnread) {
        this._messageService.add({ severity: 'info', summary: 'Nueva notificación', detail: this.$pending()[0]?.message ?? '', life: 5000 });
      }
      this._lastUnread = unread;
    });

    // Respaldo: con el canal en vivo no hace falta consultar; si se cae, se consulta cada minuto (pestaña visible).
    const timer = setInterval(() => {
      if (!document.hidden && this._stream.$state() !== 'live') this._profileStore.reloadNotifications();
    }, INBOX_POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** Abre una notificación: la marca leída y va a su pantalla. */
  protected async open(item: TNotification, panel: Popover): Promise<void> {
    panel.hide();
    try {
      await this._profileStore.markNotificationRead(item.uuid);
    } catch {
      return; // `errorInterceptor` ya avisó
    }
    // El solicitante abre su ticket en «Mis tickets»; el equipo lo ve en el tablero.
    const requester = REQUESTER_TICKET_TYPES.has(item.type) && !this._sessionStore.$isTeam();
    if (requester && item.resourceUuid) {
      void this._router.navigate(['/my-tickets'], { queryParams: { ticket: item.resourceUuid } });
      return;
    }
    const target = REQUESTER_TICKET_TYPES.has(item.type) ? { path: '/tickets' } : NOTIFICATION_ROUTES[item.type];
    void this._router.navigate([target.path], { queryParams: 'query' in target ? target.query : undefined });
  }

  /** Marca leída SIN navegar (el botón del ojo). */
  protected async markRead(item: TNotification, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this._profileStore.markNotificationRead(item.uuid);
    } catch {
      // `errorInterceptor` ya avisó
    }
  }

  protected async markAllRead(): Promise<void> {
    try {
      await Promise.all(this.$pending().map((n) => this._profileStore.markNotificationRead(n.uuid)));
    } catch {
      // `errorInterceptor` ya avisó
    }
  }

  protected seeAll(panel: Popover): void {
    panel.hide();
    void this._router.navigate(['/profile'], { queryParams: { tab: 'notifications' } });
  }
}
