You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Every component has its own `.ts`, `.html` and `.css` (templateUrl + styleUrl) — NO inline templates or styles, even for small components (project rule, overrides the Angular CLI default).
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Convenciones del proyecto (heredadas de wallet-api)

### Estructura de carpetas

- `core/` — infraestructura de toda la app sin UI de pantalla: `casl/`, `session/`, `interceptors/`, `interfaces/` (BaseApiAbstract & co.), `mock-bff/`.
- `shared/` — UI/lógica reutilizable SIN ruta propia, usada por 2+ páginas (`dynamic-form/`, `form-dialog/`).
- `layouts/` — shells de página (`layout/`, `form-split/`).
- `pages/` — una carpeta por página funcional, 1:1 con las rutas. (En wallet-api se llama `features/`.)

### Archivos por página (`pages/<pagina>/`)

| Sufijo | Contiene |
| --- | --- |
| `<pagina>.ts/.html` | Componente de la página (solo UI; delega en el store). |
| `<pagina>.routes.ts` | Rutas lazy + guards (`canGuard`). |
| `<pagina>.store.ts` | Estado de pantalla: signals privados `$_x` + lecturas públicas + métodos de acción. |
| `<pagina>.service.ts` | Solo HTTP (extiende `BaseApiAbstract`) + validación Zod de la respuesta. |
| `<recurso>.schema.ts` | Schemas Zod (contrato espejo del backend). |
| `<recurso>.types.ts` | `type` (incluidos los `z.output<…>`). |
| `<recurso>.interface.ts` | `interface`. |
| `<recurso>.constants.ts` | Tablas de lookup reutilizables (labels, severidades). |
| `<recurso>-form.config.ts` | `defineForm({ schema, fields, sections })` para `app-dynamic-form`. |

Un `interface`/`type`/`const` reutilizable nunca va inline en un componente o servicio.

### Nomenclatura (la aplica `npm run lint`, en error)

- Signals (`signal`, `computed`, `input`, `output`, `model`, `viewChild(ren)`, `contentChild(ren)`, `linkedSignal`, `toSignal`, `.asReadonly()`) → `$algo`.
- Signals `private` → `$_algo`. Mismo orden que wallet-api (`$_itemUrl`).
- Campos inicializados con `inject()` → `_algo` (también si son `protected` para el template).
- Campos `private` que no son signal ni inject → `_algo` (constantes UPPER_CASE exentas).
- `interface` → prefijo `I` · `type` → prefijo `T` · `enum` → prefijo `E`. Excepción: `AppAbility` (companion object de CASL).
- Inputs con `$` SIEMPRE con corchetes: `[$heading]="'Texto'"`. El atributo estático `$heading="Texto"` revienta en runtime (`setAttribute('$heading')`).
- Signals escribibles solo dentro de su store/servicio; hacia afuera `.asReadonly()` o `computed()`.

### Permisos (CASL, `@casl/angular` 10.0.3)

- Una sola instancia de `Ability` (`{ provide: AppAbility, useValue: createMongoAbility() }`), mutada con `ability.update(rules)` en `SessionStore`, nunca en un `effect()`.
- Templates: pipe `can` de `core/casl/can.pipe.ts`: `('create' | can: 'Ticket')()`. Con condiciones: `('update' | can: 'Ticket' : ticket)()`. Es puro y devuelve un `Signal<boolean>`.
- NO usar el pipe `able` de @casl/angular: es impuro y está deprecado en su README.
- TS: `computed(() => this._abilityService.can(...))` con `AbilityServiceSignal`.
- Rutas: `canGuard(action, subject)` + `runGuardsAndResolvers: 'always'` (sin eso, al cambiar de rol o cerrar sesión el guard no se re-evalúa). Rechazo → `/access` (ruta SIN guard: redirigir a otra ruta protegida puede entrar en bucle). Menú: `subject` + `requiredAction` en el ítem, filtrado con `resolveVisibleMenuItems`.
- UX: lo que no se puede hacer no se muestra; si hay alternativa de solo lectura, se ofrece («Ver»).

### Estilos, tema y accesibilidad

