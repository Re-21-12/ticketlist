# Métricas del servicio (FCR · SLA · CSAT) — especificación

> Fuente: requerimientos del proyecto (Service Desk N1). Este documento FIJA las definiciones: cómo se
> calcula cada número, de qué eventos sale y qué se excluye. Un indicador que se calcula de dos formas
> distintas deja de ser un indicador. Lo marcado **(supuesto)** no venía en el requerimiento y hay que
> confirmarlo (ver §9). Estado de la implementación (backend): **hecho** — ciclo de vida, historial inmutable, comentarios, adjuntos, encuesta CSAT,
> cierre automático, rol Supervisor y el motor de métricas con `GET /api/metrics/*`. Las decisiones del §9 quedaron así:
> horario hábil configurable (L–V 8:00–17:00, UTC−6, `sla/business-calendar.ts`) y SLA que se **pausa** en «Pendiente del cliente».
> Pantallas del front: **hecho** el tablero del supervisor (`/metrics`) y «Mis métricas» (`/my-metrics`); **pendiente** «Mis tickets» (cliente), plazos/feriados editables desde «Catálogos», el campo
> departamento del solicitante (áreas críticas) y las mejoras para comparar antes/después (§5).

## 1. Metas

| Indicador | Qué mide | Meta | Fuente de la meta |
|---|---|---|---|
| **FCR** (resolución al primer contacto) | % de tickets resueltos sin seguimiento posterior | **> 75 % – 80 %** | requerimiento |
| **Primera respuesta** | tiempo desde el registro hasta la primera respuesta humana | **< 2 h** | requerimiento |
| **Resolución — Crítico / bloqueante** (sistema caído) | tiempo hasta «Resuelto» | **< 2 h** | requerimiento |
| **Resolución — Medio / operativo** (falla parcial) | ídem | **< 8 h** (o el mismo día hábil) | requerimiento |
| **Resolución — Bajo / consultas o mejoras** | ídem | **< 24 h a 48 h** | requerimiento |
| **Cumplimiento de SLA** | % de tickets cerrados dentro de su plazo | **> 95 %** | requerimiento |
| **CSAT** | satisfacción promedio (escala 1–5) | **≥ 4.5 / 5** | requerimiento |
| Tasa de reapertura | % de tickets «Resuelto» que se reabren | **< 5 %** | (supuesto) |
| Tasa de escalamiento N2/N3 | % de tickets escalados | solo se mide, sin meta | requerimiento: fuera de alcance |

Semáforo de cada indicador: **verde** = cumple la meta · **ámbar** = hasta 5 puntos porcentuales (o 0.3 de CSAT)
por debajo · **rojo** = peor que eso. El color nunca es la única señal: siempre va con el valor y el texto
«Cumple / En riesgo / No cumple» (WCAG 1.4.1).

## 2. Ciclo de vida y eventos (de dónde sale todo)

Cada cambio es un **evento inmutable** (`ticket_events`: quién, cuándo, qué). Las métricas SOLO se calculan a
partir de eventos y marcas de tiempo del ticket, nunca de «el estado de ahora».

| Estado | Entra cuando | Reloj de SLA |
|---|---|---|
| **Nuevo** | el cliente registra el ticket | corre |
| **Asignado** | un supervisor/agente lo asigna a un N1 | corre |
| **En atención** | el agente empieza a trabajarlo | corre |
| **Pendiente del cliente** | el agente espera información del cliente | **en pausa** (supuesto) |
| **Escalado (N2/N3)** | se clasifica como requiere escalonamiento | se detiene; sale del alcance |
| **Resuelto** | el agente documenta la solución | se detiene (marca `resolvedAt`) |
| **Cerrado** | el cliente confirma, o pasan **48 h** sin respuesta (cierre automático) | — |
| **Reabierto** | el cliente rechaza el cierre o hay reincidencia | reinicia un reloj nuevo; cuenta como reapertura |

Eventos que registran las métricas: `CREATED`, `ASSIGNED`, `REASSIGNED`, `STATUS_CHANGED`, `COMMENT_PUBLIC`
(visible al cliente), `COMMENT_INTERNAL` (nota del equipo, no cuenta como contacto), `RESOLVED`, `CLOSED_BY_USER`,
`CLOSED_AUTO`, `REOPENED`, `ESCALATED`, `SURVEY_SENT`, `SURVEY_ANSWERED`. Los comentarios previos **no se editan**
(la corrección es otro comentario), lo que además es lo que hace confiable el historial.

## 3. Definiciones exactas

### 3.1 Primera respuesta

- **Tiempo de primera respuesta** = `primer COMMENT_PUBLIC de un agente` − `CREATED`.
- Un acuse **automático** del sistema NO cuenta (el requerimiento pide «acuse de recibo y diagnóstico inicial» de una persona).
- **Cumple** si `≤ 2 h`. Un ticket aún sin respuesta cuya espera ya pasó de 2 h cuenta como **incumplido** (no se espera a que responda para castigarlo).
- **% de cumplimiento** = tickets con primera respuesta ≤ 2 h ÷ tickets creados en el período que ya tuvieron respuesta o vencieron su plazo.

