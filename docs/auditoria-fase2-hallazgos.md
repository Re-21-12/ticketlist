# Auditoría de hallazgos · Documento «Fase 2 – Sistema de Tickets (V1-1)» vs. el sistema Ticketit

Fecha de la auditoría: 2026-10-15 · Alcance: el documento del Grupo 1 (Fases 1 y 2, 101 páginas) contrastado con el código
de `ticketlistbe` (BFF) y `ticketkanban` (front) de este repositorio. Cada hallazgo indica qué dice el documento, qué hace
el sistema (con el archivo que lo demuestra), el efecto y la corrección recomendada.

**Severidad:** 🔴 Alta (seguridad o incumple un requisito) · 🟠 Media (brecha funcional o contradicción que afecta la
evaluación) · 🟡 Baja (redacción, coherencia, trazabilidad).
**Tipo de corrección:** `[Doc]` se corrige el documento · `[Sis]` se corrige el sistema · `[Ambos]`.

## 1. Resumen ejecutivo

| | Cantidad |
|---|---|
| Hallazgos 🔴 Altos | 2 |
| Hallazgos 🟠 Medios | 10 |
| Hallazgos 🟡 Bajos | 7 |
| Requisitos verificados como **cumplidos** | 11 (sección 4) |

Lo más urgente: **(1)** el anexo del documento publica en texto plano las contraseñas de cinco cuentas del ambiente real
(`tickets.glumi.lat`), y **(2)** el RNF-07 promete un bloqueo temporal de 15 minutos mientras el sistema bloquea la cuenta
hasta que un administrador la libere.

## 1.1 Estado de las correcciones (2026-10-16)

| Hallazgo | Estado | Qué se hizo |
|---|---|---|
| H-02 RNF-07 bloqueo 15 min | ✅ Corregido | Se desbloquea sola a los 15 min (`LOGIN_LOCK_MINUTES`, aviso con la hora en el acceso); el desbloqueo manual del administrador sigue disponible |
| H-03 mensaje de credenciales | ✅ Corregido | `SAUT-E004` y el mock dicen «Correo electrónico o contraseña incorrectos» (RF-07) |
| H-04 alta con evidencia | 🟡 Parcial | El alta rápida adjunta evidencia (se sube al crear y queda en el historial). Siguen pendientes «Cancelar» con confirmación y la pantalla de confirmación del alta |
| H-05 estados «Abierto» / «En progreso» | ✅ Corregido | Catálogo `ticket-status`, tablero y mock con los nombres del documento (migración para bases existentes) |
| H-07 nota de asignación | ✅ Corregido | Campo en el formulario y en `POST …/assign`; queda en el historial y en el aviso |
| H-08 motivo al reabrir | ✅ Corregido | Diálogo con la solución a la vista; motivo obligatorio (también en el backend) |
| H-09 resumen de cierre | ✅ Corregido | Tarjeta de resumen junto a la encuesta, en «Reabrir» y en el detalle del ticket cerrado |
| H-01 credenciales en el anexo | ⏳ Pendiente | Requiere rotar las contraseñas y retirar el anexo del documento |

## 2. Hallazgos

### 🔴 H-01 · Credenciales reales en texto plano dentro del documento · `[Ambos]`
- **Documento:** el anexo «Credenciales» lista correo y contraseña de las cuentas ADMIN, SUPERVISOR, AGENT, AUDITOR y VIEWER del
  sitio desplegado. El propio registro de riesgos (R-07, RBS «SEG») dice que solo se usarán datos ficticios y que, si una
  evidencia expone credenciales reales, se retira de inmediato.
- **Sistema:** son cuentas del ambiente de producción (`SEED_USERS_JSON`, `deploy/generate-secrets.mjs`). Una de ellas también se
  compartió por chat durante el desarrollo.
- **Efecto:** cualquiera con el PDF controla el sistema como administrador; contradice RNF-04/RNF-06 y el riesgo R-07 que el
  documento dice tener mitigado.
- **Corrección:** rotar **ahora** las cinco contraseñas (con las nuevas herramientas: Usuarios → «Clave temporal»), retirar el anexo
  del documento y entregar al docente cuentas de demostración que se puedan reiniciar. Regenerar los secretos de producción con
  `deploy/generate-secrets.mjs`.

