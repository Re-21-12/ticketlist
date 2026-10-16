# DESIGN — sistema visual de Ticketit

Tokens, espaciado y patrones de UI. Todo lo que hay aquí es **obligatorio** para código nuevo; lo
que no cumple y viene de antes se arregla cuando se toque ese archivo (ver «Deuda» al final).

Los tokens viven en [`src/styles.css`](../src/styles.css) (`:root` y `.app-dark`). Un `.css` de
componente **nunca** escribe un color, un espaciado ni una altura literales: usa los tokens.

---

## Espaciado — escala cerrada de 8 px

Estándar de la industria (Tailwind, Material, Figma, Apple): todo margen, padding, gap y
alto/ancho de espaciado es múltiplo de 8 px, con **4 px como única excepción** para el
micro-espaciado. Motivo técnico, no estético: las resoluciones reales (`1920×1080`, `1440×900`,
`390×844`) son divisibles por 8, y en pantallas de alta densidad (@2x/@3x) los múltiplos pares no
generan sub-píxeles borrosos al escalar.

### Tokens (definidos en `styles.css`)

| Token      | px   | rem      | Uso típico                                              |
| ---------- | ---- | -------- | ------------------------------------------------------- |
| `--app-space-1`  | 4px  | 0.25rem | Micro-espaciado: ícono con texto, borde interior        |
| `--app-space-2`  | 8px  | 0.5rem  | Label ↔ su input                                        |
| `--app-space-3`  | 12px | 0.75rem | Espaciado chico dentro de un grupo                      |
| `--app-space-4`  | 16px | 1rem    | Entre campos de un mismo formulario/tarjeta             |
| `--app-space-6`  | 24px | 1.5rem  | Entre campos «agrupados», con algo más de aire          |
| `--app-space-8`  | 32px | 2rem    | Entre secciones o tarjetas distintas                    |
| `--app-space-12` | 48px | 3rem    | Separación fuerte entre bloques grandes                 |
| `--app-space-16` | 64px | 4rem    | Espaciado de layout (raro en formularios)               |

### Ley de proximidad (Gestalt) — cuál valor usar, no solo que sea múltiplo de 8

La distancia entre elementos **relacionados** tiene que ser MENOR que la de los no relacionados:
la separación comunica agrupación antes que cualquier borde o color.

| Relación                                              | Espaciado      |
| ----------------------------------------------------- | -------------- |
| Label ↔ su input                                      | 4 px u 8 px    |
| Campos de un mismo formulario o tarjeta               | 16 px          |
| Elementos agrupados con más aire (stats, etiquetas)   | 16 px – 24 px  |
| Entre tarjetas o secciones distintas                  | 32 px          |
| Entre bloques grandes de layout                       | 48 px o más    |

En CSS de componente (`.css` propios, no clases de Tailwind) se usa el `var(--app-space-*)`
correspondiente, nunca un decimal suelto. **Prohibido**: `padding: 0.625rem`, `gap: 1.25rem`,
`margin-top: 10px`, y cualquier valor fuera de la tabla.

> Los valores como `0.875rem` o `1.0625rem` sí son válidos como **`font-size`** (escala
> tipográfica aparte, con su propio motivo). No son válidos como espaciado.

Tailwind queda para **layout** (`flex`, `grid`, `gap` con las clases numeradas: `gap-2` = 8 px,
`gap-4` = 16 px… ya cumplen la escala). NUNCA para color (`text-slate-500`, `bg-white`): rompen
el modo oscuro y el color de marca.

---

## Controles — una sola altura

```css
--app-control-height: 2.75rem;  /* 44 px */
--app-control-radius: calc(var(--app-radius) / 1.5);
```

44 px es el **objetivo táctil mínimo** (WCAG 2.5.8) y también la congruencia que se pidió:
un `<input type="date">` nativo mide 44 px y un `pButton size="small"` mide 35 px, así que en la
misma fila los bordes no emparejan.

Reglas:

- En una fila de filtros, **campo y botón miden lo mismo**: los botones de esas filas NO llevan
  `size="small"`.
- Los `<input type="date">` nativos no se usan en barras de filtros: van `p-datepicker` de
  optimus-ui, que sí se puede estilar (`dateFormat="dd/mm/yy"`, `iconDisplay="input"`,
  `appendTo="body"`).
- Todo `pButton` lleva ícono (`pButtonIcon`) + etiqueta (`pButtonLabel`).
- Todo control tiene su `label` asociado (nunca solo `placeholder`).

---

## Estados deshabilitados

optimus-ui (como PrimeNG) pone `pointer-events: none` en sus estados deshabilitados, y el
navegador **resuelve el cursor «a través»** del elemento: por eso un botón deshabilitado parecía
pulsable. La regla global en `styles.css`:

```css
:where(button, input, select, textarea, a, [role='button'])[disabled],
:where(button, input, select, textarea, a, [role='button'])[aria-disabled='true'],
.p-disabled {
  cursor: not-allowed;
  pointer-events: auto;
}
```

- `cursor: not-allowed` → el estado «bloqueado» se ve.
- `pointer-events: auto` → el hover, el tooltip y la **selección/copia de texto** siguen
  funcionando sobre el control apagado (WCAG 4.1.2: el estado se anuncia, no se oculta).
