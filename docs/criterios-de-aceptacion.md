# TERRAE — Criterios de aceptación

Cada criterio dice qué debe pasar para dar la función por buena. Formato: **Dado** (situación), **cuando** (acción), **entonces** (resultado esperado).

**Cómo leer el estado**
- ✅ Hecho y verificado por un test automático (se indica cuál).
- 🟡 Hecho, pero solo verificado a mano o por compilación; no tiene test automático propio.
- ⏳ Todavía no está hecho o depende de algo externo.

Los tests viven en `tests/`: `services/` (reglas de negocio), `isolation/` (permisos y aislamiento contra la base real con RLS) y `unit/` (funciones puras). Se corren con `npm test`.

---

## A. Cuentas y acceso (solo para inmobiliarias)

| ID | Criterio | Estado |
|---|---|---|
| A1 | **Dado** una persona que va a registrar su inmobiliaria o aceptar una invitación, **cuando** crea su cuenta con email y contraseña, **entonces** puede iniciar sesión y queda como usuaria sin inmobiliaria hasta completar el alta o aceptar la invitación. | 🟡 |
| A2 | **Dado** que Supabase exige confirmar el email, **cuando** la persona se registra, **entonces** se le avisa que revise su correo antes de ingresar. | 🟡 (depende de configurar el correo de Supabase, ver P3) |
| A3 | **Dado** una persona con sesión iniciada, **cuando** abre `/login`, **entonces** va directo a su panel. | 🟡 |
| A4 | **Dado** una persona sin sesión, **cuando** abre `/panel`, `/admin`, `/cuenta` o `/registro-agencia`, **entonces** la llevan a `/login` y, tras ingresar, vuelve a la página que pedía. | 🟡 |
| A5 | **Dado** que se intenta un redirect a otro sitio por el parámetro `next`, **cuando** se ingresa, **entonces** solo se aceptan rutas internas. | ✅ `tests/unit/lib.test.ts` |
| A6 | **Dado** una cuenta deshabilitada, **cuando** intenta operar como integrante, **entonces** no tiene permisos de inmobiliaria. | ✅ `isolation/h2-agencies` |
| A7 | **Dado** el menú de la cuenta, **cuando** se cambia de idioma, **entonces** el menú (Favoritos, Mi panel, avatar) no desaparece. | 🟡 |
| A8 | **Dado** cualquier usuaria, **cuando** abre el avatar, **entonces** ve su nombre, email y rol correctos y puede cerrar sesión. | ✅ `unit/role-label` (texto del rol); resto 🟡 |
| A9 | **Dado** una persona que busca propiedades, **cuando** busca, consulta, escribe por WhatsApp, denuncia o guarda favoritos, **entonces** no necesita cuenta. El único acceso del encabezado es "Acceso inmobiliarias". | 🟡 |
| A10 | **Dado** la pantalla de acceso, **cuando** se abre sin venir de "Registrar mi inmobiliaria" ni de una invitación, **entonces** solo permite ingresar (con un enlace para registrar la inmobiliaria); crear cuenta solo se ofrece en esos dos casos. | 🟡 (no impide que alguien cree una cuenta llamando directo a Supabase: esa cuenta no puede hacer nada hasta tener inmobiliaria) |

## B. Inmobiliarias y equipo

