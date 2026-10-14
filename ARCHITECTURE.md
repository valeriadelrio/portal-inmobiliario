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

## Convenciones de servicios (H2)
- Servicios en `src/server/services/<pieza>/index.ts`: reciben el `Actor` primero y devuelven `ServiceResult<T>` (nunca lanzan por errores de negocio; usan `mapDbError`).
- Datos de negocio SIEMPRE vía `withActor(actor, tx => ...)` (rol `app_user`, sujeto a RLS). `getActor()` y los scripts usan el rol dueño.
- Los servicios no importan `next/server` ni `getActor`: lo hacen las páginas, Server Actions y route handlers (cada uno llama a `getActor()` por su cuenta, son endpoints públicos).
- Páginas que dependen de la sesión van dentro de `<Suspense>` (cacheComponents).
- Reglas de negocio finales las aplica la base (triggers); los contratos en `src/contracts` las reflejan para la UI. Un test (`h2-contracts-vs-db`) detecta si se desalinean.
- Migraciones: una a la vez, nunca desde ramas paralelas; se aplican a Supabase solo con `drizzle-kit migrate` desde `main` y con autorización.
- Promover usuarios (primer admin, miembros de prueba): `npm run promote -- <email> --platform-admin [--yes]`.
- Fotos (2C): subida en 3 pasos `requestPhotoUpload` (fila `pending` + URL) → el navegador sube el original → `confirmPhotoUpload` (valida con sharp, genera WebP 400/800/1600, quita metadatos, marca `ready`). Claves: `properties/<agencia>/<propiedad>/<foto>/<ancho>.webp`. Drivers de `Storage`: `memory` (tests), `local` (desarrollo, carpeta `.local-media/`, rutas `/api/dev-upload` y `/media`, deshabilitado en producción) y `r2` (pendiente: necesita cuenta de Cloudflare; con R2 el navegador sube directo con URL firmada).
- Pendiente de limpieza: subidas `pending` abandonadas (sin confirmar) quedan en la base y cuentan para el máximo de 30; se limpiarán con una tarea programada antes del piloto.
- Público (H3): `/`, `/propiedades` (buscador, filtros por query string), `/propiedades/[slug]` (ficha), `/inmobiliarias/[slug]`, `sitemap.xml`, `robots.txt`. Los servicios `services/public` leen como visitante anónimo (RLS decide qué es visible). Las lecturas se cachean en `src/server/cache/public.ts` (`"use cache"`, etiqueta `public-properties`, vida "minutes") y las Server Actions que cambian datos públicos llaman a `invalidatePublic()`.
- Precio en búsqueda: sin filtro de precio se muestran ambas monedas; con filtro (o con orden por precio) se compara solo dentro de una moneda (USD por defecto). Dirección exacta solo si `show_exact_address`.
- Limitación conocida: una ficha inexistente responde HTTP 200 (la página se transmite en streaming) con `noindex` y la pantalla de "no encontrada".
- Consultas y favoritos (H4): `services/inquiry` (`createInquiry` anónimo o con sesión, `listInquiries`, `setInquiryStatus`, `countNewInquiries`) y `services/favorite`. La consulta exige consentimiento (Ley 25.326), se guarda con el email en minúsculas y un hash de la IP (`IP_HASH_SALT`), con tope de 5 por hora por IP y un campo trampa anti-bots en el formulario. Solo el agente destinatario o el administrador de su inmobiliaria la lee (RLS). El email al agente (cuenta del agente, `Reply-To` = visitante) es de mejor esfuerzo: si falla, la consulta queda igual en `/panel/consultas`. Envío real con Resend vía `fetch` (`RESEND_API_KEY`, `EMAIL_FROM`); sin clave se imprime en consola. Favoritos solo con cuenta (`/cuenta/favoritos`); las partes de la ficha que dependen de la sesión (formulario precargado, botón de favorito) van en `<Suspense>` para no romper el cacheo de la ficha. No hubo migración: las tablas y políticas ya existían desde H0/H1.
- Pendiente (H4): verificar el dominio en Resend para enviar desde un remitente propio; avisos por email al visitante (no incluido en la v1).
- Invitaciones por email: `inviteAction` (Server Action) manda el enlace con `buildInvitationEmail` apenas se crea la invitación (el token crudo solo existe en ese momento). Si no hay `RESEND_API_KEY` o falla el envío, la pantalla muestra igual el enlace para copiar. Con el remitente de prueba de Resend (`onboarding@resend.dev`) solo se puede enviar al email dueño de la cuenta de Resend; para escribirle a otras personas hay que verificar un dominio.
