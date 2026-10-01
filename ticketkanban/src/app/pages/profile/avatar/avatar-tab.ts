import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SessionStore } from '../../../core/session/session.store';
import {
  AVATAR_COLOR_LABELS,
  AVATAR_COLORS,
  AVATAR_ICON_LABELS,
  AVATAR_ICONS,
  type TAvatarColor,
  type TAvatarIcon,
} from '../../../core/ui/user-avatar/avatar.const';
import { UserAvatar } from '../../../core/ui/user-avatar/user-avatar';
import { FormSplit } from '../../../layouts/form-split/form-split';
import { ProfileStore } from '../profile.store';

/**
 * Pestaña «Avatar»: ícono + color de las listas cerradas (el backend valida contra las mismas). Cada
 * grupo es un `radiogroup` de radios NATIVOS: flechas para moverse, Espacio para elegir, sin trabajo
 * extra de teclado. Lo elegido se ve al instante en la vista previa y se guarda con «Guardar».
 */
@Component({
  selector: 'app-avatar-tab',
  imports: [FormSplit, ButtonModule, UserAvatar],
  templateUrl: './avatar-tab.html',
  styleUrl: './avatar-tab.css',
})
export class AvatarTab {
  protected readonly _sessionStore = inject(SessionStore);
  private readonly _profileStore = inject(ProfileStore);
  private readonly _messageService = inject(MessageService);

  /** `''` = iniciales / color del tema. */
  protected readonly icons: readonly { value: TAvatarIcon | ''; label: string }[] = [
    { value: '', label: 'Iniciales' },
    ...AVATAR_ICONS.map((value) => ({ value, label: AVATAR_ICON_LABELS[value] })),
  ];
  protected readonly colors: readonly { value: TAvatarColor | ''; label: string }[] = [
    { value: '', label: 'Color del tema' },
    ...AVATAR_COLORS.map((value) => ({ value, label: AVATAR_COLOR_LABELS[value] })),
  ];

  /** Borrador: arranca con lo guardado y se reinicia si la sesión cambia el avatar por fuera. */
  protected readonly $draftIcon = linkedSignal<TAvatarIcon | ''>(
    () => (this._sessionStore.$user()?.avatarIcon as TAvatarIcon | null) ?? '',
  );
  protected readonly $draftColor = linkedSignal<TAvatarColor | ''>(
    () => (this._sessionStore.$user()?.avatarColor as TAvatarColor | null) ?? '',
  );
  protected readonly $saving = signal(false);

  protected readonly $dirty = computed(() => {
    const user = this._sessionStore.$user();
    return (
      this.$draftIcon() !== ((user?.avatarIcon as TAvatarIcon | null) ?? '') ||
      this.$draftColor() !== ((user?.avatarColor as TAvatarColor | null) ?? '')
    );
  });

  protected async save(): Promise<void> {
    this.$saving.set(true);
    try {
      await this._profileStore.updateAvatar({
        avatarIcon: this.$draftIcon() || null,
        avatarColor: this.$draftColor() || null,
      });
      this._messageService.add({ severity: 'success', summary: 'Avatar actualizado', life: 2500 });
    } catch {
      // `errorInterceptor` ya avisó; el borrador queda para reintentar.
    } finally {
      this.$saving.set(false);
    }
  }
}