### 🔴 H-02 · RNF-07: bloqueo «temporal de 15 minutos» vs. bloqueo indefinido · `[Ambos]`
- **Documento:** RNF-07 y el factor «Confiabilidad»: tras 5 intentos fallidos el acceso se bloquea **15 minutos** y luego el usuario
  puede intentar de nuevo. El Sprint 7 incluye «verificar el bloqueo por intentos fallidos».
- **Sistema:** `AuthSessionService.signIn` + `UsersRepository.registerFailedLogin` bloquean la cuenta (`lockedAt`) y **solo un
  administrador la desbloquea** (`PATCH /api/users/:uuid/status {locked:false}`; error `SAUT-E014`, HTTP 423). No hay expiración
  automática. Además existe un tope aparte de 10 fallos por correo cada 15 min (`RateLimitService`), que no es el bloqueo del RNF.
- **Efecto:** el criterio de aceptación del RNF-07 («al finalizar ese tiempo, deberá permitir que el usuario intente iniciar
  sesión nuevamente») **falla**. Además, quien adivine un correo puede dejar fuera a esa persona (denegación dirigida).
- **Corrección:** `[Sis]` agregar `LOGIN_LOCK_MINUTES` (15) y tratar `lockedAt` como vencido pasado ese tiempo, conservando el
  desbloqueo manual del administrador; o `[Doc]` cambiar RNF-07 y CU07-A3 a «bloqueo hasta que un administrador lo libere». Hay
  que elegir una de las dos: hoy el documento y el sistema se contradicen.

### 🟠 H-03 · Mensaje de credenciales incorrectas: tres versiones distintas · `[Ambos]`
- **Documento:** RF-07 exige «Correo electrónico o contraseña incorrectos». El QC-01 registra como resultado «Credenciales
  inválidas». El QC-02 registra «Ingresa un correo válido».
- **Sistema:** backend `SAUT-E004` = «Credenciales inválidas» (`error-codes.ts`); el mock del front dice «Correo o contraseña
  incorrectos»; el validador del correo dice «Ingresa un correo válido (ej. ana@empresa.com)» (`validation-errors.ts`).
- **Efecto:** el prototipo no cumple literalmente el criterio de RF-07 y el mock y el backend discrepan entre sí.
- **Corrección:** unificar el texto del RF (`messageEs` de `SAUT-E004` y el mock) y actualizar la evidencia del QC-01; ajustar el
  texto exacto citado en QC-02.

### 🟠 H-04 · Alta de ticket: sin evidencia, sin «Cancelar» y sin pantalla de confirmación · `[Sis]`
- **Documento:** RF-03 y CU03 (pasos 3 y 6, flujo A2): adjuntar evidencia al crear, botón «Cancelar» con confirmación y una
  pantalla de confirmación con el resumen y el ID. CU05 paso 7 también contempla evidencia.
- **Sistema:** `ticket-new` («Alta rápida») no tiene selector de evidencia (solo existe al comentar y al resolver), no tiene
  «Cancelar» ni confirmación y, al crear, vuelve al listado con un aviso (`ticket-new.ts`). El propio `CLAUDE.md` del front lo
  deja anotado como pendiente.
- **Corrección:** reutilizar `app-evidence-uploader` en el alta, agregar «Cancelar» con confirmación y mostrar el resumen con el
  ID correlativo tras crear.

### 🟠 H-05 · Estado inicial «Abierto» y nombres de estados inconsistentes · `[Doc]`
- **Documento:** RF-03/CU03 hablan del estado inicial «Abierto»; la pantalla 5 dice «En Proceso»; CU01 «En Progreso»; RF-02 «Reabierto»;
  el Kanban del proceso lista «Bloqueado» en un párrafo y no en la tabla.
- **Sistema:** 8 estados: `new` («Nuevo»), `assigned`, `in_progress` («En atención»), `pending_customer`, `escalated`, `resolved`,
  `closed`, `reopened`, agrupados en 3 columnas (`ticket.constants.ts`, `ticket-lifecycle.ts`).
- **Efecto:** un revisor que busque «Abierto» o «En Proceso» no lo encuentra; la matriz de trazabilidad no se puede verificar
  literalmente.
- **Corrección:** agregar un glosario de estados al documento (Abierto = Nuevo, En Proceso = En atención) o renombrar «Nuevo» a
  «Abierto» en el catálogo `ticket-status` (es editable por el administrador).

