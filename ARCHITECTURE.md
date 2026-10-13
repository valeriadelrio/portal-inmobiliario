# Arquitectura

## Stack (decidido)
- **Next.js (App Router) + React + TypeScript**, Node 22. Páginas públicas renderizadas en servidor (SEO). Monolito: una sola app, capa de servicio en `src/server/`.
- **Supabase**: Postgres + Auth (+ RLS). **Drizzle** como ORM, migraciones SQL versionadas.
- **Cloudflare R2** para fotos (subida con URL prefirmada, variantes WebP 400/800/1600).
- **Resend** para emails. **Zod** para contratos. **Vitest** + **Playwright**. GitHub Actions.
- **Hosting**: Vercel (gratis mientras no haya ingresos; revisar términos si se monetiza).
- **i18n**: rutas `/es` y `/en` (next-intl), diccionarios JSON, test de claves faltantes.

## Modelo de datos
agency, user_profile, agency_member (agent | agency_admin), zone (editable, name_es/name_en),
property (comunes + currency USD|ARS), property_building (ambientes, baños...), property_lot (frente, fondo, servicios, zonificación),
property_photo, inquiry (con consentimiento Ley 25.326), favorite, audit_log (mínimo).
Lotes y edificaciones en tablas hijas separadas. Enums como text + CHECK.

## Autorización / multi-tenant
- Middleware construye un `Actor {userId, platformRole, agencyId, memberRole}`.
- Todo acceso a datos pasa por `src/server/` y exige `Actor`; permisos centralizados en `policies.ts`.
- RLS en Postgres como red de seguridad (property, property_photo, inquiry, agency_member), rol no superusuario y `set_config` por transacción.
- Suite de tests de aislamiento (agencia A vs B x roles) obligatoria en CI.
- `agency_id` nunca viene del cliente.

## Búsqueda
Filtros SQL puros (operación, tipo, zona, precio+moneda, ambientes, superficie), query string compartible. Sin texto libre ni mapa en v1; lat/lng nullables preparados.

## Estructura
db/{migrations,seeds}, src/{contracts,server/{db,auth,services,email,storage},i18n,app,components}, tests/{unit,integration,e2e,isolation}.
`contracts/` es la frontera entre trabajos en paralelo.

## Hitos
H0 Fundaciones (contratos, schema, CI) -> H1 Auth/roles/aislamiento -> H2 agencias, propiedades, fotos, zonas (paralelo) -> H3 búsqueda y ficha (paralelo) -> H4 consultas+WhatsApp y favoritos -> H5 i18n y pulido -> H6 moderación y endurecimiento -> H7 piloto.
Cambios a `contracts/` o al schema van en un PR secuencial previo; el resto en worktrees paralelos.
