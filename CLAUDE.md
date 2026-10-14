# Portal inmobiliario de Tandil

Alcance en SPEC.md; decisiones de arquitectura en ARCHITECTURE.md (incluye "Convenciones de servicios (H2)").

## Reglas generales
- Responder a la usuaria en español.
- Lo mínimo para la v1: no añadir funcionalidades fuera del SPEC.
- Tests para cada feature; commits pequeños, uno por feature.
- Nunca hardcodear zonas/barrios ni secretos; usar tablas y variables de entorno. Nunca imprimir URLs, contraseñas ni claves en diagnósticos.
- Construir de a una pieza por vez (orden H2: 2D Zonas → 2A Agencias → 2B Propiedades → 2C Fotos) para controlar el gasto. Sin agentes en paralelo con migraciones.

## Multi-tenant y seguridad
- Toda consulta a propiedades filtra por agencia según el rol; la defensa final es RLS en Postgres.
- Datos de negocio SIEMPRE vía `withActor(actor, tx => ...)` (rol `app_user`, sujeto a RLS). `getActor()` y los scripts usan el rol dueño (bypass RLS).
- Permisos en un solo lugar: `can(actor, action)` en `src/server/auth/policies.ts`.
- Condiciones SQL en triggers/policies: envolver en `coalesce(..., false)` (un NULL salta el `IF NOT (...)`).
- Toda tabla de `public` con RLS activado; EXECUTE revocado a PUBLIC/anon/authenticated en funciones.

## Servicios y contratos
- Servicios en `src/server/services/<pieza>/index.ts`: reciben el `Actor` primero y devuelven `ServiceResult<T>`; no lanzan por errores de negocio (usar `mapDbError`).
- Los servicios no importan `next/server` ni `getActor`: lo hacen páginas, Server Actions y route handlers (cada uno llama a `getActor()`, son endpoints públicos).
- Reglas de negocio finales las aplica la base (triggers); `src/contracts` las refleja para la UI. El test `h2-contracts-vs-db` detecta desalineaciones.

## Next.js
- Leer `node_modules/next/dist/docs/` antes de escribir código Next (ver AGENTS.md).
- `cacheComponents` activo: lo que depende de sesión va dentro de `<Suspense>`; datos de runtime con `await connection()`. No hay `middleware`: se usa `src/proxy.ts`.

## Base de datos y migraciones
- Drizzle: esquema en `src/server/db/schema.ts`, migraciones en `db/migrations`. Una migración a la vez.
- Aplicar a Supabase (`drizzle-kit migrate`) solo desde `main`, con autorización explícita de la usuaria, y verificar en la base real.
- Tests contra la DB local `portal_test` (Docker, puerto 5433); nunca contra Supabase.
- Promover usuarios: `npm run promote -- <email> --platform-admin [--yes]` (sin `--yes` solo simula).

## Comandos
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` deben pasar antes de cada commit.

@AGENTS.md