### 🟠 H-06 · Listas de clasificación (RF-05) no coinciden con el sistema · `[Doc]`
- **Documento:** categoría = Hardware, Software, Acceso, Red u Otro; tipo = Incidente o Solicitud; prioridad = Alta, Media o Baja.
  Pero los objetivos definen SLA para «Crítico/Bloqueante».
- **Sistema:** categorías con «Correo» además; tipos con «Consulta» y «Mejora»; urgencia con 4 niveles (Baja, Media, Alta, **Crítica**).
- **Efecto:** el documento se contradice (tres niveles de prioridad pero un SLA para el crítico) y el sistema agrega valores sin
  respaldo en un RF. El riesgo R-06 (confusión «prioridad» vs «urgencia») sigue vigente: el sistema usa «Urgencia».
- **Corrección:** actualizar RF-05 y las pantallas 4/5 con las listas reales y unificar «urgencia».

### 🟠 H-07 · Pantalla «Asignar ticket» sin «Notas de asignación» · `[Sis]`
- **Documento:** la pantalla 5 incluye un cuadro multilínea «Notas de asignación», el nivel de prioridad y el botón «Asignar Ticket».
- **Sistema:** se asigna desde el formulario de edición (campo «Asignado a») o con `POST …/assign`; no existe campo de notas de
  asignación (búsqueda en front y back sin resultados) y no hay una pantalla de asignación propia.
- **Corrección:** agregar la nota de asignación al evento `ASSIGNED` del historial (visible en el hilo) o retirar la pantalla del
  diseño.

### 🟠 H-08 · Reabrir: el motivo es opcional; el documento lo exige · `[Sis]`
- **Documento:** pantalla 8 y CU02-A3: el usuario explica por qué continúa el problema («Enviar comentario y reabrir»). La pantalla 7
  pide «Sí, problema resuelto / No, el problema continúa».
- **Sistema:** «Mis tickets» ofrece «Reabrir ticket» con un motivo **opcional** (`my-tickets.html`); no existe el selector Sí/No
  previo (la pregunta «¿se resolvió?» solo aparece en la encuesta posterior al cierre).
- **Corrección:** pedir el motivo (mínimo 3 caracteres) al reabrir y guardarlo como comentario público del mismo cambio.

### 🟠 H-09 · Pantalla «Cerrar el ticket» sin el resumen final · `[Sis]`
- **Documento:** pantalla 9: mensaje «Tu ticket #ID ha sido cerrado», fecha de apertura y de cierre, agente asignado, solución aplicada
  y «Regresar a Mis tickets».
- **Sistema:** al confirmar, el ticket pasa a «Cerrado» y se abre la encuesta; se muestra la solución y la evidencia, pero no una
  pantalla de cierre con las dos fechas y el agente.
- **Corrección:** agregar la tarjeta de resumen al detalle de un ticket cerrado.

### 🟠 H-10 · Notificaciones y encuesta «por correo o chat» vs. buzón interno · `[Doc]`
- **Documento:** CU01 paso 5 («interfaz, correo electrónico o canal configurado»), objetivo CSAT («encuesta automática por correo o
  chat») y pantalla 9 («por correo o chat»).
- **Sistema:** no hay SMTP por decisión del proyecto: el aviso va a la campana (SSE) y la encuesta al buzón (`notifications.md`).
- **Efecto:** desviación **aceptada pero no documentada**; quien lea el PDF espera un correo.
- **Corrección:** declarar en el documento que el canal es el buzón de notificaciones y registrar la decisión en el control de
  cambios.

### 🟠 H-11 · CU08 / RNF-04 describen otra arquitectura (RLS y roles de otro dominio) · `[Doc]`
- **Documento:** CU08 habla de los roles «paciente, médico, administrador», exige «políticas RLS activas en PostgreSQL» y afirma
  que «el aislamiento de datos por usuario y rol está garantizado en la capa de base de datos».
- **Sistema:** la autorización es CASL en la capa de aplicación (`CaslAbilityFactory`, `readableRowFilter`, `assertCan`); no hay
  políticas `ROW LEVEL SECURITY` en las migraciones. Los roles son Cliente, Agente, Supervisor, Auditor y Administrador.
- **Efecto:** texto copiado de otro proyecto; la postcondición del CU08 no se cumple tal como está escrita.
- **Corrección:** reescribir CU08 con los roles reales y CASL, o implementar RLS (no recomendado: duplicaría reglas).