| ID | Criterio | Estado |
|---|---|---|
| B1 | **Dado** una usuaria sin inmobiliaria, **cuando** registra una (nombre, dirección web, su nombre público), **entonces** se crea en estado *pendiente* y ella queda como administradora. | ✅ `services/agency` |
| B2 | **Dado** una dirección web con mayúsculas, símbolos, más de 60 caracteres o reservada (`admin`, `panel`, `en`, `api`…), **cuando** se registra, **entonces** se rechaza. | ✅ `services/agency`, `unit/contracts` |
| B3 | **Dado** una dirección ya usada, **cuando** se registra, **entonces** se informa que está en uso. | ✅ `services/agency` |
| B4 | **Dado** una usuaria que ya integra una inmobiliaria, **cuando** intenta registrar otra, **entonces** se rechaza (una sola inmobiliaria activa por persona en v1). | ✅ `isolation/h2-agencies` |
| B5 | **Dado** una usuaria que ya registró 3 inmobiliarias en 24 horas, **cuando** intenta una cuarta, **entonces** se rechaza por exceso de intentos. | ✅ `isolation/h2-agencies` |
| B6 | **Dado** una inmobiliaria *pendiente*, **cuando** la administración de la plataforma la aprueba, **entonces** pasa a *aprobada*, se registra quién y cuándo, y se avisa por email a sus administradores. | ✅ `services/agency` (email: `unit/invitation-email`) |
| B7 | **Dado** una inmobiliaria *pendiente*, **cuando** se rechaza con motivo, **entonces** queda *rechazada*, sus integrantes quedan liberados y se les avisa con el motivo. | ✅ `services/agency` |
| B8 | **Dado** una inmobiliaria *aprobada*, **cuando** se suspende, **entonces** sus fichas dejan de verse en el sitio público, sus integrantes pierden permisos de escritura y se les avisa con el motivo. Al reactivarla, todo vuelve. | ✅ `isolation/h2-agencies`, `services/public` |
| B9 | **Dado** una transición no permitida (por ejemplo, aprobar una rechazada), **cuando** se intenta, **entonces** se rechaza. | ✅ `isolation/h2-agencies` |
| B10 | **Dado** una inmobiliaria *pendiente*, **cuando** su equipo intenta publicar fichas, **entonces** no puede (no está aprobada). | ✅ `isolation/h2-properties` |
| B11 | **Dado** la persona administradora, **cuando** edita nombre, logo, descripción, teléfono, email, web o dirección, **entonces** se guardan; **dado** un agente común, **entonces** no puede. | ✅ `services/agency` |
| B12 | **Dado** que nadie puede cambiar su propio estado de aprobación ni su rol de plataforma, **cuando** lo intenta por cualquier camino, **entonces** la base lo bloquea. | ✅ `isolation/rls`, `isolation/h2-agencies` |
| B13 | **Dado** un agente, **cuando** edita su perfil público (nombre, bio, foto, teléfono, WhatsApp, email público), **entonces** se guarda y se ve en sus fichas. | ✅ `services/agency` |

### Invitaciones

| ID | Criterio | Estado |
|---|---|---|
| B20 | **Dado** una administradora, **cuando** invita a un email con un rol, **entonces** se crea una invitación pendiente, se envía un email con un enlace personal y, si el envío falla, la pantalla muestra el enlace para copiar. | ✅ `services/agency`, `unit/invitation-email` |
| B21 | **Dado** una invitación, **cuando** se guarda, **entonces** solo se guarda un hash del token: el enlace no se puede recuperar después. | ✅ `services/agency` |
| B22 | **Dado** el enlace, **cuando** la persona lo abre con la sesión del email invitado, **entonces** se une a la inmobiliaria con el rol indicado y la invitación queda *aceptada*. | ✅ `services/agency`, `isolation/h2-agencies` |
| B23 | **Dado** el enlace, **cuando** lo abre con otro email, o está vencido (7 días), revocado o ya usado, **entonces** no se puede aceptar y el mensaje explica cuál es el motivo. | ✅ `isolation/h2-agencies` |
| B24 | **Dado** una invitación pendiente, **cuando** se reenvía, **entonces** la anterior se revoca y se crea una nueva con enlace nuevo. | 🟡 |
| B25 | **Dado** una administradora, **cuando** supera 30 invitaciones en 24 horas, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |
| B26 | **Dado** un agente (no administrador), **cuando** abre el menú, **entonces** no ve "Equipo"; si entra a la ruta, ve un aviso de que no tiene permiso. | 🟡 |
| B27 | **Dado** la administradora, **cuando** cambia el rol de alguien o lo quita, **entonces** la inmobiliaria nunca queda sin al menos un administrador activo. | ✅ `isolation/h2-agencies` |
| B28 | **Dado** un integrante con propiedades o consultas, **cuando** se lo quita, **entonces** se exige elegir a quién reasignarlas y todo pasa a esa persona. | ✅ `isolation/h2-agencies` |

## C. Propiedades

