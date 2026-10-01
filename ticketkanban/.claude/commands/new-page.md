---
description: Crea una página nueva en src/app/pages/ siguiendo las convenciones del proyecto
argument-hint: <nombre-kebab> [subject CASL]
---

# Nueva página: $ARGUMENTS

Crea `src/app/pages/<nombre>/` respetando `CLAUDE.md` (sección "Convenciones del proyecto"):

- `<nombre>.ts` + `<nombre>.html` + `<nombre>.css` — el componente (sin template ni estilos inline), solo UI, delega en el store.
- `<nombre>.routes.ts` — `export const <NOMBRE>_ROUTES: Routes` con `title` y, si se pasó un subject CASL, `canActivate: [canGuard('read', '<Subject>')]`.
- `<nombre>.store.ts` — `@Service()`, signals escribibles `private $_x` y lecturas públicas `$x` (`.asReadonly()`/`computed`). Si hay una operación multi-paso (guardar, subir), usa `createStateMachine` (`shared/fsm`) en vez de booleanos.
- `<nombre>.service.ts` — solo si hay HTTP: `extends BaseApiAbstract`, `parseItem()` con el schema Zod.
- `<recurso>.schema.ts` / `.types.ts` / `.constants.ts` / `-form.config.ts` solo si aplican.

Reglas que NO se negocian:
- Colores SOLO con tokens `--app-*` (styles.css), nunca clases de color de Tailwind (`text-slate-600`, `bg-white`…): si no, el modo oscuro y el color del usuario se rompen.
- HTML semántico + WCAG AA: headings en orden, `label` asociado, foco visible, objetivos táctiles ≥ 2.75rem, nada comunicado solo por color.
- Permisos en template con el pipe `can`, nunca `able`.

Registra la ruta en `app.routes.ts` (lazy, `loadChildren`) y, si va al menú, agrégala al menú del BFF (`ticketlistbe/src/bff/shell/shell.service.ts`) y al mock (`core/mock-bff/mock-bff.data.ts`). Al terminar corre `/check`.