### 🟠 H-12 · Funcionalidad sin requisito (y sin pantalla en el documento) · `[Doc]`
- **Documento:** la verificación de pantallas exige «no existen pantallas que no estén vinculadas a ningún requisito».
- **Sistema:** existen módulos sin RF/NEC: autenticador TOTP y códigos de recuperación, tareas programadas, catálogos editables,
  menú administrable, relaciones/compartir, auditoría, apariencia, guía de estilos, rol Auditor, administración de usuarios
  (alta, clave temporal, restablecer TOTP), tablero Kanban y SLA por tarjeta.
- **Efecto:** la matriz de trazabilidad queda incompleta (hay pantallas huérfanas).
- **Corrección:** agregar RF-08… (administración de usuarios, tareas programadas, auditoría, recuperación de acceso) o marcarlos
  como «fuera de alcance de la evaluación».

### 🟠 H-13 · RNF-01 (24 h) y RNF-03 (≤ 2 s) sin evidencia medible · `[Sis]`
- **Documento:** RNF-03 se comprobará con pruebas de rendimiento; el factor «Eficiencia» fija 2 s para confirmar un ticket.
- **Sistema:** no hay prueba de rendimiento ni monitoreo de disponibilidad en el repositorio; la API corre en una réplica con
  Watchtower. El mock simula 500 ms (no es una medición).
- **Corrección:** una prueba e2e que mida «Enviar ticket → confirmación» (umbral 2 s) y un monitoreo externo de
  `/api/health/ready` para RNF-01.

### 🟠 H-14 · Riesgos operativos excluidos, pero el sistema ya está en producción · `[Doc]`
- **Documento:** la gestión de riesgos aclara que no analiza riesgos de operación (infraestructura, base de datos, alojamiento)
  porque el alcance es «un prototipo navegable sin programación completa, base de datos ni servidor».
- **Sistema:** hay API, Postgres, Redis, MinIO, despliegue en Dokploy con dominio público y datos reales.
- **Corrección:** agregar riesgos de respaldo (Postgres y MinIO), gestión de secretos, disponibilidad y una sola réplica.

### 🟡 H-15 · Defectos de copiar-pegar en los casos de uso · `[Doc]`
- CU05, flujos A1 y A2, repiten textualmente los de CU04 (SLA y colaborador sin tickets).
- CU07, flujos A1–A3, repiten los de CU06 (correo ya registrado, contraseñas que no coinciden) y su postcondición dice «queda
  registrado» en vez de «inició sesión».
- La necesidad NEC-01 y su requisito RF-01 quedaron con la redacción ambigua que QA-01 dice haber corregido en el texto de la
  tabla de requisitos (la tabla de la Fase 1 no se actualizó).

### 🟡 H-16 · Alcance contradictorio sobre usuarios externos · `[Doc]`
- El problema habla de «usuarios internos y externos» y el rol Cliente es «interna o externa»; el alcance dice que **no** atenderá
  soporte a clientes externos. El sistema solo distingue por rol (no tiene el concepto de externo).

### 🟡 H-17 · Roles del documento vs. roles del sistema · `[Doc]`
- «Usuarios incluidos» lista 3 (Cliente, Agente, Administrador); «Usuarios objetivo» describe 4 (con Supervisor); el sistema
  implementa 5 (agrega Auditor). RF-07 nombra solo Usuario Final, Agente y Administrador.

### 🟡 H-18 · Evidencias de QA-02 con números de línea desactualizados · `[Doc]`
- La tabla cita líneas concretas (`ticket.schema.ts:35,40,41…`, `tickets.controller.ts:62…`, `admin-user.dto.ts:27,31,35`). El código
  cambió después (nuevos filtros `mine`/`assigned`, nuevos DTO de cuentas): hay que volver a capturar o citar por símbolo.

### 🟡 H-19 · «Tiempo promedio en horas» (QA-01 RF-04) vs. formato del sistema · `[Doc]`
- La corrección de RF-04 dice que el tiempo se mide en horas; el sistema lo muestra en minutos/horas/días (`formatMinutes`). Es
  equivalente, pero el criterio debería decir «minutos, horas o días según la magnitud».

### 🟡 H-20 · El prototipo «simulado» ya es un sistema real · `[Doc]`
- CU02 y la pantalla 6 hablan de evidencia «simulada» y R-02 de funciones simuladas; el sistema sube archivos reales a un bucket
  (imágenes, PDF, Excel, CSV y videos de hasta 5 minutos) y guarda en Postgres. Declarar el cambio de alcance en el control de
  cambios evita que el revisor lo tome como inconsistencia.