| ID | Criterio | Estado |
|---|---|---|
| C1 | **Dado** un integrante, **cuando** crea una propiedad, **entonces** nace como *borrador*, con su inmobiliaria asignada por el servidor (nunca por el formulario). | ✅ `services/property`, `isolation/h2-properties` |
| C2 | **Dado** el formulario, **cuando** el título tiene menos de 5 caracteres, la descripción menos de 20, el precio es 0 o negativo, la superficie es 0, o la superficie cubierta supera la total, **entonces** se rechaza con un mensaje claro. | ✅ `unit/contracts`, `isolation/h2-properties` |
| C3 | **Dado** un lote, **cuando** se carga, **entonces** pide frente, fondo, servicios, zonificación y esquina, y no pide ambientes ni baños. | ✅ `unit/property-form`, `services/property` |
| C4 | **Dado** una casa, departamento, PH, local, oficina o cochera, **cuando** se carga, **entonces** pide ambientes, dormitorios y baños. | ✅ `unit/property-form` |
| C5 | **Dado** una propiedad existente, **cuando** se intenta cambiar su tipo o su dirección web, **entonces** se rechaza; para otro tipo hay que crear una ficha nueva. | ✅ `isolation/h2-properties` |
| C6 | **Dado** el precio, **cuando** se elige USD o ARS, **entonces** se guarda con su moneda y nunca se convierte. | ✅ `services/property` |
| C7 | **Dado** un agente, **cuando** abre "Propiedades", **entonces** ve solo las suyas; **dado** una administradora, **entonces** ve todas las de su inmobiliaria. | ✅ `services/property`, `isolation/h2-properties` |
| C8 | **Dado** un agente, **cuando** intenta ver, editar o publicar una propiedad de otro agente o de otra inmobiliaria, **entonces** no la ve (aunque conozca el identificador). | ✅ `isolation/h2-properties`, `isolation/rls` |
| C9 | **Dado** el listado, **cuando** se filtra por estado u operación y se pagina, **entonces** muestra 20 por página con portada, precio y estado en color. | ✅ `services/property` (filtros); resto 🟡 |

### Estados y publicación

| ID | Criterio | Estado |
|---|---|---|
| C20 | **Dado** un borrador, **cuando** se publica, **entonces** exige al menos 3 fotos listas, una portada, zona activa e inmobiliaria aprobada; si falta algo, indica qué. | ✅ `isolation/h2-properties`, `unit/property-form` |
| C21 | **Dado** el ciclo de vida, **cuando** se cambia el estado, **entonces** solo valen estas transiciones: borrador→activa; activa→reservada, vendida/alquilada o pausada; reservada→activa, vendida/alquilada o pausada; vendida/alquilada→activa o pausada; pausada→activa. Cualquier otra se rechaza. | ✅ `isolation/h2-properties` |
| C22 | **Dado** una propiedad *reservada* o *vendida/alquilada*, **cuando** el público la ve, **entonces** aparece con un cartel que lo indica; **dado** una *borrador* o *pausada*, **entonces** no es visible. | ✅ `services/public` |
| C23 | **Dado** una propiedad activa, **cuando** se la quiere borrar, **entonces** no se permite: se pausa. Solo se borran borradores y pausadas, y solo si no tienen consultas. | ✅ `isolation/h2-properties`, `services/property` |
| C24 | **Dado** una propiedad ya publicada alguna vez, **cuando** se vuelve a activar, **entonces** conserva su fecha de primera publicación. | ✅ `isolation/h2-properties` |
| C25 | **Dado** un integrante, **cuando** supera 100 propiedades creadas en 24 horas, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |
| C26 | **Dado** una zona inactiva, **cuando** se elige para una propiedad, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |

## D. Fotos