### 3.2 Plazo de resolución por criticidad

| Criticidad del ticket | Plazo |
|---|---|
| `critical` (sistema caído / bloqueante) | 2 h |
| `high` y `medium` (falla parcial / operativo) | 8 h |
| `low` (consulta o mejora) | 24 h; **48 h** si la categoría es `feature` (mejora) |

El mapeo de las 4 prioridades actuales a los 3 niveles del requerimiento es un **(supuesto)** (§9).

- **Tiempo de resolución** = `RESOLVED` − `CREATED` − tiempo en **Pendiente del cliente** (pausa).
- **Cumple** si el tiempo de resolución ≤ plazo. Un ticket abierto que ya superó su plazo se marca **fuera de SLA** de inmediato (flujo alterno A2 del CU04), no al cerrarse.
- **% de cumplimiento de SLA** = tickets cerrados dentro de plazo ÷ tickets cerrados del período. Meta **> 95 %**.
- Un ticket **reabierto** inicia un nuevo plazo; el original ya contó en su momento.
- Los **escalados a N2/N3** quedan fuera del cumplimiento de SLA (su resolución no es parte del alcance) y se reportan aparte.

### 3.3 FCR — resolución al primer contacto

- Un ticket cuenta como **resuelto al primer contacto** si se cumplen las tres:
  1. Se resolvió con **a lo sumo 1 interacción pública del agente** antes de `RESOLVED` (un solo contacto con el cliente).
  2. **No** se escaló a N2/N3.
  3. **No** se reabrió dentro de los 7 días siguientes **(supuesto)**; si se reabre deja de contar, aunque ya se hubiera reportado.
- **FCR** = tickets resueltos al primer contacto ÷ tickets resueltos del período. Meta **> 75 – 80 %**.
- Las notas internas no cuentan como contacto; pedir datos al cliente (pasar a «Pendiente del cliente») sí rompe el primer contacto.

### 3.4 CSAT

- Una encuesta por ticket, enviada **automáticamente al cerrarlo** (por correo o chat), con **1 a 5** y un comentario **opcional**.
  - 5 Muy satisfecho · 4 Satisfecho · 3 Neutral · 2 Insatisfecho · 1 Muy insatisfecho.
- **No intrusiva**: una sola invitación, sin recordatorios, vence a los 7 días **(supuesto)**, y la respuesta es voluntaria. Un ticket sin respuesta no entra al promedio.
- **CSAT promedio** = media de las calificaciones recibidas. Meta **≥ 4.5**.
- Complementarios: **% satisfechos** (4–5), **tasa de respuesta** (respondidas ÷ enviadas) y los comentarios de 1–2 para revisión del supervisor.
- **Muestra mínima**: con menos de **10** respuestas en el período se muestra «datos insuficientes», no un promedio engañoso **(supuesto)**.
- La calificación se atribuye al agente asignado al **cierre**; los comentarios de un cliente no se muestran a otros clientes.

### 3.5 Indicadores operativos (CU04)

Tickets **atendidos** (con respuesta), **pendientes** (abiertos), **resueltos** y **cerrados**; **tiempo medio de resolución**;
**tasa de reapertura**; **antigüedad del backlog** (abiertos por rango: < 1 día, 1–3, > 3); **cerrados automáticamente**
(48 h sin respuesta). Con tickets insuficientes el valor es «sin información» (A1); un colaborador sin tickets
muestra **0** (A3), nunca un error.

## 4. Problemas frecuentes y áreas críticas

Para «identificar patrones, incidencias recurrentes y áreas críticas»:

- **Por categoría** y por **etiqueta/asunto**: cantidad, tiempo medio de resolución, % fuera de SLA y reapertura.
- **Incidencia recurrente**: mismo solicitante + misma categoría **≥ 2 veces en 30 días**, o el mismo título normalizado ≥ 3 veces en el período.
- **Área crítica**: departamento del solicitante (TI, RR. HH., …) con más tickets, más incumplimientos o menor CSAT. Requiere el campo **departamento** en el usuario.
- **Horas pico** (día y hora de creación) para dimensionar turnos.
- Comparaciones por período (semana, mes) con variación contra el anterior.

## 5. Retorno de la inversión

El requerimiento pide «evaluar el desempeño y el impacto de las mejoras con datos reales»:

- **Desempeño por colaborador**: tickets gestionados, resueltos, % SLA, FCR, CSAT y tiempo medio (CU04). Se muestran SIEMPRE con el tamaño de muestra; un colaborador con pocos tickets no se compara por porcentaje.
- **Impacto de una mejora**: el supervisor registra una **mejora** (fecha, descripción) y el sistema compara las mismas métricas **30 días antes y 30 días después**. Sin cambiar la fórmula de ningún indicador.
- Costo por ticket y ahorro en horas requieren un costo/hora (dato de negocio, no del sistema): **fuera de esta fase** salvo que se aporte.
- **Uso responsable**: las métricas de personas sirven para coaching, no para ranking público; solo las ve el supervisor y cada agente las suyas.

## 6. Quién ve qué (roles)

