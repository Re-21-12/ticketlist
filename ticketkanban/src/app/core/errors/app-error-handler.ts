import { ErrorHandler } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Manejador global de errores no capturados (los de las plantillas, los `computed` y, por `provideBrowserGlobalErrorListeners`,
 * también `window.onerror` y las promesas rechazadas). En desarrollo se imprime en consola como siempre; en PRODUCCIÓN no se
 * muestra nada interno (nombres de clases, rutas del bundle, trazas): la persona no puede hacer nada con eso y le da a quien
 * mire la consola un mapa de cómo está hecha la aplicación. Los errores de la API sí llegan a la persona, en lenguaje llano,
 * por `errorInterceptor`.
 *
 * Aquí es donde se conectaría un servicio de registro de errores (Sentry, etc.) si el proyecto lo tuviera.
 */
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (environment.production || isSkippedViewTransition(error)) return;
    console.error(error);
  }
}

/**
 * `AbortError: Transition was skipped`: el router de Angular encadena un `.finally()` en la promesa `finished` de la View
 * Transition y, cuando la transición se salta (reducir movimiento, otra navegación antes de que acabe, pestaña en segundo
 * plano), esa promesa derivada se rechaza sin dueño. Es un resultado normal de saltarla, no un fallo: no se informa en ningún entorno.
 */
function isSkippedViewTransition(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError' && /transition was skipped/i.test(error.message);
}