| ID | Criterio | Estado |
|---|---|---|
| D1 | **Dado** una propiedad, **cuando** se sube una foto JPG, PNG o WebP de hasta 10 MB (HEIC también se acepta, pero no tiene test), **entonces** se procesa a tres tamaños (400, 800 y 1600 px) en WebP y sin metadatos (ni ubicación). | ✅ `services/photo`, `unit/storage` |
| D2 | **Dado** un archivo de otro formato, de más de 10 MB o que no es una imagen real, **cuando** se sube, **entonces** se rechaza y no queda nada a medias. | ✅ `services/photo` |
| D3 | **Dado** una propiedad, **cuando** se suben más de 30 fotos, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| D4 | **Dado** la primera foto lista, **cuando** se confirma, **entonces** queda como portada. Se puede elegir otra portada. | ✅ `services/photo` |
| D5 | **Dado** las fotos, **cuando** se reordenan, **entonces** el orden se guarda y se respeta en la ficha pública. | ✅ `services/photo` |
| D6 | **Dado** una ficha publicada, **cuando** se borra una foto que dejaría menos de 3 listas o sin portada, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| D7 | **Dado** una persona de otra inmobiliaria o un visitante, **cuando** intenta subir, ordenar o borrar fotos ajenas, **entonces** no puede; el visitante solo ve las fotos *listas* de fichas visibles. | ✅ `isolation/h2-zones-photos` |
| D8 | **Dado** una subida que nunca se confirmó, **cuando** pasan más de 24 horas, **entonces** el mantenimiento la borra (fila y archivos). | ✅ `services/maintenance` |
| D9 | **Dado** una agencia, **cuando** supera 200 fotos en una hora, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |
| D10 | **Dado** el texto alternativo de una foto, **cuando** se edita desde la interfaz, **entonces** se guarda. | ⏳ el servicio existe (`updateAltText`) pero la pantalla todavía no |
| D11 | **Dado** producción, **cuando** se sube una foto, **entonces** va directo a Cloudflare R2 con una URL firmada. | ⏳ depende de crear la cuenta de R2 (P1) |

## E. Zonas y barrios

| ID | Criterio | Estado |
|---|---|---|
| E1 | **Dado** la administración de la plataforma, **cuando** crea, edita o desactiva una zona (nombre en español, nombre en inglés, orden, zona padre), **entonces** se refleja en los filtros y las fichas. | ✅ `services/zone` |
| E2 | **Dado** una zona, **cuando** se la anida más de un nivel, o es su propio padre, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| E3 | **Dado** un archivo CSV de barrios, **cuando** se importa, **entonces** crea o actualiza las zonas y muestra un resumen de lo importado y los errores. | ✅ `services/zone` |
| E4 | **Dado** una zona con propiedades, **cuando** se intenta borrar, **entonces** se rechaza (se desactiva). | 🟡 la base lo impide por una relación entre tablas; falta un test propio |
| E5 | **Dado** un visitante o un agente, **cuando** intenta modificar zonas, **entonces** no puede; las zonas activas son de lectura pública. | ✅ `isolation/h2-zones-photos` |
| E6 | **Dado** el listado oficial de barrios de Tandil, **cuando** se carga, **entonces** el buscador lo usa. | ⏳ falta la lista oficial (P5) |

## F. Búsqueda y ficha pública

| ID | Criterio | Estado |
|---|---|---|
| F1 | **Dado** un visitante, **cuando** busca, **entonces** ve solo fichas *activas*, *reservadas* y *vendidas/alquiladas* de inmobiliarias aprobadas y no ocultas, de a 12 por página. | ✅ `services/public` |
| F2 | **Dado** el buscador, **cuando** se filtra por operación, tipo (uno o varios), zona (una o varias), ambientes mínimos, superficie mínima y máxima y precio, **entonces** el resultado respeta todos los filtros combinados. | ✅ `services/public` |
| F3 | **Dado** un filtro de precio, **cuando** se aplica, **entonces** compara solo dentro de una moneda (USD por defecto); sin filtro de precio se muestran ambas monedas. | ✅ `services/public` |
| F4 | **Dado** el orden, **cuando** se elige más recientes, precio ascendente o descendente, **entonces** se ordena así. | ✅ `services/public` |
| F5 | **Dado** una búsqueda, **cuando** se copia la dirección, **entonces** quien la abre ve el mismo resultado (los filtros viajan en la dirección). | 🟡 |
| F6 | **Dado** una ficha, **cuando** se abre, **entonces** muestra galería, datos (los de lote o los de edificación según el tipo), zona, agente y la inmobiliaria. | ✅ `services/public`, `unit/property-facts` |
| F7 | **Dado** una ficha sin "mostrar dirección exacta", **cuando** la ve el público, **entonces** no aparece la dirección. | ✅ `services/public` |
| F8 | **Dado** una dirección de ficha que no existe, está en borrador o está oculta, **cuando** se abre, **entonces** se muestra "no encontrada" y no se indexa. | 🟡 (responde HTTP 200 por el modo de renderizado; limitación documentada) |
| F9 | **Dado** el sitio, **cuando** lo recorren los buscadores, **entonces** hay `sitemap.xml` con todas las fichas en ambos idiomas, `robots.txt` y etiquetas de idioma alternativo. | 🟡 |
| F10 | **Dado** un teléfono celular, **cuando** se usa el sitio, **entonces** no hay desplazamiento horizontal y los formularios son usables. | 🟡 |

