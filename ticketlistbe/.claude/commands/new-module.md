---
description: Crea un módulo de dominio en capas (schema Zod → DTOs → entity → repository → service → controller)
argument-hint: <recurso-singular-kebab> <CÓDIGO-3-LETRAS>
---

# Nuevo módulo: $ARGUMENTS

Sigue `AGENTS.md` (arquitectura en capas + nomenclatura). Toma `modules/tickets/` como plantilla:

1. `schemas/<recurso>.schema.ts` — `<X>BaseSchema`, `<X>CreateSchema` (defaults), `<X>UpsertSchema`, `<X>ResponseSchema` (fechas como string), `<X>FilterSchema`. Mensajes en español.
2. `dtos/` — `create-<x>.dto.ts`, `update-<x>.dto.ts`, `<x>-query.dto.ts` con `createZodDto(...)`; `<x>-response.dto.ts` con `T<X>Response` y `paginatedSchema(...)`.
3. `<x>.entity.ts` (extends `BaseEntity`), `<x>s.repository.ts` (extends `InMemoryRepository`), `<x>s.service.ts` (extends `BaseService`: `toEntity`/`mergeEntity`/`toResponse` que parsea con el schema de respuesta).
4. `<x>s.controller.ts` — cada handler con `@CheckAbility`, `@ApiParam` en rutas `:uuid` y `@ApiZodBody`/`@ApiZodResponse` desde los MISMOS schemas.
5. `<x>s.module.ts` (dominio, exporta el service) + `<x>s-http.module.ts` (controller) → importar el http module en `AppModule`.
6. Códigos en `common/codes/error-codes.ts` bajo la clave de 3 letras (`R<COD>-E001` no encontrado, etc.) y mensajes de validación en `common/codes/validation-errors.ts` (nunca texto suelto en el schema).
7. Subject CASL nuevo en `modules/auth/casl/casl.types.ts` y reglas en `casl-ability.factory.ts` — y el MISMO subject en el front (`core/casl/casl.types.ts`).
8. Tests e2e: 400 con `issues`, 403 por rol, happy path.
9. Documentación (mismo cambio):
   - `bun run docs:errors`, y agregar filas a §4.2 y §5 de `docs/standard/error-catalog.md`.
   - Casos de §4.2 en `error-catalog.docs.spec.ts`.
   - `docs/data-dictionary/<entidad>.md` desde `_template.md` + fila en su README.
   - `@ApiZodResponse` de errores en cada endpoint, para que queden en Scalar.

Al final corre `/check`.

Si el front consume el recurso, crea el espejo del schema en `ticketkanban/src/app/pages/<pagina>/<recurso>.schema.ts`.