| Rol | Ve |
|---|---|
| Cliente | Sus tickets, el historial, quién lo atiende, y puede comentar, adjuntar, confirmar o reabrir y calificar |
| Agente N1 | Sus tickets y sus propias métricas |
| **Supervisor** (rol nuevo) | Todas las métricas del equipo y de cada colaborador (solo lectura), asignación y reasignación, escalamientos |
| Administrador | Configuración (plazos, estados, catálogos), usuarios y roles, auditoría; **no** modifica tickets para «arreglar» métricas |

Las pantallas de métricas **no modifican** ningún ticket (postcondición de CU04). Los plazos de SLA y las metas viven
en configuración (catálogo), no en el código, y **cada cambio queda en la auditoría**: así una meta no se mueve en silencio.

## 7. Qué hizo falta en el modelo (ya implementado en el backend)

| Falta | Para qué |
|---|---|
| Estados `Nuevo/Asignado/En atención/Pendiente del cliente/Resuelto/Cerrado/Reabierto/Escalado` | Reemplazan `todo/in_progress/done` (cada uno con su regla de transición) |
| `ticket_events` (inmutable) | Origen único de todas las métricas e historial de interacciones |
| Comentarios con adjuntos (público/interno, sin edición) | Primera respuesta, FCR, trazabilidad; límite de tamaño por archivo |
| Marcas `firstResponseAt`, `resolvedAt`, `closedAt`, `reopenCount`, `pausedMs` | Cálculo rápido y consistente (derivadas de los eventos) |
| Plazos por criticidad + calendario hábil | SLA |
| Encuesta CSAT (`ticket_surveys`) | CSAT |
| Rol `SUPERVISOR`, campo `department` del usuario | Permisos y áreas críticas |
| Job de cierre automático a las 48 h y de vencimiento de encuestas | A4 de la historia y encuesta no intrusiva |

## 8. Reglas para que el número sea confiable

1. **Una sola fórmula**, en un solo módulo (`metrics`), con pruebas de cada caso límite; el front no recalcula.
2. Todo tiempo se guarda en **UTC** y se muestra en la zona del usuario; los plazos se calculan en el servidor.
3. Cada indicador devuelve `{ value, sample, status }`: valor, tamaño de muestra y semáforo; sin muestra suficiente, `status: 'no-data'`.
4. Un cambio de metas o plazos **no recalcula el pasado**: cada ticket guarda el plazo vigente al crearse.
5. Reapertura y escalamiento **corrigen hacia atrás** FCR y SLA (por eso se calculan al consultar, no se congelan).

## 9. Decisiones pendientes (supuestos a confirmar)

1. **Reloj**: ¿horas corridas o **horario hábil** (p. ej. L–V 8:00–17:00 con feriados)? Los plazos de 2 h y 8 h cambian mucho de significado.
2. **Mapeo de prioridades**: `critical → 2 h`, `high` y `medium → 8 h`, `low → 24 h` (48 h para mejoras). ¿Se ajusta?
3. **Pausa** del SLA en «Pendiente del cliente»: ¿sí? (recomendado; si no, el agente queda penalizado por la lentitud del cliente).
4. **FCR**: ventana de reapertura de 7 días y «a lo sumo un contacto del agente».
5. **CSAT**: una invitación sin recordatorios, 7 días de vigencia y mínimo de 10 respuestas.
6. **Rol Supervisor** y campo **departamento** del solicitante.
7. Canal de la encuesta: correo (ya existe `IMailService`) y/o chat in-app.

## 10. Plan de implementación

Pasos 1–3 hechos en el backend (`modules/tickets`, `modules/metrics`); falta el 4 y el 5.

1. **Modelo y eventos**: estados nuevos, `ticket_events`, comentarios inmutables, adjuntos, cierre automático.
2. **Motor de métricas** (`metrics`): funciones puras + pruebas de cada fórmula de §3 + endpoint solo lectura (`/api/metrics/*`) para Supervisor.
3. **Encuesta CSAT** automática al cerrar (una vez, opcional).
4. **Pantallas**: tablero del supervisor (SLA, FCR, CSAT, por colaborador y problemas frecuentes → `/metrics`) y «Mis métricas» (`/my-metrics`) **hechas**; falta «Mis tickets» (cliente, con historial y quién atiende).
5. **Mejoras y comparación antes/después** (ROI).

## 11. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Estados y transiciones | `src/modules/tickets/lifecycle/ticket-lifecycle.ts` |
| Calendario hábil | `src/modules/tickets/sla/business-calendar.ts` |
| Plazos por criticidad | `src/modules/tickets/sla/sla-policy.ts` |
| Análisis de un ticket (primera respuesta, ciclos, FCR) | `src/modules/tickets/sla/ticket-analysis.ts` |
| Fórmulas agregadas, metas y semáforos | `src/modules/metrics/metrics-engine.ts` |
| Endpoints | `src/modules/metrics/metrics.controller.ts` (`/api/metrics/summary`, `/agents`, `/agents/:email`, `/problems`, `/me`) |
| Pruebas | `*.spec.ts` junto a cada módulo (fórmulas), `test/metrics.e2e-spec.ts`, `test/ticket-lifecycle.e2e-spec.ts` |