- Cada componente: `.ts` + `.html` + `.css`. Sin `template:`/`styles:` inline.
- Colores SOLO con los tokens `--app-*` de `styles.css` (mapeados a optimus-ui). Nunca clases de color de Tailwind (`text-slate-*`, `bg-white`): rompen el modo oscuro y el color del usuario. Tailwind queda para layout (flex/grid/gap).
- `ThemeService` (claro/oscuro, clase `.app-dark`) y `PrimaryColorService` (color de marca → paso de la paleta que cumple WCAG AA) persisten en localStorage. `index.html` aplica el tema antes del bootstrap. Pantalla: `/appearance`.
- WCAG AA: link «Saltar al contenido», foco visible global, `prefers-reduced-motion`, objetivos táctiles ≥ 2.75rem, estado activo no solo por color, `label` asociado a cada control.

### FSM (`shared/fsm/create-state-machine.ts`)

Operaciones multi-paso (guardar, subir, analizar) = una máquina de estados, no varios `signal(boolean)`. Los booleanos del template se DERIVAN (`computed(() => machine.is('saving'))`). Estados camelCase, eventos SNAKE_CASE. Ejemplo real: el guardado de `TicketsStore` (`idle → saving → saved | failed`; un doble submit no es una transición válida).

### Formulario dinámico (`shared/dynamic-form/`)

Port de `DynamicFormSignal` de wallet-api sobre Signal Forms + **Zod** (el schema es la única fuente de validación; la config solo describe cómo se ve cada campo).

- Se define con `defineForm({ name, schema, fields, sections })`. Falla AL CARGAR el módulo si un campo está en dos secciones (se pintaría dos veces), en ninguna (desaparece) o si una clave no existe.
- **Todo lo que dice el schema se deriva**, nunca se duplica en la config (`utils/field-constraints.util.ts`): el `*` (obligatorio), el contador «n / máx» del pie, el tope de escritura (`maxlength`) y los límites de los números. `[attr.maxlength]` NO se puede enlazar a mano en un nodo `[formField]` (NG8022): lo pone `[formField]` desde la regla nativa `maxLength()` que `schema-builder.ts` agrega con el mismo mensaje de Zod.
- Cada campo = `app-field-label` (nombre + «*» con tooltip «Este campo es obligatorio» / «(Opcional)») → control (con ícono de contexto, `resolveFieldIcon`) → `app-field-footer` (UNA cosa a la vez: razones de deshabilitado → error → hint; el contador acompaña siempre). Errores, hints y contador son `p-message variant="simple"`.
- Tipos (`FieldType`): TEXT, TEXT_NUMBER, TEXTAREA, EMAIL, URL, PASSWORD, PHONE, NUMBER, INTEGER, DECIMAL, CURRENCY, SLIDER, RATING, DATE, TIME, DATETIME, DATE_RANGE, SELECT (>5 opciones = autocomplete), MULTISELECT, AUTOCOMPLETE, CHECKBOX, TOGGLE, TOGGLE_BUTTON, RADIO, RADIO_BUTTON, COLOR, FILE, IMAGE_UPLOAD. Nuevo tipo → agregarlo también a la galería de `/style-guide` (`field-gallery.config.ts`; un test falla si falta).
- Modelo inicial (`model-builder.ts`): un `<input>` nativo de texto (TEXT, EMAIL, URL, PASSWORD, CURRENCY…) arranca en `''`, NUNCA `null` (si no, Signal Forms lo trata como numérico: NG01921 / NativeInputParseError).
- Filtros de teclado/pegado: numéricos solos por tipo; `inputFilter: 'letters' | 'email'…` es opt-in (wallet-api filtraba todo `TEXT` a letras: no sirve para títulos).
- Un `id` nunca se enlaza con `[id]="x || null"`: Angular escribe el texto `"null"`. Usar `[attr.id]`.
- Un componente PrimeNG que dibuja su borde en un hijo (`-box`) necesita su propia regla en `styles.css` para no marcarse inválido antes de tocarlo.

### Mi perfil (`pages/profile/`)

