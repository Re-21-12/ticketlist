import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { NOTIFICATION_ICONS } from '../profile.constants';
import { ProfileStore } from '../profile.store';

/** Pestaña «Notificaciones»: las tuyas, de más nueva a más vieja; se marcan como leídas una a una. */
@Component({
  selector: 'app-notifications-tab',
  imports: [DatePipe, ButtonModule],
  templateUrl: './notifications-tab.html',
  styleUrl: './notifications-tab.css',
})
export class NotificationsTab {
  protected readonly _profileStore = inject(ProfileStore);
  protected readonly icons = NOTIFICATION_ICONS;

  protected async markRead(uuid: string): Promise<void> {
    try {
      await this._profileStore.markNotificationRead(uuid);
    } catch {
      // `errorInterceptor` ya avisó.
    }
  }
}