- **No** se baja la opacidad: cada componente ya se atenúa solo y duplicarlo deja la etiqueta
  ilegible.
- Se limita a controles de formulario: no se toca `pointer-events` en cualquier elemento (el
  tablero lo usa a propósito en las tarjetas que se arrastran).

---

## Scroll con la paleta de la app

El scroll por defecto del navegador es un gris que no sigue al tema. La regla es **global y
única** en `styles.css` (`scrollbar-color` para Firefox + `::-webkit-scrollbar*` para
Chrome/Safari/Edge), con `thin` y 8 px.

Para que una lista dentro de una tarjeta tenga tope de alto se usan las utilidades:

| Clase                  | Alto                          | Cuándo                                                |
| ---------------------- | ----------------------------- | ----------------------------------------------------- |
| `.app-scroll-list`     | `var(--app-scroll-3-items)`   | Se ven 3 elementos y el resto se recorre con scroll    |
| `.app-scroll-panel`    | `min(32rem, 70vh)`            | Tablas o paneles largos; el alto lo fija la pantalla   |

Ambas llevan `overscroll-behavior: contain`: al llegar al final, la página de detrás no se mueve.
Un `max-height` + `overflow-y: auto` sobre un contenedor que además tiene `overflow` (recorta el
overlay) necesita `appendTo="body"` en cualquier `p-select`/`p-datepicker`/`p-popover` dentro.

---

## Color — tokens, nunca literales

```css
--app-bg --app-surface --app-surface-muted --app-border
--app-text --app-text-muted --app-primary --app-primary-contrast
--app-danger --app-success --app-warning --app-focus-ring --app-radius
```

### Tonalidades del color de marca (`--app-shade-*`)

`ThemePaletteService` publica en `:root` la rampa **50–950** del color que eligió la persona en
`/appearance` (`palette()` de optimus-ui-styled) y la vuelve a escribir cada vez que cambia. La
usan las barras y los medidores:

```css
--app-meter-low   /* fresco   */
--app-meter-mid   /* medio    */
--app-meter-high  /* crítico  */
```

Los elige **con contraste medido** (≥ 3:1 contra la superficie, WCAG 1.4.11) y `.app-dark` los
**invierte** (sobre fondo oscuro, «más grave» tiene que verse más claro). El color nunca es la
única señal: cada barra lleva su etiqueta con el rango.

Un color literal en un `.css` de componente es un bug: rompe el modo oscuro y el color de marca.

---

## Patrones reutilizables

### Zona de arrastrar y soltar (adjuntar archivo)

`shared/evidence/evidence-uploader` (evidencia de tickets) y el tipo `FieldType.FILE` de
`dynamic-form` usan el mismo patrón de wallet-api:

- Zona completa clickeable con borde `2px dashed var(--app-border)` y `var(--app-radius)`.
- `hover` y estado de arrastre: `border-color: var(--app-primary)` +
  `background: color-mix(in srgb, var(--app-primary) 8%, transparent)`.
- Contador de profundidad (`fileDragDepth`), NO un booleano: `dragenter`/`dragleave` se disparan
  por cada elemento hijo y un booleano hace parpadear el resaltado.
- `preventDefault()` en los cuatro manejadores.
- El archivo ya elegido va en una ficha aparte (ícono + nombre + tamaño + quitar **en línea**).

### Lista con tope dentro de una tarjeta

`.app-scroll-list` (ver «Scroll»). Altura aproximada a propósito: las tarjetas miden distinto
según tengan o no acciones, y `calc(<item> * 3 + <gap> * 2)` es la aproximación honesta.

### Menú desplegable

`p-popover` de optimus-ui: un `<button pButton>` dispara y el panel lleva un botón `pButton` de
ancho completo por opción (con `severity="text"`). Al elegir, `popover.toggle($event)` lo cierra.
Para el submenú del shell, la animación de alto es CSS puro con `grid-template-rows: 0fr → 1fr`
y `overflow: hidden` en el envoltorio (sin JS midiendo alturas).

### Vista previa de evidencia

`app-attachment-list` no abre el archivo en otra pestaña: pasa la URL a `AppEvidencePreview`
(`p-dialog`, `appendTo="body"`), que muestra **solo lectura**: `img` ampliada, `video` con
controles o `iframe` con el visor de PDF nativo del navegador. La descarga es un botón aparte y
explícito — el visor no expone edición ni impresión.

---

## Ilustraciones y estados vacíos

`app-illustration` (`shared/ui/illustration/`): SVG inline decorativo (`aria-hidden`) que hereda
los tokens del tema. Una escena por pantalla (`TIllustration`), en el encabezado
(`.page-header-art`), en los estados vacíos y en las pantallas de acceso.

---

## Deuda (no es ejemplo a seguir)

Varios `.css` anteriores a esta guía usan valores fuera de la escala (`0.625rem`, `1.25rem`,
`0.875rem` como espaciado) y `pButton size="small"` junto a campos de 44 px. **No se migran
retroactivamente**: se corrigen cuando se toque ese archivo por otro motivo. Todo código nuevo
cumple la escala desde ya.