Port de `Profile` de wallet-api: cabecera (portada + avatar + nombre + rol) y pestañas **Información, Seguridad, Sesiones, Notificaciones, Avatar, Apariencia** (`PROFILE_TABS` es la fuente única; en móvil se reemplazan por un `<p-select>`).
- La pestaña activa vive en la URL (`/profile?tab=sessions`, vía `withComponentInputBinding`). Solo la primera se carga de entrada; el resto con `@defer (on viewport; prefetch on idle)`.
- Cada pestaña es un componente propio (`*-tab.ts/html/css`); los `FormSplit` dentro del perfil usan `[$headingLevel]="'h2'"` (el `h1` es el nombre de la persona).
- Solo requiere SESIÓN (`authenticatedGuard` + `runGuardsAndResolvers: 'always'`), no una habilidad CASL. Todo opera sobre el usuario de la sesión: ningún endpoint recibe un `userUuid`.
- Sesiones: el `id` es un hash opaco, nunca el `sid` de la cookie. Cambiar la contraseña cierra las demás sesiones (lo hace el backend).
- Avatar: listas CERRADAS de íconos y colores (`core/ui/user-avatar/avatar.const.ts`, espejo del backend); los colores tienen contraste ≥ 4.5:1 con texto blanco. Los grupos son `radiogroup` de radios nativos.
- El menú solo muestra destinos que el router conoce (`routable.util.ts`): un ítem del BFF sin pantalla en el front no se pinta (antes el comodín `**` lo devolvía al inicio en silencio).
- El estado del mock del BFF es del módulo: los tests llaman `resetMockBff()` en `beforeEach`.

### Acceso (`pages/auth/`, `layouts/auth-layout/`)

- Pantallas: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password?token=`, `/verify-email?token=`, dentro de `AuthLayout` (tarjeta centrada, sin menú). `sign-in` y `sign-up` solo para quien NO tiene sesión (`guestOnlyGuard`).
- NO hay auto-login: sin sesión, los guards (`authenticatedGuard`, `canGuard`) mandan a `/sign-in?returnUrl=…`. El destino se valida SIEMPRE con `safeReturnUrl` (solo rutas internas; rechaza `//host`, `\`, esquemas, saltos de línea y pantallas de acceso).
- **Anti-bucle:** todo destino al que redirige un guard debe existir en el router. Con `/sign-in` inexistente, `**` + guard = bucle infinito (pantalla negra, CPU al 100 %). `app.routes.spec.ts` navega sin sesión a cada ruta y lo verifica. La redirección `'' → tickets` va PRIMERA en `app.routes.ts` (el layout de acceso tiene `path: ''` y «coincidiría» con la raíz).
- Registro siempre crea VIEWER (el rol nunca viene del cliente). Respuestas anti-enumeración en forgot/resend.
- «Asignado a» es un `SELECT` cuyas opciones llegan en runtime (`optionsByField` → `$optionsByField`); con más de 5 opciones se pinta como autocomplete.

### Administración (`pages/users`, `role-matrix`, `role-permissions`, `menu-items`, `catalogs`, `audit-logs`, `sharing`)

- **`app-crud-page`** (`shared/crud-page/`) es la pantalla CRUD reutilizable: encabezado + `app-dynamic-table` + modal dinámico + confirmación + avisos. Una página nueva = su servicio (`BaseApiAbstract`), su `*-form.config.ts` (`defineForm` + `ITableConfig` + `ICrudConfig`) y `<app-crud-page [$service] [$config]>`. `<ng-content>` admite filtros propios (auditoría). `toFormValue` convierte la fila del servidor al formulario (`null` → `''` en inputs de texto).
- `ITableConfig` suma `creatable: false` (sin «Nuevo»), `rowLabelField` (nombre accesible de la fila) y `rowActionAllowed(action, row)` (veto por fila además de CASL; catálogos lo usa para no eliminar lo de sistema). Debe llegar a la tabla Y a la card móvil.
- Un select opcional se guarda como `null`: el schema acepta `''` y lo transforma (`optional()` en `menu-item.schema.ts`).
- **Matriz de roles**: estado de celda `on | inherited | off` (`role-matrix.util.ts`); lo que viene de `manage`/`all` no se apaga ahí. Conceder = crear regla sin condición; quitar = borrar las reglas de la celda.
- **Usuarios**: sin alta ni borrado; rol y estado (`disabled`) en un formulario que envía dos PATCH (el backend es idempotente si no cambia). Nadie cambia su propio rol (`SUSR-E003`) y siempre queda un admin activo (`SUSR-E004`).
- **Catálogos → formularios**: `CatalogOptionsService` (`shared/catalog-options/`) pide `/api/catalogs/:key/options` UNA vez por catálogo y cae a las etiquetas del contrato mientras carga o si falla; ignora códigos que el schema Zod no conoce. `TicketsStore.formOptions()` lo combina con el personal asignable para los selects de los diálogos y del alta rápida, y alimenta las columnas del listado y las etiquetas del tablero. Editar un catálogo llama a `reloadAll()`.
- **Relaciones (admin)** (`/relation-permissions`): `ManageRelationship` (ADMIN) ve las de todas las personas y REVOCA (`deleteVerb`/`deleteLabel` cambian el texto «Eliminar» por «Revocar»); lo revocado queda como historial sin botón.
- **Auditoría**: solo lectura; el backend guarda NOMBRES de campos, nunca valores.
- **Menú**: el shell lo arma el backend desde `menu_items`; sigue filtrado por CASL y por `routableRoots`.
- **Mock BFF de administración** (`core/mock-bff/mock-bff.admin.ts`): mismos contratos y códigos que el backend; el shell se reconstruye en cada carga desde permisos + menú + relaciones (un cambio rige al volver a iniciar sesión). Lo cubren `mock-bff.admin.spec.ts` y `pages/admin-pages.spec.ts`. Los seeds del mock se clonan (`structuredClone`): mutar las constantes del módulo contamina los tests.
- Con el panel del navegador oculto las View Transitions fallan («Transition was aborted») y la navegación se queda: recargar la página; no es un bug de la app.

