import { WCAG_AA_NORMAL_TEXT } from '../../core/utils/color-contrast.util';
import type { IContrastPair, IGuideSection } from './style-guide.interface';

/** Mínimo para componentes de interfaz, bordes de controles y foco (WCAG 1.4.11). */
export const WCAG_AA_NON_TEXT = 3;

/** Pares de tokens que usa la app. Se miden EN VIVO: cambian con el modo y el color elegido. */
export const CONTRAST_PAIRS: IContrastPair[] = [
  { label: 'Texto sobre fondo', foreground: '--app-text', background: '--app-bg', minimum: WCAG_AA_NORMAL_TEXT },
  {
    label: 'Texto secundario sobre superficie',
    foreground: '--app-text-muted',
    background: '--app-surface',
    minimum: WCAG_AA_NORMAL_TEXT,
  },
  {
    label: 'Texto del botón primario',
    foreground: '--app-primary-contrast',
    background: '--app-primary',
    minimum: WCAG_AA_NORMAL_TEXT,
  },
  {
    label: 'Mensaje de error sobre superficie',
    foreground: '--app-danger',
    background: '--app-surface',
    minimum: WCAG_AA_NORMAL_TEXT,
  },
  {
    label: 'Borde de campo sobre superficie',
    foreground: '--p-form-field-border-color',
    background: '--app-surface',
    minimum: WCAG_AA_NON_TEXT,
  },
  { label: 'Anillo de foco sobre fondo', foreground: '--app-focus-ring', background: '--app-bg', minimum: WCAG_AA_NON_TEXT },
];