### 🟡 H-21 · Defectos a corregir en el propio sistema detectados durante la auditoría · `[Sis]`
- `ticketkanban/src/app/shared/dynamic-form/dynamic-field/dynamic-field.ts` (cambio sin terminar en el árbol de trabajo) no compila
  (`type` dentro de una clase) y rompe `ng build`/`ng test`. No forma parte de esta auditoría pero **bloquea** cualquier entrega.

## 3. Matriz requisito → verificación

| Requisito | Resultado | Evidencia |
|---|---|---|
| RF-01 notificar el cambio de estado | ✅ Cumple (por buzón, ver H-10) | `TicketLifecycleService.notifyRequester`, SSE, `ticket-notifications.e2e-spec.ts` |
| RF-02 comentar, evidencia, confirmar/reabrir | 🟠 Parcial (H-08, H-09) | `my-tickets-cu02.spec.ts`, `evidence-and-jobs.e2e-spec.ts` |
| RF-03 registrar ticket | 🟠 Parcial (H-04, H-05) | `ticket-new`, `TicketsService.create` |
| RF-04 métricas del equipo | ✅ Cumple | `metrics-engine.ts`, `metrics.html`, exportación de reportes |
| RF-05 clasificar | 🟠 Cumple con listas distintas (H-06) | `ticket.schema.ts` |
| RF-06 registro | ✅ Cumple (política de contraseña y correo duplicado) | `SignUpSchema`, `StrongPasswordSchema` |
| RF-07 inicio de sesión | 🟠 Parcial (H-03) | `auth.controller.ts` |
| RNF-01 24 h | ❓ Sin evidencia (H-13) | — |
| RNF-02 historial inalterable | ✅ Cumple | `STCK-E002` (409 al editar), eventos append-only |
| RNF-03 ≤ 2 s | ❓ Sin evidencia (H-13) | — |
| RNF-04 acceso por rol | ✅ Cumple (403 `SAUT-E001`; ver H-11 sobre RLS) | `casl.guard.ts`, e2e de permisos |
| RNF-05 usabilidad ≥ 80 % | ❓ Requiere prueba con usuarios | guion de pruebas |
| RNF-06 contraseñas con hash | ✅ Cumple (scrypt + sal, comparación en tiempo constante) | `users.repository.ts` |
| RNF-07 bloqueo 15 min | 🔴 No cumple (H-02) | `auth-session.service.ts` |

## 4. Lo que sí cumple (conviene citarlo como evidencia)
1. Comentarios inmutables: intentar editar responde 409 `STCK-E002`.
2. Contraseñas con hash scrypt + sal por usuario; nunca se devuelven (ni hash ni sal) en la API.
3. Política de contraseña (8+, mayúscula, minúscula, número y símbolo) en registro y cambio.
4. Control de acceso por rol en servidor (CASL) y en el front (menú y rutas).
5. Cierre automático a las 48 h configurable por el administrador y ejecutable a mano.
6. Evidencia con validación de tipo por firma de contenido y tope por familia; videos ≤ 5 min.
7. Encuesta CSAT (1–5, ¿se resolvió?, comentario opcional) y alerta a supervisores con nota baja.
8. Métricas FCR, SLA y CSAT con muestra y semáforo; «sin información» cuando no hay datos (A1) y ceros (A3).
9. Estado en vivo (SSE) con alerta de sincronización y botón «Actualizar» (CU01 A2).
10. Auditoría de toda mutación, solo con nombres de campos.
11. Recuperación de acceso sin correo: autenticador TOTP, códigos de recuperación de un solo uso y contraseña temporal por la
    administración con cambio obligatorio.

## 5. Plan de corrección sugerido
1. **Hoy:** H-01 (rotar contraseñas y retirar el anexo) y H-21 (dejar compilando el front).
2. **Antes de la entrega:** decidir H-02 (código o documento), unificar H-03 y corregir las contradicciones de redacción
   (H-05, H-06, H-10, H-11, H-15, H-16, H-17).
3. **Sprint siguiente:** H-04, H-07, H-08, H-09 (brechas funcionales) y H-13 (pruebas de rendimiento y disponibilidad).
4. **Control de cambios:** registrar los cambios de alcance (H-12, H-14, H-20).