## G. Página de la inmobiliaria

| ID | Criterio | Estado |
|---|---|---|
| G1 | **Dado** una inmobiliaria aprobada, **cuando** se abre `/inmobiliarias/slug`, **entonces** muestra logo, descripción, contacto, sus agentes y sus propiedades visibles. | ✅ `services/agency`, `services/public` |
| G2 | **Dado** una inmobiliaria pendiente, rechazada o suspendida, **cuando** se abre su página, **entonces** no existe para el público. | ✅ `services/agency` |

## H. Consultas y WhatsApp

| ID | Criterio | Estado |
|---|---|---|
| H1 | **Dado** una ficha activa o reservada, **cuando** un visitante (con o sin cuenta) completa nombre, email, mensaje y acepta el consentimiento, **entonces** la consulta llega a la bandeja del agente responsable. | ✅ `services/inquiry` |
| H2 | **Dado** el formulario, **cuando** falta el consentimiento, el nombre tiene menos de 2 letras, el email es inválido o el mensaje tiene menos de 10 o más de 2000 caracteres, **entonces** se rechaza con un mensaje que lo explica. | ✅ `services/inquiry`, `unit/contracts` |
| H3 | **Dado** una consulta, **cuando** se guarda, **entonces** se registran el consentimiento con su fecha, el email en minúsculas y una huella (no la IP) para frenar abusos. | ✅ `services/inquiry` |
| H4 | **Dado** una consulta, **cuando** se crea, **entonces** el agente recibe un email con el mensaje y, al responder, la respuesta va al visitante. Si el email falla, la consulta queda igual en la bandeja. | ✅ `services/inquiry` (el envío real depende de Resend, P2) |
| H5 | **Dado** una IP, **cuando** envía más de 5 consultas en una hora, **entonces** se rechaza. | ✅ `services/inquiry` |
| H6 | **Dado** un robot que completa el campo oculto, **cuando** envía el formulario, **entonces** parece que funcionó pero no se guarda nada. | 🟡 |
| H7 | **Dado** una persona de la misma inmobiliaria dueña de la ficha, **cuando** abre la ficha, **entonces** no ve el formulario; si lo forzara, el servidor lo rechaza. | ✅ `services/inquiry` |
| H8 | **Dado** una ficha pausada, borrador, oculta o de inmobiliaria suspendida, **cuando** se intenta consultar, **entonces** se rechaza. | ✅ `services/inquiry`, `isolation/h6-abuse` |
| H9 | **Dado** un agente, **cuando** abre "Consultas", **entonces** ve solo las suyas; **dado** una administradora, **entonces** ve todas las de su inmobiliaria; nadie más ve ninguna. | ✅ `services/inquiry`, `isolation/rls` |
| H10 | **Dado** la bandeja, **cuando** se marca una consulta como leída, respondida, archivada o nueva, **entonces** el estado se guarda, y el menú muestra la cantidad de nuevas. | ✅ `services/inquiry` |
| H11 | **Dado** un agente con WhatsApp público, **cuando** se abre la ficha, **entonces** aparece un botón que abre `wa.me` con un mensaje ya escrito sobre esa propiedad; sin número, no aparece. | ✅ `unit/lib` (armado del enlace) |
| H12 | **Dado** una consulta, **cuando** pasan 24 meses, **entonces** se anonimizan nombre, email, teléfono y mensaje, y se conserva la fila. | ✅ `services/maintenance` |