### Ticket: ciclo de vida (contrato del backend)

- Estados: `new → assigned → in_progress ⇄ pending_customer → resolved → closed` (+ `escalated`, `reopened`). El estado NO es un campo del formulario ni del `PATCH`: solo cambia por `TicketsService.transition` (`POST /api/tickets/:uuid/transitions`). Resolver abre el modal «Resolver» (la solución es obligatoria).
- Cada ticket trae `nextStatuses` (lo que ESA persona puede hacer ahora, lo decide el backend): el tablero solo deja arrastrar a esas columnas (`cdkDropListEnterPredicate`) y «Mover a…» solo las lista. También trae `assigneeName` (quién atiende), `sla` y `requesterName`.
- Roles: ADMIN (único que elimina), SUPERVISOR (asigna, escala y pide información; no resuelve), AGENT (atiende y resuelve lo asignado), AUDITOR (solo lectura) y VIEWER (= **Cliente**: crea y edita lo suyo; no elimina, no asigna ni comparte). Notificaciones nuevas: `TICKET_STATUS_CHANGED`, `TICKET_COMMENTED`, `TICKET_REOPENED`, `TICKET_SURVEY`.
- Si el backend agrega un subject, rol o estado nuevo, hay que espejarlo AQUÍ (`casl.types.ts`, `ability.enum.ts`, `ticket.schema.ts`, `profile.schema.ts`) o `parseShell`/`TicketSchema` fallan con un `ZodError` al iniciar sesión.
- El mock (`mock-bff.handler.ts` + `mock-ticket-lifecycle.ts`) refleja el mismo ciclo, los mismos actores por rol y las mismas reglas de titular (`mock-bff.tickets.spec.ts`). Pendiente en el front: «Mis tickets» con historial y comentarios y adjuntar evidencia al crear (el tablero del supervisor y la encuesta CSAT ya existen).
- **Tablero**: TRES columnas (grupos `new` / `in_attention` / `closed`; `TICKET_STATUS_GROUPS`). Cada tarjeta muestra su estado EXACTO como insignia (Reabierto, Escalado, Pendiente del cliente…), urgencia, complejidad y tipo, y — si está asignada o en atención — un reloj de tiempo transcurrido (`app-elapsed-clock` sobre `ClockService`, UN temporizador de 1 s compartido, `role="timer"`). Soltar en una columna lleva al estado principal del grupo (`DROP_TARGETS`: atención → En atención, cerrado → Resuelto, nuevo → Reabierto); las variaciones se eligen con «Mover a…» (`p-select` de optimus-ui, solo `nextStatuses`). «Iniciar atención» pasa Asignado → En atención.
- **Formulario**: `TicketsStore.$form` elige `TICKET_FORM` (equipo) o `TICKET_CUSTOMER_FORM` (cliente: complejidad, estimación, fecha límite y responsable se ven DESHABILITADOS con su razón; el PATCH es completo y el backend los conserva). Urgencia = `FieldType.RATING` (estrellas; la escala son las opciones del catálogo, el valor guardado es el código de la opción, y el texto de la opción acompaña a las estrellas).