export const GUIDE_SECTIONS: IGuideSection[] = [
  {
    id: 'color',
    title: 'Color y contraste',
    criteria: [
      {
        code: '1.4.3',
        name: 'Contraste (mínimo)',
        level: 'AA',
        howWeMeet: 'Texto con contraste ≥ 4.5:1. El color principal que elige el usuario se ajusta al paso de la paleta que cumple.',
      },
      {
        code: '1.4.11',
        name: 'Contraste sin texto',
        level: 'AA',
        howWeMeet: 'Bordes de controles y anillo de foco ≥ 3:1.',
      },
      {
        code: '1.4.1',
        name: 'Uso del color',
        level: 'A',
        howWeMeet: 'El color nunca es la única señal: los estados llevan texto, los enlaces van subrayados y lo activo se marca con ✓ o con un borde.',
      },
    ],
    do: ['Usar solo los tokens --app-* (se adaptan al modo oscuro y al color de marca).'],
    avoid: ['Clases de color de Tailwind (text-slate-500, bg-white): rompen el modo oscuro y el contraste.'],
  },
  {
    id: 'typography',
    title: 'Tipografía y encabezados',
    criteria: [
      {
        code: '1.3.1',
        name: 'Información y relaciones',
        level: 'A',
        howWeMeet: 'Un solo h1 por página y jerarquía sin saltos (h1 → h2 → h3).',
      },
      {
        code: '1.4.4',
        name: 'Cambio de tamaño del texto',
        level: 'AA',
        howWeMeet: 'Tamaños en rem: la página funciona con el zoom al 200 %.',
      },
      {
        code: '1.4.12',
        name: 'Espaciado del texto',
        level: 'AA',
        howWeMeet: 'Los contenedores de texto no tienen altura fija: el texto no se corta al aumentar el interlineado.',
      },
    ],
    do: ['Encabezados que describan el contenido de su sección.'],
    avoid: ['Elegir el nivel del encabezado por su tamaño visual.'],
  },
  {
    id: 'buttons',
    title: 'Botones',
    criteria: [
      {
        code: '4.1.2',
        name: 'Nombre, función, valor',
        level: 'A',
        howWeMeet: '<button> para acciones y <a> para navegar. El botón de solo ícono lleva aria-label.',
      },
      {
        code: '2.5.8',
        name: 'Tamaño del objetivo (mínimo)',
        level: 'AA',
        howWeMeet: 'Objetivos ≥ 2.75rem (44 px) en pantallas táctiles, por encima del mínimo de 24 px.',
      },
      {
        code: '2.4.7',
        name: 'Foco visible',
        level: 'AA',
        howWeMeet: 'Anillo de 2 px, separado del borde, en todo elemento interactivo (:focus-visible).',
      },
      {
        code: '3.3.4',
        name: 'Prevención de errores',
        level: 'AA',
        howWeMeet: 'Las acciones destructivas piden confirmación y el foco inicial queda en «Cancelar».',
      },
    ],
    do: [
      'Un solo botón primario por zona; el resto, secundario o de texto.',
      'Si un botón está deshabilitado, explicar por qué.',
    ],
    avoid: [
      '<div (click)> como botón: no recibe foco ni se activa con el teclado.',
      'Rótulos genéricos («Aceptar») en acciones destructivas.',
    ],
  },
  {
    id: 'links',
    title: 'Enlaces',
    criteria: [
      {
        code: '1.4.1',
        name: 'Uso del color',
        level: 'A',
        howWeMeet: 'Un enlace dentro de un texto lleva subrayado en reposo: el color solo no basta para distinguirlo.',
      },
      {
        code: '2.4.4',
        name: 'Propósito de los enlaces',
        level: 'A',
        howWeMeet: 'El texto describe el destino («Ver tasas de cambio»), nunca «aquí» ni «leer más».',
      },
      {
        code: '1.4.3',
        name: 'Contraste (mínimo)',
        level: 'AA',
        howWeMeet: 'El color y el subrayado salen del color principal elegido, que se ajusta al paso de la paleta que cumple 4.5:1.',
      },
    ],
    do: [
      'Enlace embebido: clase app-link (color principal + subrayado que lo sigue).',
      'Enlace independiente (menú, CTA): app-link--standalone, subrayado solo al pasar el mouse o enfocar.',
      'Ícono del destino a la izquierda (link-icon) y pi-external-link a la derecha si abre otra pestaña.',
    ],
    avoid: [
      'Un <a> sin clase: el preflight de Tailwind lo deja idéntico al texto.',
      'Fijar el color del enlace a un gris o a un hex: ignora el color que eligió el usuario.',
      'Dos enlaces al mismo destino en una misma vista.',
    ],
  },
  {
    id: 'breadcrumbs',
    title: 'Breadcrumb',
    criteria: [
      {
        code: '2.4.8',
        name: 'Ubicación',
        level: 'AAA',
        howWeMeet: 'La ruta indica dónde está el usuario. En móvil se oculta, porque el h1 ya cumple esa función.',
      },
      {
        code: '1.3.1',
        name: 'Información y relaciones',
        level: 'A',
        howWeMeet: '<nav aria-label> + <ol>. La página actual lleva aria-current="page" y los separadores, aria-hidden.',
      },
    ],
    do: ['Derivarlo de la URL: funciona igual al recargar o al entrar por un enlace directo.'],
    avoid: ['Que el último paso sea un enlace a la misma página.'],
  },
  {
    id: 'fields',
    title: 'Campos de formulario',
    criteria: [
      {
        code: '3.3.2',
        name: 'Etiquetas o instrucciones',
        level: 'A',
        howWeMeet: 'Cada control tiene un <label for> visible, y los obligatorios se indican con texto.',
      },
      {
        code: '3.3.1',
        name: 'Identificación de errores',
        level: 'A',
        howWeMeet: 'El error aparece al salir del campo, como texto asociado con aria-describedby.',
      },
      {
        code: '3.3.3',
        name: 'Sugerencias ante errores',
        level: 'AA',
        howWeMeet: 'Los mensajes del catálogo dicen cómo corregir («Ingresa un correo válido (ej. ana@empresa.com)»).',
      },
      {
        code: '4.1.3',
        name: 'Mensajes de estado',
        level: 'AA',
        howWeMeet: 'El error usa role="alert": el lector de pantalla lo anuncia sin mover el foco.',
      },
    ],
    do: ['Validar con el MISMO schema Zod que el backend: el mensaje es igual en los dos lados.'],
    avoid: ['Marcar en rojo un campo que el usuario todavía no tocó.', 'Usar el placeholder como etiqueta.'],
  },
  {
    id: 'feedback',
    title: 'Estados y mensajes',
    criteria: [
      {
        code: '1.4.1',
        name: 'Uso del color',
        level: 'A',
        howWeMeet: 'Las etiquetas de prioridad y los mensajes siempre llevan texto, no solo color.',
      },
      {
        code: '4.1.3',
        name: 'Mensajes de estado',
        level: 'AA',
        howWeMeet: 'Toasts y avisos en regiones vivas (role="status" o role="alert").',
      },
      {
        code: '2.2.1',
        name: 'Tiempo ajustable',
        level: 'A',
        howWeMeet: 'El aviso de error de conexión queda fijo hasta que el usuario lo cierra.',
      },
    ],
    do: ['Decir qué pasó y qué hacer ahora («No se pudo cargar el tablero» + «Reintentar»).'],
    avoid: ['Mostrar el código de error como único texto.'],
  },
  {
    id: 'tables',
    title: 'Tablas y tarjetas',
    criteria: [
      {
        code: '1.3.1',
        name: 'Información y relaciones',
        level: 'A',
        howWeMeet: 'La tabla usa <th>; en móvil cada fila es una tarjeta con <dl> (término → valor).',
      },
      {
        code: '1.4.10',
        name: 'Reajuste del contenido',
        level: 'AA',
        howWeMeet: 'Sin scroll horizontal a 320 px: la tabla pasa a tarjetas.',
      },
    ],
    do: ['Incluir el código del registro en el nombre accesible de cada acción de fila («Editar TCK-001»).'],
    avoid: ['Mostrar acciones solo al pasar el mouse: no existen en táctil ni con teclado.'],
  },
  {
    id: 'motion',
    title: 'Movimiento',
    criteria: [
      {
        code: '2.3.3',
        name: 'Animación por interacciones',
        level: 'AAA',
        howWeMeet: 'Con «reducir movimiento» del sistema no se anima nada: ni CSS, ni View Transitions, ni anime.js.',
      },
      {
        code: '2.2.2',
        name: 'Poner en pausa, detener, ocultar',
        level: 'A',
        howWeMeet: 'Animaciones cortas (≤ 300 ms) y nunca en bucle. El tablero anima solo la primera carga.',
      },
    ],
    do: [
      'Entradas y salidas con animate.enter / animate.leave (CSS).',
      'anime.js solo para coreografías (stagger, secuencias), cargado de forma diferida.',
      'Animar solo opacity y transform.',
    ],
    avoid: [
      '@angular/animations (deprecado desde Angular 20.2).',
      'Rebotes, parallax o movimiento que no responda a una acción del usuario.',
    ],
  },
  {
    id: 'keyboard',
    title: 'Teclado y foco',
    criteria: [
      {
        code: '2.1.1',
        name: 'Teclado',
        level: 'A',
        howWeMeet: 'Todo se opera con teclado: menú, modales, stepper, tabla y selectores.',
      },
      {
        code: '2.4.1',
        name: 'Evitar bloques',
        level: 'A',
        howWeMeet: 'El enlace «Saltar al contenido» es el primer elemento enfocable.',
      },
      {
        code: '2.4.3',
        name: 'Orden del foco',
        level: 'A',
        howWeMeet: 'Los modales atrapan el foco y lo devuelven al botón que los abrió.',
      },
      {
        code: '2.4.11',
        name: 'Foco no oculto (mínimo)',
        level: 'AA',
        howWeMeet: 'Las acciones fijas de la tabla no tapan el elemento enfocado.',
      },
    ],
    do: ['Probar cada pantalla solo con Tab, Shift+Tab, Enter, Espacio y Esc.'],
    avoid: ['tabindex positivo.', 'outline: none sin un foco alternativo.'],
  },
];
