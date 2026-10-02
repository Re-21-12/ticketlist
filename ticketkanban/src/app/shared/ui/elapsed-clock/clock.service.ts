import { Service, signal } from '@angular/core';

/**
 * Reloj compartido: UN solo temporizador de 1 s para todos los relojes de la pantalla (una tarjeta por
 * ticket abriría decenas). Arranca con el primer lector y se detiene al irse el último, así no corre
 * en pantallas sin relojes.
 */
@Service()
export class ClockService {
  private readonly $_now = signal(Date.now());
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _subscribers = 0;

  /** Milisegundos desde epoch, actualizado cada segundo mientras haya relojes montados. */
  readonly $now = this.$_now.asReadonly();

  /** Registra un reloj montado; devuelve cómo darlo de baja. */
  subscribe(): () => void {
    this._subscribers += 1;
    this.$_now.set(Date.now());
    this._timer ??= setInterval(() => this.$_now.set(Date.now()), 1000);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this._subscribers -= 1;
      if (this._subscribers === 0 && this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    };
  }
}
