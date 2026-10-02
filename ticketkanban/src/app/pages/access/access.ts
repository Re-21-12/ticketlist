import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CanPipe } from '../../core/casl/can.pipe';
import { SessionStore } from '../../core/session/session.store';
import { Illustration } from '../../shared/ui/illustration/illustration';

/**
 * Destino de `canGuard` cuando la ruta no está permitida. Distingue «sin sesión» (401: la sesión
 * expiró o se cerró) de «sin permiso» (403: hay sesión pero el rol no alcanza).
 */
@Component({
  selector: 'app-access',
  imports: [Illustration, RouterLink, ButtonModule, CanPipe],
  templateUrl: './access.html',
  styleUrl: './access.css',
})
export class Access {
  protected readonly _sessionStore = inject(SessionStore);
}
