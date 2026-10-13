# SPEC — Portal inmobiliario de Tandil

## Objetivo
Portal donde varias inmobiliarias (cada una con sus agentes) publican propiedades y lotes en venta y alquiler en Tandil (Buenos Aires, Argentina). Los visitantes buscan y contactan. Proyecto personal, sin monetización por ahora.

## Alcance
- Ciudad: Tandil. Monedas: USD y ARS (pesos), campo `currency` por propiedad; sin conversión automática en v1. Los filtros de precio se aplican por moneda.
- Idiomas: español (por defecto) e inglés.
- Operaciones: venta, alquiler.
- Tipos: casa, departamento, PH, lote/terreno, local, oficina, cochera.
  Los lotes tienen campos propios (superficie total, frente, fondo, servicios, zonificación) y NO tienen ambientes/baños.

## Roles
| Rol | Puede |
|---|---|
| Visitante | Buscar, ver fichas, contactar; con cuenta: favoritos |
| Agente | Crear/editar SUS propiedades, ver SUS consultas |
| Admin de agencia | Gestionar agentes y todas las propiedades de su agencia |
| Admin de plataforma | Aprobar agencias, moderar, ver todo |

## Funcionalidades v1
1. Alta de agencia (con aprobación del admin de plataforma) y de sus agentes
2. Publicar/editar propiedad o lote con fotos
3. Búsqueda con filtros: operación, tipo, zona, precio USD, ambientes, superficie
4. Ficha de propiedad: galería, datos, agente
5. Formulario de contacto -> email al agente + bandeja en su panel
6. Cuentas de visitante y favoritos
7. Panel de agencia: listado, estados, consultas
8. Página pública de agencia (logo, propiedades, agentes)

## Fuera de v1
Mapa avanzado, pagos, firma de contratos, tours virtuales, app móvil, multi-ciudad, conversión automática de moneda, chat en tiempo real, destacados pagos.

## Decisiones clave
- Multi-tenant desde el día uno: toda propiedad pertenece a una agencia; aislamiento por agencia.
- Zonas/barrios como TABLA de datos editable (no hardcodeada). Se cargan desde la Municipalidad de Tandil y las agencias piloto.
- i18n desde el inicio (es/en); contenido de fichas en el idioma que cargue el agente.
- Estados de publicación: borrador, activa, reservada, vendida/alquilada, pausada. Reservada y vendida/alquilada se muestran en público con un cartel.
- Botón de WhatsApp en la ficha (enlace wa.me al número público del agente), además del formulario.
- Agentes: los da de alta el admin de agencia por invitación.
- Campos obligatorios para evitar fichas pobres (mín. fotos, precio, zona, tipo).

## Riesgos
- Huevo y gallina: conseguir 2-3 agencias piloto antes de lanzar.
- Calidad de datos/fotos.
- Datos personales de contactos: revisar Ley 25.326 (Argentina).

## Pendiente de definir
- Lista oficial de barrios/zonas de Tandil.
- Agencias piloto.
- Referencias de diseño/UI.