## I. Favoritos (sin cuenta)

| ID | Criterio | Estado |
|---|---|---|
| I1 | **Dado** cualquier visitante, **cuando** toca "Guardar en favoritos" en una ficha, **entonces** se guarda en su navegador (sin cuenta) y el botón pasa a "Guardada en favoritos"; al tocarlo de nuevo se quita. | 🟡 |
| I2 | **Dado** un visitante con favoritos guardados, **cuando** abre `/favoritos` (o `/en/favoritos`), **entonces** ve las tarjetas de esas fichas, la más reciente primero. | 🟡 (las tarjetas se prueban en `services/public`) |
| I3 | **Dado** una ficha guardada que luego se pausa, vuelve a borrador, se oculta por moderación o es de una inmobiliaria suspendida, **cuando** se abre la lista, **entonces** ya no aparece. | ✅ `services/public`, `services/moderation` |
| I4 | **Dado** la lista de favoritos, **cuando** se piden las tarjetas, **entonces** el servidor solo recibe direcciones de fichas válidas (máximo 100), ignora el resto y no guarda ni asocia nada a la persona. | ✅ `services/public` |
| I5 | **Dado** dos personas, dispositivos o navegadores distintos, **cuando** una guarda favoritos, **entonces** la otra no los ve (viven en cada navegador). | 🟡 (por diseño) |

## J. Idiomas

| ID | Criterio | Estado |
|---|---|---|
| J1 | **Dado** el sitio público, **cuando** se abre sin prefijo, **entonces** está en español; con `/en`, en inglés. | ✅ `unit/i18n` |
| J2 | **Dado** la dirección `/es/...`, **cuando** se abre, **entonces** redirige a la dirección sin prefijo. | 🟡 |
| J3 | **Dado** el selector de idioma (bandera, a la derecha), **cuando** se cambia, **entonces** se mantiene la misma página en el otro idioma. | 🟡 |
| J4 | **Dado** un texto nuevo, **cuando** se agrega en español y no en inglés, **entonces** el proyecto no compila. | ✅ `unit/i18n` |
| J5 | **Dado** una zona con nombre en inglés, **cuando** se ve el sitio en inglés, **entonces** se usa; si no tiene, se usa el español. | ✅ `unit/i18n` |
| J6 | **Dado** el panel, la administración y el ingreso, **entonces** están solo en español (decisión de v1). | 🟡 |

## K. Moderación y denuncias

| ID | Criterio | Estado |
|---|---|---|
| K1 | **Dado** cualquier visitante, **cuando** denuncia una ficha visible con un motivo (falsa, duplicada, datos incorrectos, inapropiada, ya no disponible, otro), detalle y email opcionales, **entonces** la denuncia queda abierta. | ✅ `services/moderation` |
| K2 | **Dado** una persona que ya tiene una denuncia abierta sobre esa ficha, **cuando** denuncia de nuevo, **entonces** se toma como recibida sin duplicar. | ✅ `services/moderation` |
| K3 | **Dado** una IP o cuenta, **cuando** hace más de 5 denuncias en una hora, **entonces** se rechaza (lo aplica la base). | ✅ `services/moderation` |
| K4 | **Dado** una denuncia, **cuando** intenta escribirse ya resuelta, a nombre de otra cuenta o con una nota de resolución, **entonces** la base lo rechaza. | ✅ `isolation/h6-abuse` |
| K5 | **Dado** cualquier persona que no sea administración de la plataforma, **cuando** intenta leer, modificar o borrar denuncias, **entonces** no puede. | ✅ `isolation/h6-abuse` |
| K6 | **Dado** la administración, **cuando** abre "Denuncias", **entonces** ve las abiertas primero, con la ficha, la inmobiliaria, el motivo, el detalle y cuántas denuncias abiertas tiene esa ficha; el menú muestra el total abierto. | ✅ `services/moderation` (datos); pantalla 🟡 |
| K7 | **Dado** una denuncia abierta, **cuando** se descarta, **entonces** queda cerrada con su nota y la ficha no cambia. | ✅ `services/moderation` |
| K8 | **Dado** una denuncia abierta, **cuando** se oculta la ficha, **entonces** se exige un motivo, la ficha deja de verse en el sitio público, en las consultas y en los favoritos, y se cierran todas las denuncias abiertas de esa ficha. | ✅ `services/moderation` |
| K9 | **Dado** una ficha oculta, **cuando** la inmobiliaria la abre, **entonces** ve un aviso con el motivo; no puede borrarla, volver a mostrarla ni cambiar la moderación (ni pausando y reactivando). | ✅ `services/moderation`, `isolation/h6-abuse` |
| K10 | **Dado** una ficha oculta, **cuando** la administración la restituye, **entonces** vuelve al sitio público y se borra el motivo. | ✅ `services/moderation` |
| K11 | **Dado** que se oculta una ficha, **cuando** se confirma, **entonces** se avisa por email al agente responsable y a los administradores de su inmobiliaria con el motivo. | 🟡 (el envío real depende de Resend, P2) |
| K12 | **Dado** la administración, **cuando** busca en "Moderar propiedades" por título, dirección web o inmobiliaria, **entonces** puede ocultar o restituir cualquier ficha. | ✅ `services/moderation` |
| K13 | **Dado** cualquier acción de moderación, aprobación o suspensión, **cuando** ocurre, **entonces** queda en el registro de acciones con quién, qué, cuándo y el motivo, y solo la administración lo puede leer. | ✅ `services/moderation`, `isolation/h6-abuse` |