- **Recuperar contraseña** (`/forgot-password`): tres formas con radios nativos (enlace por correo · código del autenticador TOTP · contraseña actual). Con TOTP o contraseña actual la persona elige su contraseña nueva; cualquier fallo es la misma respuesta (`SAUT-E010`, se muestra en línea). El autenticador se configura en Mi perfil → Seguridad (`TotpCard`: secreto → confirmar con código; baja con la contraseña actual). En el mock el código válido es `MOCK_TOTP_CODE` (`123456`).
- **Descripción del ticket**: `FieldType.EDITOR` (`p-editor` de optimus-ui sobre `quill`, valor HTML; el backend lo sanea). Va por `ngModel`, no `[formField]`; el contador cuenta el HTML (tope 2000).

- **Bundle inicial** (~625 kB crudo, ~152 kB transferido): es el piso del framework (Angular core 211 kB + router 87 kB + tema/toast de optimus-ui); lo pesado (editor/quill, formularios, tablas) va en chunks diferidos. El presupuesto de aviso es 650 kB (`angular.json`): si lo supera, revisar `dist/ticketkanban/browser-stats.json` (`ng build --stats-json`) antes de subirlo.
- **QR del autenticador**: `qrcode` (carga bajo demanda en `TotpCard`), generado en el navegador: el secreto nunca sale a un servicio externo.

- **Urgencia** es un `SELECT` (ícono y color del catálogo en cada opción), no estrellas. `FieldType.RATING` queda para la **encuesta de satisfacción** (CSAT 1–5, `TICKET_SURVEY_FORM`): al cerrarse un ticket el solicitante recibe una notificación `TICKET_SURVEY` con «Calificar» (Mi perfil → Notificaciones; una respuesta por ticket, vigente 7 días). Una calificación baja avisa a supervisores (`TICKET_SURVEY_ALERT`).
- **Bloqueo de cuenta (CU07 A3)**: 5 intentos fallidos seguidos bloquean la cuenta; el acceso muestra el aviso con el contacto de los administradores (`SAUT-E014`, `context.contacts`). Solo un administrador la desbloquea: Usuarios → toggle «Cuenta bloqueada» (envía `locked: false`); le llega una notificación `ACCOUNT_LOCKED` con atajo a Usuarios. Tabla: `dangerWhenTrue` pinta «Sí» en rojo (bloqueada, deshabilitada).

- **Ilustraciones** (como wallet-api): `app-illustration` (`shared/ui/illustration/`), SVG inline decorativo (`aria-hidden`) que hereda los tokens del tema; una escena por pantalla (`TIllustration`). Van en el encabezado (`.page-header-art` + `.page-art`, `[$illustration]` de `app-crud-page`), en `formSplitArt`, en las pantallas de acceso (`.auth-art`) y en los estados vacíos (tabla, columna del tablero, notificaciones). Escena nueva → agregarla a `ILLUSTRATIONS`, `illustration.html` y el test recorre todas.
- **SLA en el tablero**: panel plegable `app-sla-ranges` (rangos por urgencia: primera respuesta < 2 h; resolución crítica < 2 h, alta/media < 8 h, baja < 24 h, mejoras 48 h; metas SLA > 95 %, FCR > 75–80 %, CSAT ≥ 4.5; `SLA_RANGES` en `ticket.constants.ts`, espejo de `sla-policy.ts`) y, en cada tarjeta abierta, la insignia del estado del plazo + «Resolver antes de …».
- **Botones**: todo `pButton` lleva ícono (`pButtonIcon`) + `pButtonLabel`; el submit del formulario dinámico usa `pi-check`.

- **Departamento de origen**: campo `department` del ticket (select con el catálogo EDITABLE `ticket-department`; `CatalogOptionsService.options(..., open = true)` muestra también los departamentos que la organización agregue). «TI (interno)» = nace dentro del equipo de TI. Se ve como insignia «Origen: …» en la tarjeta y como columna.
- **Filtros** (`app-ticket-filters`, criterios en `TicketsStore.$filters`): búsqueda (sin acentos), departamento, urgencia, tipo, categoría, estado, «solo mis tickets» y «fuera de SLA». El tablero filtra en el cliente (`$visibleBoard`, «Mostrando n de m»); el listado envía al servidor los que el backend sabe filtrar (`serverFilters`).

### Insignias, íconos y colores

