import { environment } from '../../../environments/environment';
import { AppErrorHandler } from './app-error-handler';

describe('AppErrorHandler', () => {
  const production = environment.production;
  afterEach(() => {
    environment.production = production;
    vi.restoreAllMocks();
  });

  it('en desarrollo imprime el error en la consola', () => {
    environment.production = false;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new AppErrorHandler().handleError(new TypeError('x'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('en producción no muestra nada en la consola', () => {
    environment.production = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new AppErrorHandler().handleError(new TypeError("can't access property \"data\", e.data is undefined"));
    expect(spy).not.toHaveBeenCalled();
  });

  it('una transición de vista saltada (AbortError) no se informa nunca, ni en desarrollo', () => {
    environment.production = false;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new AppErrorHandler().handleError(new DOMException('Transition was skipped. skipTransition() called', 'AbortError'));
    expect(spy).not.toHaveBeenCalled();
    new AppErrorHandler().handleError(new DOMException('otra cosa', 'AbortError')); // otros AbortError sí
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