## L. Datos personales (Ley 25.326)

| ID | Criterio | Estado |
|---|---|---|
| L1 | **Dado** el pie de página, **cuando** se hace clic en "Privacidad", **entonces** se abre la política en español o inglés; el formulario de consulta enlaza a ella junto al consentimiento. | 🟡 |
| L2 | **Dado** una persona con sesión, **cuando** descarga sus datos, **entonces** recibe un archivo con su cuenta, consultas y denuncias, y nada de otras personas. | ✅ `services/account` |
| L3 | **Dado** una persona que no integra una inmobiliaria, **cuando** elimina su cuenta confirmando su email, **entonces** se anonimizan sus consultas y denuncias, se vacía su perfil y se borra su usuario de Supabase Auth. | ✅ `services/account` (el borrado en Supabase Auth se prueba al aplicarlo en producción) |
| L4 | **Dado** un integrante de una inmobiliaria o la administración de la plataforma, **cuando** intenta eliminar su cuenta, **entonces** se le explica qué hacer primero. | ✅ `services/account` |
| L5 | **Dado** la huella de IP, **cuando** pasan 30 días, **entonces** se borra; el email de quien denuncia se borra al año de resuelta la denuncia. | ✅ `services/maintenance` |
| L6 | **Dado** la política de privacidad, **cuando** se publica, **entonces** la revisó una persona del ámbito legal y muestra un email de contacto real. | ⏳ (P4) |

## M. Seguridad y aislamiento (transversales)

| ID | Criterio | Estado |
|---|---|---|
| M1 | **Dado** dos inmobiliarias A y B, **cuando** cualquier rol de A consulta o modifica datos de B (propiedades, fotos, consultas, integrantes, invitaciones), **entonces** la base lo impide, aunque la aplicación fallara. | ✅ `isolation/*` |
| M2 | **Dado** cualquier tabla del sistema, **cuando** se crea, **entonces** tiene RLS activado, sin privilegios para `PUBLIC`, `anon` ni `authenticated`; un test falla si se agrega una tabla sin protección. | ✅ `isolation/h6-abuse` |
| M3 | **Dado** las funciones internas de la base, **cuando** alguien intenta ejecutarlas sin ser el rol de la aplicación, **entonces** no puede. | ✅ `isolation/h2-agencies`, `isolation/h6-abuse` |
| M4 | **Dado** el contrato de la aplicación y las reglas de la base (estados, topes, tipos), **cuando** se desalinean, **entonces** un test falla. | ✅ `isolation/h2-contracts-vs-db` |
| M5 | **Dado** el navegador, **cuando** carga cualquier página, **entonces** recibe una política de contenido (CSP), HSTS, `X-Frame-Options`, `Permissions-Policy` y `nosniff`; los scripts solo pueden venir del propio sitio. | ✅ `unit/csp` (política); verificada con Chrome en producción |
| M6 | **Dado** el enlace de invitación, **cuando** se abre, **entonces** la dirección no se filtra a otros sitios (`Referrer-Policy: no-referrer`). | 🟡 |
| M7 | **Dado** un error del servidor, **cuando** ocurre, **entonces** queda una línea en los registros con la ruta (sin datos personales ni tokens). | ✅ `unit/log-error` |
| M8 | **Dado** la ruta de mantenimiento diario, **cuando** se llama sin la clave, con una incorrecta o sin la variable configurada, **entonces** no corre. | ✅ `unit/cron-route` |
| M9 | **Dado** el agente en el servidor, **cuando** se identifica a la persona, **entonces** siempre sale de la sesión, nunca de datos que mande el navegador. | ✅ `unit/actor`, `isolation/*` |

