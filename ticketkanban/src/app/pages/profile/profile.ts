import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectModule } from '@openng/optimus-ui/select';
import { TabsModule } from '@openng/optimus-ui/tabs';
import { ROLE_LABELS } from '../../core/casl/role-labels.constants';
import { SessionStore } from '../../core/session/session.store';
import { UserAvatar } from '../../core/ui/user-avatar/user-avatar';
import { mediaQuerySignal } from '../../core/utils/media-query.util';
import { AppearanceTab } from './appearance/appearance-tab';
import { AvatarTab } from './avatar/avatar-tab';
import { NotificationsTab } from './notifications/notifications-tab';
import { PersonalInfoTab } from './personal-info/personal-info-tab';
import { DEFAULT_PROFILE_TAB, PROFILE_TABS } from './profile.constants';
import { ProfileStore } from './profile.store';
import type { TProfileTab } from './profile.types';
import { SecurityTab } from './security/security-tab';
import { SessionsTab } from './sessions/sessions-tab';

/**
 * «Mi perfil» (port de `Profile` de wallet-api): cabecera con avatar, nombre y rol, y pestañas de
 * información, seguridad, sesiones, notificaciones, avatar y apariencia.
 *
 *  - La pestaña activa vive en la URL (`/profile?tab=sessions`): se puede enlazar y sobrevive a recargar.
 *  - Solo la primera pestaña se carga de entrada; las demás con `@defer (on viewport; prefetch on idle)`.
 *  - En móvil las pestañas horizontales no caben sin scroll: se reemplazan por un `<p-select>`.
 */
@Component({
  selector: 'app-profile',
  imports: [
    FormsModule,
    TabsModule,
    SelectModule,
    UserAvatar,
    PersonalInfoTab,
    SecurityTab,
    SessionsTab,
    NotificationsTab,
    AvatarTab,
    AppearanceTab,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  protected readonly _sessionStore = inject(SessionStore);
  protected readonly _profileStore = inject(ProfileStore);
  private readonly _router = inject(Router);

  /** `?tab=` de la URL (lo enlaza `withComponentInputBinding`). */
  readonly $tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly tabs = PROFILE_TABS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly $isMobile = mediaQuerySignal('(max-width: 767px)');

  protected readonly $activeTab = computed<TProfileTab>(() => {
    const requested = this.$tabParam();
    return PROFILE_TABS.find((tab) => tab.key === requested)?.key ?? DEFAULT_PROFILE_TAB;
  });

  protected switchTab(value: string | number | undefined): void {
    void this._router.navigate([], {
      queryParams: { tab: value === DEFAULT_PROFILE_TAB ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
