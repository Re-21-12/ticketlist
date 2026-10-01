import { Component, computed, input } from '@angular/core';

/**
 * Avatar de una persona: ícono sobre un color elegido, o sus iniciales si no eligió ninguno. Es
 * decorativo (`aria-hidden`): el nombre ya está en el texto que lo acompaña. Los colores de
 * `AVATAR_COLORS` garantizan contraste ≥ 4.5:1 con el texto blanco.
 */
@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.html',
  styleUrl: './user-avatar.css',
  host: {
    '[style.--avatar-size.rem]': '$size()',
    '[style.--avatar-bg]': '$color()',
    'aria-hidden': 'true',
  },
})
export class UserAvatar {
  /** Clase de ícono (`pi-star`); vacío = iniciales. */
  readonly $icon = input<string | null | undefined>(null);
  readonly $color = input<string | null | undefined>(null);
  /** Nombre completo, para sacar las iniciales. */
  readonly $name = input('');
  /** Lado en `rem`. */
  readonly $size = input(2.25);

  protected readonly $initials = computed(() => {
    const words = this.$name().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return `${words[0][0]}${words.length > 1 ? words[words.length - 1][0] : ''}`.toUpperCase();
  });
}
