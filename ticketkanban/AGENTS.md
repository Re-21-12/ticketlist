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
- Tipos (`FieldType`): TEXT, TEXT_NUMBER, TEXTAREA, EMAIL, URL, PASSWORD, PHONE, NUMBER, INTEGER, DECIMAL, CURRENCY, SLIDER, DATE, TIME, DATETIME, DATE_RANGE, SELECT (>10 opciones = autocomplete), MULTISELECT, AUTOCOMPLETE, CHECKBOX, TOGGLE, TOGGLE_BUTTON, RADIO, RADIO_BUTTON, COLOR, FILE, IMAGE_UPLOAD. Nuevo tipo → agregarlo también a la galería de `/style-guide` (`field-gallery.config.ts`; un test falla si falta).
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
- Entre rutas: `withViewTransitions` (solo `.app-content` tiene `view-transition-name`).
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
