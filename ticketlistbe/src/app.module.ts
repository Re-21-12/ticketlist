import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { BoardHttpModule } from './bff/board/board-http.module.js';
import { ShellHttpModule } from './bff/shell/shell-http.module.js';
import { AppConfigModule } from './config/config.module.js';
import { MethodNotAllowedMiddleware } from './common/http/method-not-allowed.middleware.js';
import { HealthModule } from './core/health/health.module.js';
import { KvModule } from './core/kv/kv.module.js';
import { RequestObservabilityMiddleware } from './core/observability/request-observability.middleware.js';
import { RateLimitModule } from './core/rate-limit/rate-limit.module.js';
import { CustomExceptionFilter } from './common/filters/exception-filter.filter.js';
import { ProblemsModule } from './common/problems/problems.module.js';
import { HttpCacheInterceptor } from './core/interceptors/http-cache.interceptor.js';
import { ZodValidationPipe } from './core/pipes/zod-validation.pipe.js';
import { RolePermissionsHttpModule } from './modules/access-control/role-permissions/role-permissions-http.module.js';
import { RolePermissionsModule } from './modules/access-control/role-permissions/role-permissions.module.js';
import { AuthHttpModule } from './modules/auth/auth-http.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SessionContextMiddleware } from './modules/auth/session/session-context.middleware.js';
import { NotificationsHttpModule } from './modules/notifications/notifications-http.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { RelationshipsHttpModule } from './modules/relationships/relationships-http.module.js';
import { RelationshipsModule } from './modules/relationships/relationships.module.js';
import { TicketsHttpModule } from './modules/tickets/tickets-http.module.js';
import { UsersHttpModule } from './modules/users/users-http.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Raíz. Capas (de afuera hacia adentro):
 *   bff/        endpoints por PANTALLA (orquestan dominio, forma de vista)
 *   modules/    dominio: *-http.module (controller) → *.module (service + repository)
 *   core/       bases genéricas (BaseController/Service/Repository), Zod, caché, contexto
 *   common/     catálogo de códigos, filtro RFC 9457, catálogo de problemas
 */
@Module({
  imports: [
    // Plataforma. RateLimitModule va ANTES de AuthModule: el límite por IP es el primer guard.
    AppConfigModule,
    KvModule,
    RateLimitModule,
    HealthModule,
    // Dominio (globales: los usan guards, ReBAC y notificaciones)
    UsersModule,
    RolePermissionsModule,
    RelationshipsModule,
    NotificationsModule,
    AuthModule,
    // Transporte
    AuthHttpModule,
    UsersHttpModule,
    TicketsHttpModule,
    RolePermissionsHttpModule,
    RelationshipsHttpModule,
    NotificationsHttpModule,
    ShellHttpModule,
    BoardHttpModule,
    ProblemsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: CustomExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Orden: X-Request-Id + log → 405 con `Allow` → usuario de la sesión + If-Match (RequestContext).
    consumer
      .apply(RequestObservabilityMiddleware, MethodNotAllowedMiddleware, SessionContextMiddleware)
      .forRoutes('*path');
  }
}