- `app-badge` (`shared/ui/badge/`): texto + ícono PrimeIcons + color (severidad del tema, `BADGE_SEVERITIES`). El TEXTO va siempre (WCAG 1.4.1); el ícono es `aria-hidden`.
- Cada valor de catálogo trae `icon` + `severity` (`/api/catalogs/:key/options` → `IFieldOption.icon/severity`). `TICKET_*_META` (`ticket.constants.ts`) es el respaldo cuando el catálogo no responde; `CatalogOptionsService` mezcla ambos.
- Tablas: columna `badge: true` (opciones con ícono/color), `badgeFrom: { icon, severity }` (insignia armada con campos de la misma fila: catálogos), `iconValue: true` (el valor es una clase `pi-…`: menú). Los booleanos se pintan como insignia «Sí»/«No» automáticamente. Roles, acciones y resultados de auditoría usan `withBadges(...)` + `ROLE_BADGES` / `AUDIT_*_BADGES`.
- Menú: `INavItem.icon` y `NAV_GROUP_ICONS` (por nombre de grupo). Las opciones de un `SELECT` con ícono lo muestran en el desplegable.
- Compartir: ya NO existe `canDelete` (eliminar es solo del administrador).

### Métricas (`pages/metrics/`) — tablero del supervisor y «Mis métricas» (CU05)

- Rutas `/metrics` (`canGuard('read','Metric')`: supervisor, auditor, admin) y `/my-metrics` (`MyMetric`: cada persona ve SOLO lo suyo, `GET /api/metrics/me`). El menú ya las trae del backend (`menu_items`).
- **El front no calcula nada**: las fórmulas, metas y semáforos viven en `ticketlistbe/src/modules/metrics/metrics-engine.ts` (`docs/standard/metrics.md`). Aquí solo se da formato (`metrics.format.ts`, `metrics.cards.ts`). Cada indicador llega como `{ value, sample, status }`; `value: null` = «Sin información» (A1), nunca un 0 % engañoso. Una persona sin tickets muestra ceros (A3) y un ticket abierto vencido sale «Fuera de SLA» (A2).
- Piezas: `MetricsPeriodStore` (período compartido por ambas pantallas; valida inicial ≤ final y ≤ 366 días), `MetricsService` (httpResources + Zod) → `MetricsStore` (`TAsyncState`), `app-metrics-period` (preajustes 7/30/90 + rango), `app-metric-summary` (tarjetas + conteos + antigüedad del backlog; sirve a equipo, colaborador y «mis métricas»), `app-metric-card` (valor + semáforo con TEXTO e ícono + meta + muestra), `app-metric-tickets` (tickets gestionados con su estado de SLA).
- La tabla de colaboradores muestra SIEMPRE el tamaño de la muestra («n = …»); es para coaching, no ranking. Tokens `--app-success` / `--app-warning` para el semáforo (claro/oscuro).
- Mock (`core/mock-bff/mock-metrics.ts`): mismas metas y reglas de semáforo, pero con lo que el mock sabe (sin historial de eventos: primera respuesta inferida del estado, reloj corrido). Lo cubre `mock-bff.metrics.spec.ts` (contrato con el MISMO schema, permisos por rol, A1–A3).

### Shell: menú plegable y buzón de notificaciones (`layouts/layout/`)

- **Menú lateral plegable** (escritorio): el botón de hamburguesa del topbar alterna entre el menú completo (15 rem) y un riel de solo íconos (4.5 rem, como el `collapsible: 'icon'` de wallet-api). El texto de cada ítem va en `.app-nav-label`, que al plegar se oculta VISUALMENTE pero sigue en el DOM (nombre accesible); cada enlace lleva `title`. La preferencia se guarda en `localStorage` (`ticketit_sidebar_collapsed`, con try/catch). En móvil el menú sigue siendo el drawer.
- **Buzón** (`notification-panel/`): campana con contador (`p-overlaybadge`) y `p-popover` con las últimas 5 PENDIENTES (marcar leída la saca de la bandeja; el historial completo está en Mi perfil → Notificaciones). Abrir una la marca leída y navega según su tipo (`NOTIFICATION_ROUTES`: tickets, `/sharing`, `/users`, o la pestaña de notificaciones para calificar). Usa `ProfileStore` (la misma fuente que la pestaña). El backend no tiene tiempo real: se consulta cada 60 s con la pestaña visible y un aviso emergente anuncia las nuevas; al cambiar de cuenta se recarga.

### Dynamic table (`shared/dynamic-table/`)