## N. Interfaz

| ID | Criterio | Estado |
|---|---|---|
| N1 | **Dado** la aplicación, **cuando** se abre, **entonces** se llama TERRAE en el encabezado, la pestaña y los emails. | ✅ |
| N2 | **Dado** el panel de inicio y el Resumen de administración, **cuando** se abren, **entonces** cada tarjeta lleva un ícono según su tema. | 🟡 |
| N3 | **Dado** el entorno de desarrollo, **cuando** se abre cualquier página, **entonces** hay un selector para alternar entre dos paletas de color (arcilla y salvia / tierra y turquesa) y se ve cuál está activa. | 🟡 (temporal, hasta elegir una) |
| N4 | **Dado** cualquier lista de opciones (desplegables), **cuando** se abre, **entonces** tiene fondo blanco, resalta la opción elegida y la que está bajo el cursor, y funciona con el teclado. | 🟡 |
| N5 | **Dado** cualquier campo enfocado, **cuando** se selecciona, **entonces** muestra un único borde del color de marca, sin doble borde. | 🟡 |
| N6 | **Dado** una página que carga datos, **cuando** tarda, **entonces** muestra un esqueleto de carga y no un espacio vacío. | 🟡 |

## O. Operación

| ID | Criterio | Estado |
|---|---|---|
| O1 | **Dado** el comando `npm run promote -- email --platform-admin`, **cuando** se corre con `--yes`, **entonces** esa cuenta pasa a ser administración de la plataforma; sin `--yes` solo simula. | 🟡 |
| O2 | **Dado** un cambio de código, **cuando** se prepara para guardar, **entonces** `npm test`, el chequeo de tipos, el lint y el build pasan. | ✅ (ver `npm test`) |
| O3 | **Dado** las migraciones, **cuando** se aplican a la base real, **entonces** solo se hace desde `main` y con autorización de la dueña del proyecto. | 🟡 (regla de trabajo) |
| O4 | **Dado** el mantenimiento diario, **cuando** corre, **entonces** deja constancia solo si cambió algo. | ✅ `services/maintenance` |

---

## Pendientes que condicionan el piloto

| ID | Pendiente | Quién |
|---|---|---|
| P1 | Cuenta de Cloudflare R2, driver de R2 y `NEXT_PUBLIC_MEDIA_BASE_URL`. | Valeria + desarrollo |
| P2 | Dominio verificado en Resend, `RESEND_API_KEY` y `EMAIL_FROM`, para enviar emails a cualquier persona. | Valeria |
| P3 | Supabase: confirmar email activado, SMTP propio y límites de ingreso revisados. | Valeria |
| P4 | Revisión legal de `/privacidad` y email de contacto (`NEXT_PUBLIC_CONTACT_EMAIL`). | Valeria |
| P5 | Lista oficial de barrios de Tandil y nombres en inglés. | Valeria |
| P6 | Aplicar las migraciones 0004 a 0006 a Supabase. | Con autorización de Valeria |
| P7 | Elegir una de las dos paletas y quitar el selector temporal. | Valeria |
| P8 | Dos o tres inmobiliarias piloto (H7). | Valeria |