- Los overlays de la tabla (p. ej. filas por página) se adjuntan al `body` (`paginatorDropdownAppendTo="body"`): `.dynamic-table-shell` es un contenedor con scroll y un overlay dentro lo desfasa/recorta.
- Acciones de fila con ÍCONO + etiqueta + tooltip (`pi-eye` / `pi-pencil` / `pi-trash`, `outlined`); el nombre accesible lleva el código de la fila («Editar TCK-001»).
- Dev server: si tras agregar imports nuevos de optimus-ui aparecen avisos `NG0912` («Component ID generation collision») y la tabla pierde su padding (faltan `--p-datatable-*`), Vite reoptimizó dependencias a mitad de sesión y cargó copias duplicadas de los componentes: **reiniciar `ng serve`**. No es un bug del código.

- Columnas desde la MISMA config del formulario (`table: { show: true }` en el campo + `buildTableColumns`).
- Paginación y búsqueda de servidor (`BaseApiAbstract.setPage/setSearch`).
- En móvil cada fila es una card (`app-table-row-card`, por media query).
- Permisos CASL por fila (Editar/Eliminar con la instancia). La tabla solo emite eventos; la página abre el modal (`FormDialogService`) o confirma (`confirmDelete`).

### Environments y sesión

- Tipados con `IEnvironment`. `environment.ts` (dev, mock) se reemplaza por `environment.prod.ts` en `production` y por `environment.bff.ts` en `bff` (`npm run start:bff`: BFF real vía `proxy.conf.json`). Un environment de reemplazo NO puede importar `./environment` (se importaría a sí mismo): lo compartido va en otro archivo (`dev-sign-in.ts`).
- Sesión stateful de ticketlistbe: cookie `sid` HttpOnly (el front nunca guarda tokens) y CSRF `X-XSRF-TOKEN`, que `HttpClient` agrega solo. `SessionStore.loadSession()` nunca lanza (corre en el initializer).
- `devSignIn` (solo dev): usuarios sembrados para el selector «Rol de prueba». `null` en producción.
- Nunca secretos en environments: terminan en el bundle público.

### Movimiento (WCAG 2.3.3 / 2.2.2)

- Entrar/salir: `animate.enter="app-enter-fade|app-enter-rise"` / `animate.leave="app-leave-fade"` (clases en styles.css). NO `@angular/animations` (deprecado).
- Entre rutas: `withViewTransitions` con el barrido circular de wallet-api (`::view-transition-new(root)` + `in-circle-swoop`, variables `--circle-*` en `styles.css`, 1.2 s); con «reducir movimiento» no corre.
- Texto seleccionado: `::selection` usa `--app-primary` / `--app-primary-contrast` (sigue el tema y el color de marca).
- Coreografías (stagger): `MotionService` (anime.js, import lazy). Solo `opacity`/`transform`, ≤ 300 ms, nunca en bucle.
- Con «reducir movimiento» no se anima nada: CSS global, `skipTransitionIfReducedMotion` y `MotionService.$reducedMotion`.

### Guía de estilos (`/style-guide`)

Componentes reales + criterios WCAG por sección (`pages/style-guide/style-guide.constants.ts`), con tabla de contraste medida EN VIVO. Componente nuevo o regla nueva de accesibilidad → agregarlo ahí.

### Comandos (`.claude/commands/`)

- `/check` — lint + build + tests con resumen.
- `/new-page <nombre> [Subject]` — scaffold de una página con todas las convenciones.

### Errores y mensajes de validación

- Los mensajes de los schemas Zod salen de `core/validation/validation-errors.ts`, ESPEJO de `ticketlistbe/src/common/codes/validation-errors.ts`. Nunca un texto suelto en un schema. El test `validation-errors.mirror.spec.ts` del backend falla si divergen.
- Códigos de error del backend (`<Capa><Módulo>-E###`), cuerpo de error y mapeo campo → regla → mensaje: `ticketlistbe/docs/standard/error-catalog.md`. Cuerpo RFC 9457 Problem Details (`IProblemDetails` + `readProblem()` en `core/interfaces/problem-details.interface.ts`): `title`, `detail`, `code`, `errors[{ pointer, path, message, code }]`. El mock del BFF devuelve el mismo cuerpo, la misma sesión (sign-in/sign-out, 401) y los mismos códigos.
- Referencia de la API: Scalar UI en `http://localhost:3000/api/reference` (con `bun run start:dev` en ticketlistbe).
