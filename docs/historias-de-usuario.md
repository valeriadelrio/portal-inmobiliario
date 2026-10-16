# TERRAE — Historias de usuario

Cada función de la aplicación se describe con historias de usuario (**Como** quién, **quiero** qué, **para** qué) y, debajo de cada una, sus criterios de aceptación en formato **Dado / cuando / entonces**.

Los criterios son los mismos de [criterios-de-aceptacion.md](criterios-de-aceptacion.md), con el mismo ID, reorganizados por historia. Si cambia un criterio, se cambia allí y este archivo se regenera.

**Estado:** ✅ verificado por un test automático (se indica cuál) · 🟡 hecho, sin test propio · ⏳ pendiente o depende de algo externo.

---

## Feature 1 — Cuentas y acceso

_Registrarse, ingresar y administrar la sesión._

### US-01 · Registrarme e ingresar

**Como** persona sin cuenta **quiero** registrarme con email y contraseña e ingresar al sitio **para** guardar favoritos, consultar o publicar.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| A1 | **Dado** una persona sin cuenta, **cuando** se registra con email y contraseña, **entonces** puede iniciar sesión y queda como usuaria sin inmobiliaria. | 🟡 |
| A2 | **Dado** que Supabase exige confirmar el email, **cuando** la persona se registra, **entonces** se le avisa que revise su correo antes de ingresar. | 🟡 (depende de configurar el correo de Supabase, ver P3) |
| A3 | **Dado** una persona con sesión iniciada, **cuando** abre `/login`, **entonces** va directo a su panel. | 🟡 |

### US-02 · Acceso protegido a las áreas privadas

**Como** persona con cuenta **quiero** que el panel, la administración y mi cuenta pidan ingresar y me devuelvan a donde iba **para** que nadie vea esas áreas sin autorización.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| A4 | **Dado** una persona sin sesión, **cuando** abre `/panel`, `/admin`, `/cuenta` o `/registro-agencia`, **entonces** la llevan a `/login` y, tras ingresar, vuelve a la página que pedía. | 🟡 |
| A5 | **Dado** que se intenta un redirect a otro sitio por el parámetro `next`, **cuando** se ingresa, **entonces** solo se aceptan rutas internas. | ✅ `tests/unit/lib.test.ts` |
| A6 | **Dado** una cuenta deshabilitada, **cuando** intenta operar como integrante, **entonces** no tiene permisos de inmobiliaria. | ✅ `isolation/h2-agencies` |

### US-03 · Menú de cuenta

**Como** persona con sesión iniciada **quiero** ver mi nombre, email y rol, y poder cerrar sesión **para** saber con qué cuenta estoy y salir con seguridad.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| A7 | **Dado** el menú de la cuenta, **cuando** se cambia de idioma, **entonces** el menú (Favoritos, Mi panel, avatar) no desaparece. | 🟡 |
| A8 | **Dado** cualquier usuaria, **cuando** abre el avatar, **entonces** ve su nombre, email y rol correctos y puede cerrar sesión. | ✅ `unit/role-label` (texto del rol); resto 🟡 |

---

## Feature 2 — Inmobiliarias

_Alta, aprobación y datos de cada inmobiliaria._

### US-04 · Registrar mi inmobiliaria

**Como** persona sin inmobiliaria **quiero** registrar mi inmobiliaria con nombre y dirección web **para** empezar a publicar propiedades una vez aprobada.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B1 | **Dado** una usuaria sin inmobiliaria, **cuando** registra una (nombre, dirección web, su nombre público), **entonces** se crea en estado *pendiente* y ella queda como administradora. | ✅ `services/agency` |
| B2 | **Dado** una dirección web con mayúsculas, símbolos, más de 60 caracteres o reservada (`admin`, `panel`, `en`, `api`…), **cuando** se registra, **entonces** se rechaza. | ✅ `services/agency`, `unit/contracts` |
| B3 | **Dado** una dirección ya usada, **cuando** se registra, **entonces** se informa que está en uso. | ✅ `services/agency` |
| B4 | **Dado** una usuaria que ya integra una inmobiliaria, **cuando** intenta registrar otra, **entonces** se rechaza (una sola inmobiliaria activa por persona en v1). | ✅ `isolation/h2-agencies` |
| B5 | **Dado** una usuaria que ya registró 3 inmobiliarias en 24 horas, **cuando** intenta una cuarta, **entonces** se rechaza por exceso de intentos. | ✅ `isolation/h2-agencies` |

### US-05 · Aprobar, rechazar y suspender inmobiliarias

**Como** administradora de la plataforma **quiero** decidir qué inmobiliarias pueden publicar y suspenderlas si hace falta **para** mantener la calidad y la confianza del portal.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B6 | **Dado** una inmobiliaria *pendiente*, **cuando** la administración de la plataforma la aprueba, **entonces** pasa a *aprobada*, se registra quién y cuándo, y se avisa por email a sus administradores. | ✅ `services/agency` (email: `unit/invitation-email`) |
| B7 | **Dado** una inmobiliaria *pendiente*, **cuando** se rechaza con motivo, **entonces** queda *rechazada*, sus integrantes quedan liberados y se les avisa con el motivo. | ✅ `services/agency` |
| B8 | **Dado** una inmobiliaria *aprobada*, **cuando** se suspende, **entonces** sus fichas dejan de verse en el sitio público, sus integrantes pierden permisos de escritura y se les avisa con el motivo. Al reactivarla, todo vuelve. | ✅ `isolation/h2-agencies`, `services/public` |
| B9 | **Dado** una transición no permitida (por ejemplo, aprobar una rechazada), **cuando** se intenta, **entonces** se rechaza. | ✅ `isolation/h2-agencies` |
| B10 | **Dado** una inmobiliaria *pendiente*, **cuando** su equipo intenta publicar fichas, **entonces** no puede (no está aprobada). | ✅ `isolation/h2-properties` |

### US-06 · Editar los datos de mi inmobiliaria

**Como** administradora de una inmobiliaria **quiero** editar nombre, logo, descripción y contacto **para** que el público vea información actual.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B11 | **Dado** la persona administradora, **cuando** edita nombre, logo, descripción, teléfono, email, web o dirección, **entonces** se guardan; **dado** un agente común, **entonces** no puede. | ✅ `services/agency` |
| B12 | **Dado** que nadie puede cambiar su propio estado de aprobación ni su rol de plataforma, **cuando** lo intenta por cualquier camino, **entonces** la base lo bloquea. | ✅ `isolation/rls`, `isolation/h2-agencies` |

### US-07 · Mi perfil público de agente

**Como** agente **quiero** editar mi nombre, bio, foto, teléfono y WhatsApp **para** que los interesados me conozcan y me contacten.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B13 | **Dado** un agente, **cuando** edita su perfil público (nombre, bio, foto, teléfono, WhatsApp, email público), **entonces** se guarda y se ve en sus fichas. | ✅ `services/agency` |

---

## Feature 3 — Equipo e invitaciones

_Sumar y ordenar a las personas de cada inmobiliaria._

### US-08 · Invitar a mi equipo

**Como** administradora de una inmobiliaria **quiero** invitar por email a agentes u otros administradores **para** armar el equipo sin compartir contraseñas.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B20 | **Dado** una administradora, **cuando** invita a un email con un rol, **entonces** se crea una invitación pendiente, se envía un email con un enlace personal y, si el envío falla, la pantalla muestra el enlace para copiar. | ✅ `services/agency`, `unit/invitation-email` |
| B21 | **Dado** una invitación, **cuando** se guarda, **entonces** solo se guarda un hash del token: el enlace no se puede recuperar después. | ✅ `services/agency` |
| B24 | **Dado** una invitación pendiente, **cuando** se reenvía, **entonces** la anterior se revoca y se crea una nueva con enlace nuevo. | 🟡 |
| B25 | **Dado** una administradora, **cuando** supera 30 invitaciones en 24 horas, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |

### US-09 · Aceptar una invitación

**Como** persona invitada **quiero** unirme a la inmobiliaria desde el enlace que recibí **para** empezar a trabajar con mi rol.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B22 | **Dado** el enlace, **cuando** la persona lo abre con la sesión del email invitado, **entonces** se une a la inmobiliaria con el rol indicado y la invitación queda *aceptada*. | ✅ `services/agency`, `isolation/h2-agencies` |
| B23 | **Dado** el enlace, **cuando** lo abre con otro email, o está vencido (7 días), revocado o ya usado, **entonces** no se puede aceptar y el mensaje explica cuál es el motivo. | ✅ `isolation/h2-agencies` |

### US-10 · Gestionar los roles del equipo

**Como** administradora de una inmobiliaria **quiero** cambiar roles o quitar integrantes, reasignando su trabajo **para** que la inmobiliaria siga operando sin huecos.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| B26 | **Dado** un agente (no administrador), **cuando** abre el menú, **entonces** no ve "Equipo"; si entra a la ruta, ve un aviso de que no tiene permiso. | 🟡 |
| B27 | **Dado** la administradora, **cuando** cambia el rol de alguien o lo quita, **entonces** la inmobiliaria nunca queda sin al menos un administrador activo. | ✅ `isolation/h2-agencies` |
| B28 | **Dado** un integrante con propiedades o consultas, **cuando** se lo quita, **entonces** se exige elegir a quién reasignarlas y todo pasa a esa persona. | ✅ `isolation/h2-agencies` |

---

## Feature 4 — Propiedades

_Carga, listado, publicación y ciclo de vida de las fichas._

### US-11 · Cargar una propiedad

**Como** agente **quiero** cargar una propiedad con los datos que corresponden a su tipo **para** tenerla lista para publicar.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| C1 | **Dado** un integrante, **cuando** crea una propiedad, **entonces** nace como *borrador*, con su inmobiliaria asignada por el servidor (nunca por el formulario). | ✅ `services/property`, `isolation/h2-properties` |
| C2 | **Dado** el formulario, **cuando** el título tiene menos de 5 caracteres, la descripción menos de 20, el precio es 0 o negativo, la superficie es 0, o la superficie cubierta supera la total, **entonces** se rechaza con un mensaje claro. | ✅ `unit/contracts`, `isolation/h2-properties` |
| C3 | **Dado** un lote, **cuando** se carga, **entonces** pide frente, fondo, servicios, zonificación y esquina, y no pide ambientes ni baños. | ✅ `unit/property-form`, `services/property` |
| C4 | **Dado** una casa, departamento, PH, local, oficina o cochera, **cuando** se carga, **entonces** pide ambientes, dormitorios y baños. | ✅ `unit/property-form` |
| C5 | **Dado** una propiedad existente, **cuando** se intenta cambiar su tipo o su dirección web, **entonces** se rechaza; para otro tipo hay que crear una ficha nueva. | ✅ `isolation/h2-properties` |
| C6 | **Dado** el precio, **cuando** se elige USD o ARS, **entonces** se guarda con su moneda y nunca se convierte. | ✅ `services/property` |

### US-12 · Ver y gestionar mis propiedades

**Como** agente o administradora **quiero** ver, filtrar y abrir las propiedades que me corresponden **para** trabajar solo con lo mío y no ver lo de otras inmobiliarias.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| C7 | **Dado** un agente, **cuando** abre "Propiedades", **entonces** ve solo las suyas; **dado** una administradora, **entonces** ve todas las de su inmobiliaria. | ✅ `services/property`, `isolation/h2-properties` |
| C8 | **Dado** un agente, **cuando** intenta ver, editar o publicar una propiedad de otro agente o de otra inmobiliaria, **entonces** no la ve (aunque conozca el identificador). | ✅ `isolation/h2-properties`, `isolation/rls` |
| C9 | **Dado** el listado, **cuando** se filtra por estado u operación y se pagina, **entonces** muestra 20 por página con portada, precio y estado en color. | ✅ `services/property` (filtros); resto 🟡 |
| C25 | **Dado** un integrante, **cuando** supera 100 propiedades creadas en 24 horas, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |

### US-13 · Publicar una propiedad

**Como** agente **quiero** publicar una ficha cuando está completa **para** que el público la encuentre.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| C20 | **Dado** un borrador, **cuando** se publica, **entonces** exige al menos 3 fotos listas, una portada, zona activa e inmobiliaria aprobada; si falta algo, indica qué. | ✅ `isolation/h2-properties`, `unit/property-form` |
| C26 | **Dado** una zona inactiva, **cuando** se elige para una propiedad, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |

### US-14 · Cambiar el estado de una propiedad

**Como** agente **quiero** reservar, marcar vendida o alquilada, pausar o reactivar una ficha **para** reflejar la situación real del inmueble.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| C21 | **Dado** el ciclo de vida, **cuando** se cambia el estado, **entonces** solo valen estas transiciones: borrador→activa; activa→reservada, vendida/alquilada o pausada; reservada→activa, vendida/alquilada o pausada; vendida/alquilada→activa o pausada; pausada→activa. Cualquier otra se rechaza. | ✅ `isolation/h2-properties` |
| C22 | **Dado** una propiedad *reservada* o *vendida/alquilada*, **cuando** el público la ve, **entonces** aparece con un cartel que lo indica; **dado** una *borrador* o *pausada*, **entonces** no es visible. | ✅ `services/public` |
| C23 | **Dado** una propiedad activa, **cuando** se la quiere borrar, **entonces** no se permite: se pausa. Solo se borran borradores y pausadas, y solo si no tienen consultas. | ✅ `isolation/h2-properties`, `services/property` |
| C24 | **Dado** una propiedad ya publicada alguna vez, **cuando** se vuelve a activar, **entonces** conserva su fecha de primera publicación. | ✅ `isolation/h2-properties` |

---

## Feature 5 — Fotos

_Subida, procesamiento y orden de las imágenes._

### US-15 · Subir fotos

**Como** agente **quiero** subir fotos de la propiedad desde mi computadora o celular **para** mostrar bien el inmueble.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| D1 | **Dado** una propiedad, **cuando** se sube una foto JPG, PNG o WebP de hasta 10 MB (HEIC también se acepta, pero no tiene test), **entonces** se procesa a tres tamaños (400, 800 y 1600 px) en WebP y sin metadatos (ni ubicación). | ✅ `services/photo`, `unit/storage` |
| D2 | **Dado** un archivo de otro formato, de más de 10 MB o que no es una imagen real, **cuando** se sube, **entonces** se rechaza y no queda nada a medias. | ✅ `services/photo` |
| D3 | **Dado** una propiedad, **cuando** se suben más de 30 fotos, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| D9 | **Dado** una agencia, **cuando** supera 200 fotos en una hora, **entonces** se rechaza por exceso de uso. | ✅ `isolation/h6-limits` |
| D11 | **Dado** producción, **cuando** se sube una foto, **entonces** va directo a Cloudflare R2 con una URL firmada. | ⏳ depende de crear la cuenta de R2 (P1) |

### US-16 · Elegir portada, ordenar y borrar fotos

**Como** agente **quiero** definir la portada, el orden y quitar fotos **para** controlar cómo se ve la ficha.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| D4 | **Dado** la primera foto lista, **cuando** se confirma, **entonces** queda como portada. Se puede elegir otra portada. | ✅ `services/photo` |
| D5 | **Dado** las fotos, **cuando** se reordenan, **entonces** el orden se guarda y se respeta en la ficha pública. | ✅ `services/photo` |
| D6 | **Dado** una ficha publicada, **cuando** se borra una foto que dejaría menos de 3 listas o sin portada, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| D7 | **Dado** una persona de otra inmobiliaria o un visitante, **cuando** intenta subir, ordenar o borrar fotos ajenas, **entonces** no puede; el visitante solo ve las fotos *listas* de fichas visibles. | ✅ `isolation/h2-zones-photos` |

### US-17 · Texto alternativo de las fotos

**Como** agente **quiero** describir cada foto **para** mejorar la accesibilidad y el posicionamiento.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| D10 | **Dado** el texto alternativo de una foto, **cuando** se edita desde la interfaz, **entonces** se guarda. | ⏳ el servicio existe (`updateAltText`) pero la pantalla todavía no |

### US-18 · Limpieza de subidas abandonadas

**Como** operadora de la plataforma **quiero** que las subidas que nunca se confirmaron se borren solas **para** no acumular archivos inútiles.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| D8 | **Dado** una subida que nunca se confirmó, **cuando** pasan más de 24 horas, **entonces** el mantenimiento la borra (fila y archivos). | ✅ `services/maintenance` |

---

## Feature 6 — Zonas y barrios

_Catálogo de zonas que usan los filtros y las fichas._

### US-19 · Administrar zonas

**Como** administradora de la plataforma **quiero** crear, editar y desactivar zonas con nombre en español e inglés **para** que los filtros y las fichas usen barrios correctos.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| E1 | **Dado** la administración de la plataforma, **cuando** crea, edita o desactiva una zona (nombre en español, nombre en inglés, orden, zona padre), **entonces** se refleja en los filtros y las fichas. | ✅ `services/zone` |
| E2 | **Dado** una zona, **cuando** se la anida más de un nivel, o es su propio padre, **entonces** se rechaza. | ✅ `isolation/h2-zones-photos` |
| E4 | **Dado** una zona con propiedades, **cuando** se intenta borrar, **entonces** se rechaza (se desactiva). | 🟡 la base lo impide por una relación entre tablas; falta un test propio |
| E5 | **Dado** un visitante o un agente, **cuando** intenta modificar zonas, **entonces** no puede; las zonas activas son de lectura pública. | ✅ `isolation/h2-zones-photos` |

### US-20 · Importar el listado de barrios

**Como** administradora de la plataforma **quiero** importar barrios desde un archivo CSV **para** cargar el listado oficial de Tandil de una vez.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| E3 | **Dado** un archivo CSV de barrios, **cuando** se importa, **entonces** crea o actualiza las zonas y muestra un resumen de lo importado y los errores. | ✅ `services/zone` |
| E6 | **Dado** el listado oficial de barrios de Tandil, **cuando** se carga, **entonces** el buscador lo usa. | ⏳ falta la lista oficial (P5) |

---

## Feature 7 — Búsqueda y ficha pública

_Cómo el público encuentra y mira las propiedades._

### US-21 · Buscar propiedades

**Como** visitante **quiero** filtrar y ordenar propiedades por operación, tipo, zona, ambientes, superficie y precio **para** encontrar lo que se ajusta a lo que busco.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| F1 | **Dado** un visitante, **cuando** busca, **entonces** ve solo fichas *activas*, *reservadas* y *vendidas/alquiladas* de inmobiliarias aprobadas y no ocultas, de a 12 por página. | ✅ `services/public` |
| F2 | **Dado** el buscador, **cuando** se filtra por operación, tipo (uno o varios), zona (una o varias), ambientes mínimos, superficie mínima y máxima y precio, **entonces** el resultado respeta todos los filtros combinados. | ✅ `services/public` |
| F3 | **Dado** un filtro de precio, **cuando** se aplica, **entonces** compara solo dentro de una moneda (USD por defecto); sin filtro de precio se muestran ambas monedas. | ✅ `services/public` |
| F4 | **Dado** el orden, **cuando** se elige más recientes, precio ascendente o descendente, **entonces** se ordena así. | ✅ `services/public` |
| F5 | **Dado** una búsqueda, **cuando** se copia la dirección, **entonces** quien la abre ve el mismo resultado (los filtros viajan en la dirección). | 🟡 |

### US-22 · Ver la ficha de una propiedad

**Como** visitante **quiero** ver galería, datos, zona, agente e inmobiliaria **para** decidir si me interesa.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| F6 | **Dado** una ficha, **cuando** se abre, **entonces** muestra galería, datos (los de lote o los de edificación según el tipo), zona, agente y la inmobiliaria. | ✅ `services/public`, `unit/property-facts` |
| F7 | **Dado** una ficha sin "mostrar dirección exacta", **cuando** la ve el público, **entonces** no aparece la dirección. | ✅ `services/public` |
| F8 | **Dado** una dirección de ficha que no existe, está en borrador o está oculta, **cuando** se abre, **entonces** se muestra "no encontrada" y no se indexa. | 🟡 (responde HTTP 200 por el modo de renderizado; limitación documentada) |

### US-23 · Que el sitio se encuentre y se use en el celular

**Como** visitante **quiero** llegar desde un buscador y navegar cómodo desde el teléfono **para** consultar propiedades desde cualquier lugar.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| F9 | **Dado** el sitio, **cuando** lo recorren los buscadores, **entonces** hay `sitemap.xml` con todas las fichas en ambos idiomas, `robots.txt` y etiquetas de idioma alternativo. | 🟡 |
| F10 | **Dado** un teléfono celular, **cuando** se usa el sitio, **entonces** no hay desplazamiento horizontal y los formularios son usables. | 🟡 |

### US-24 · Página de la inmobiliaria

**Como** visitante **quiero** ver el perfil de una inmobiliaria con sus agentes y propiedades **para** conocer a quien publica.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| G1 | **Dado** una inmobiliaria aprobada, **cuando** se abre `/inmobiliarias/slug`, **entonces** muestra logo, descripción, contacto, sus agentes y sus propiedades visibles. | ✅ `services/agency`, `services/public` |
| G2 | **Dado** una inmobiliaria pendiente, rechazada o suspendida, **cuando** se abre su página, **entonces** no existe para el público. | ✅ `services/agency` |

---

## Feature 8 — Consultas y WhatsApp

_Contacto entre interesados y agentes._

### US-25 · Enviar una consulta

**Como** visitante **quiero** enviar una consulta sobre una propiedad, con o sin cuenta **para** que el agente me responda.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| H1 | **Dado** una ficha activa o reservada, **cuando** un visitante (con o sin cuenta) completa nombre, email, mensaje y acepta el consentimiento, **entonces** la consulta llega a la bandeja del agente responsable. | ✅ `services/inquiry` |
| H2 | **Dado** el formulario, **cuando** falta el consentimiento, el nombre tiene menos de 2 letras, el email es inválido o el mensaje tiene menos de 10 o más de 2000 caracteres, **entonces** se rechaza con un mensaje que lo explica. | ✅ `services/inquiry`, `unit/contracts` |
| H3 | **Dado** una consulta, **cuando** se guarda, **entonces** se registran el consentimiento con su fecha, el email en minúsculas y una huella (no la IP) para frenar abusos. | ✅ `services/inquiry` |
| H7 | **Dado** una persona de la misma inmobiliaria dueña de la ficha, **cuando** abre la ficha, **entonces** no ve el formulario; si lo forzara, el servidor lo rechaza. | ✅ `services/inquiry` |
| H8 | **Dado** una ficha pausada, borrador, oculta o de inmobiliaria suspendida, **cuando** se intenta consultar, **entonces** se rechaza. | ✅ `services/inquiry`, `isolation/h6-abuse` |

### US-26 · Protección contra abuso en las consultas

**Como** plataforma **quiero** frenar envíos masivos y robots **para** que los agentes no reciban basura.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| H5 | **Dado** una IP, **cuando** envía más de 5 consultas en una hora, **entonces** se rechaza. | ✅ `services/inquiry` |
| H6 | **Dado** un robot que completa el campo oculto, **cuando** envía el formulario, **entonces** parece que funcionó pero no se guarda nada. | 🟡 |

### US-27 · Recibir y gestionar consultas

**Como** agente o administradora **quiero** recibir un email y ordenar las consultas en una bandeja **para** responder a tiempo sin perder ninguna.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| H4 | **Dado** una consulta, **cuando** se crea, **entonces** el agente recibe un email con el mensaje y, al responder, la respuesta va al visitante. Si el email falla, la consulta queda igual en la bandeja. | ✅ `services/inquiry` (el envío real depende de Resend, P2) |
| H9 | **Dado** un agente, **cuando** abre "Consultas", **entonces** ve solo las suyas; **dado** una administradora, **entonces** ve todas las de su inmobiliaria; nadie más ve ninguna. | ✅ `services/inquiry`, `isolation/rls` |
| H10 | **Dado** la bandeja, **cuando** se marca una consulta como leída, respondida, archivada o nueva, **entonces** el estado se guarda, y el menú muestra la cantidad de nuevas. | ✅ `services/inquiry` |

### US-28 · Contactar por WhatsApp

**Como** visitante **quiero** abrir un chat de WhatsApp con un mensaje ya escrito sobre la propiedad **para** hablar con el agente de forma directa.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| H11 | **Dado** un agente con WhatsApp público, **cuando** se abre la ficha, **entonces** aparece un botón que abre `wa.me` con un mensaje ya escrito sobre esa propiedad; sin número, no aparece. | ✅ `unit/lib` (armado del enlace) |

---

## Feature 9 — Favoritos

_Guardar propiedades para ver después._

### US-29 · Guardar propiedades favoritas

**Como** persona con cuenta **quiero** guardar y quitar fichas de mis favoritos **para** volver a verlas sin buscarlas de nuevo.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| I1 | **Dado** una persona sin sesión, **cuando** mira una ficha, **entonces** el botón de favoritos la lleva a ingresar y vuelve a la misma ficha. | 🟡 |
| I2 | **Dado** una persona con sesión, **cuando** guarda o quita una ficha, **entonces** el cambio se refleja en `/cuenta/favoritos`. | ✅ `services/inquiry` (favoritos) |
| I3 | **Dado** una ficha guardada que luego se pausa u oculta, **cuando** se abre la lista, **entonces** ya no aparece. | ✅ `services/inquiry`, `services/moderation` |
| I4 | **Dado** dos personas, **cuando** una guarda favoritos, **entonces** la otra no los ve. | ✅ `isolation/rls` |

---

## Feature 10 — Idiomas

_Sitio público en español e inglés._

### US-30 · Usar el sitio en español o inglés

**Como** visitante **quiero** ver el sitio público en mi idioma y cambiarlo sin perder la página **para** entender las fichas aunque no hable español.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| J1 | **Dado** el sitio público, **cuando** se abre sin prefijo, **entonces** está en español; con `/en`, en inglés. | ✅ `unit/i18n` |
| J2 | **Dado** la dirección `/es/...`, **cuando** se abre, **entonces** redirige a la dirección sin prefijo. | 🟡 |
| J3 | **Dado** el selector de idioma (bandera, a la derecha), **cuando** se cambia, **entonces** se mantiene la misma página en el otro idioma. | 🟡 |
| J5 | **Dado** una zona con nombre en inglés, **cuando** se ve el sitio en inglés, **entonces** se usa; si no tiene, se usa el español. | ✅ `unit/i18n` |

### US-31 · Mantener las traducciones al día

**Como** equipo de desarrollo **quiero** que falte una traducción sea un error de compilación **para** no publicar textos sin traducir.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| J4 | **Dado** un texto nuevo, **cuando** se agrega en español y no en inglés, **entonces** el proyecto no compila. | ✅ `unit/i18n` |
| J6 | **Dado** el panel, la administración y el ingreso, **entonces** están solo en español (decisión de v1). | 🟡 |

---

## Feature 11 — Moderación y denuncias

_Control de calidad del contenido por parte de la plataforma._

### US-32 · Denunciar una ficha

**Como** visitante **quiero** denunciar una ficha falsa, duplicada o incorrecta **para** que la plataforma la revise.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| K1 | **Dado** cualquier visitante, **cuando** denuncia una ficha visible con un motivo (falsa, duplicada, datos incorrectos, inapropiada, ya no disponible, otro), detalle y email opcionales, **entonces** la denuncia queda abierta. | ✅ `services/moderation` |
| K2 | **Dado** una persona que ya tiene una denuncia abierta sobre esa ficha, **cuando** denuncia de nuevo, **entonces** se toma como recibida sin duplicar. | ✅ `services/moderation` |
| K3 | **Dado** una IP o cuenta, **cuando** hace más de 5 denuncias en una hora, **entonces** se rechaza (lo aplica la base). | ✅ `services/moderation` |
| K4 | **Dado** una denuncia, **cuando** intenta escribirse ya resuelta, a nombre de otra cuenta o con una nota de resolución, **entonces** la base lo rechaza. | ✅ `isolation/h6-abuse` |

### US-33 · Revisar denuncias

**Como** administradora de la plataforma **quiero** ver las denuncias abiertas con su contexto y descartarlas si no corresponden **para** atender primero lo más urgente.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| K5 | **Dado** cualquier persona que no sea administración de la plataforma, **cuando** intenta leer, modificar o borrar denuncias, **entonces** no puede. | ✅ `isolation/h6-abuse` |
| K6 | **Dado** la administración, **cuando** abre "Denuncias", **entonces** ve las abiertas primero, con la ficha, la inmobiliaria, el motivo, el detalle y cuántas denuncias abiertas tiene esa ficha; el menú muestra el total abierto. | ✅ `services/moderation` (datos); pantalla 🟡 |
| K7 | **Dado** una denuncia abierta, **cuando** se descarta, **entonces** queda cerrada con su nota y la ficha no cambia. | ✅ `services/moderation` |

### US-34 · Ocultar y restituir fichas

**Como** administradora de la plataforma **quiero** ocultar una ficha con un motivo y restituirla si corresponde **para** sacar contenido dañino sin borrarlo.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| K8 | **Dado** una denuncia abierta, **cuando** se oculta la ficha, **entonces** se exige un motivo, la ficha deja de verse en el sitio público, en las consultas y en los favoritos, y se cierran todas las denuncias abiertas de esa ficha. | ✅ `services/moderation` |
| K10 | **Dado** una ficha oculta, **cuando** la administración la restituye, **entonces** vuelve al sitio público y se borra el motivo. | ✅ `services/moderation` |
| K12 | **Dado** la administración, **cuando** busca en "Moderar propiedades" por título, dirección web o inmobiliaria, **entonces** puede ocultar o restituir cualquier ficha. | ✅ `services/moderation` |

### US-35 · Enterarme de que ocultaron mi ficha

**Como** agente o administradora de una inmobiliaria **quiero** recibir un aviso con el motivo y ver el estado en la ficha **para** entender qué pasó y corregirlo.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| K9 | **Dado** una ficha oculta, **cuando** la inmobiliaria la abre, **entonces** ve un aviso con el motivo; no puede borrarla, volver a mostrarla ni cambiar la moderación (ni pausando y reactivando). | ✅ `services/moderation`, `isolation/h6-abuse` |
| K11 | **Dado** que se oculta una ficha, **cuando** se confirma, **entonces** se avisa por email al agente responsable y a los administradores de su inmobiliaria con el motivo. | 🟡 (el envío real depende de Resend, P2) |

### US-36 · Registro de acciones de moderación

**Como** administradora de la plataforma **quiero** que quede constancia de quién hizo qué y cuándo **para** tener trazabilidad ante cualquier reclamo.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| K13 | **Dado** cualquier acción de moderación, aprobación o suspensión, **cuando** ocurre, **entonces** queda en el registro de acciones con quién, qué, cuándo y el motivo, y solo la administración lo puede leer. | ✅ `services/moderation`, `isolation/h6-abuse` |

---

## Feature 12 — Datos personales (Ley 25.326)

_Privacidad y derechos sobre los datos._

### US-37 · Conocer la política de privacidad

**Como** visitante **quiero** leer cómo se usan mis datos antes de enviarlos **para** dar mi consentimiento informado.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| L1 | **Dado** el pie de página, **cuando** se hace clic en "Privacidad", **entonces** se abre la política en español o inglés; el formulario de consulta enlaza a ella junto al consentimiento. | 🟡 |
| L6 | **Dado** la política de privacidad, **cuando** se publica, **entonces** la revisó una persona del ámbito legal y muestra un email de contacto real. | ⏳ (P4) |

### US-38 · Descargar mis datos

**Como** persona con cuenta **quiero** descargar un archivo con todo lo que el sitio guarda de mí **para** ejercer mi derecho de acceso.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| L2 | **Dado** una persona con sesión, **cuando** descarga sus datos, **entonces** recibe un archivo con su cuenta, favoritos, consultas y denuncias, y nada de otras personas. | ✅ `services/account` |

### US-39 · Eliminar mi cuenta

**Como** persona con cuenta **quiero** eliminar mi cuenta y mis datos **para** ejercer mi derecho de supresión.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| L3 | **Dado** una persona que no integra una inmobiliaria, **cuando** elimina su cuenta confirmando su email, **entonces** se borran sus favoritos, se anonimizan sus consultas y denuncias, se vacía su perfil y se borra su usuario de Supabase Auth. | ✅ `services/account` (el borrado en Supabase Auth se prueba al aplicarlo en producción) |
| L4 | **Dado** un integrante de una inmobiliaria o la administración de la plataforma, **cuando** intenta eliminar su cuenta, **entonces** se le explica qué hacer primero. | ✅ `services/account` |

### US-40 · Conservar solo lo necesario

**Como** plataforma **quiero** borrar o anonimizar datos personales cuando vence su plazo **para** cumplir con la minimización de datos.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| L5 | **Dado** la huella de IP, **cuando** pasan 30 días, **entonces** se borra; el email de quien denuncia se borra al año de resuelta la denuncia. | ✅ `services/maintenance` |
| H12 | **Dado** una consulta, **cuando** pasan 24 meses, **entonces** se anonimizan nombre, email, teléfono y mensaje, y se conserva la fila. | ✅ `services/maintenance` |

---

## Feature 13 — Seguridad y operación técnica

_Garantías transversales del sistema._

### US-41 · Aislamiento entre inmobiliarias

**Como** inmobiliaria **quiero** que nadie de otra inmobiliaria vea o modifique mis datos **para** confiar en la plataforma con mi negocio.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| M1 | **Dado** dos inmobiliarias A y B, **cuando** cualquier rol de A consulta o modifica datos de B (propiedades, fotos, consultas, integrantes, invitaciones), **entonces** la base lo impide, aunque la aplicación fallara. | ✅ `isolation/*` |
| M2 | **Dado** cualquier tabla del sistema, **cuando** se crea, **entonces** tiene RLS activado, sin privilegios para `PUBLIC`, `anon` ni `authenticated`; un test falla si se agrega una tabla sin protección. | ✅ `isolation/h6-abuse` |
| M3 | **Dado** las funciones internas de la base, **cuando** alguien intenta ejecutarlas sin ser el rol de la aplicación, **entonces** no puede. | ✅ `isolation/h2-agencies`, `isolation/h6-abuse` |
| M4 | **Dado** el contrato de la aplicación y las reglas de la base (estados, topes, tipos), **cuando** se desalinean, **entonces** un test falla. | ✅ `isolation/h2-contracts-vs-db` |
| M9 | **Dado** el agente en el servidor, **cuando** se identifica a la persona, **entonces** siempre sale de la sesión, nunca de datos que mande el navegador. | ✅ `unit/actor`, `isolation/*` |

### US-42 · Navegador protegido

**Como** visitante **quiero** que el sitio use las protecciones estándar del navegador **para** navegar con seguridad.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| M5 | **Dado** el navegador, **cuando** carga cualquier página, **entonces** recibe una política de contenido (CSP), HSTS, `X-Frame-Options`, `Permissions-Policy` y `nosniff`; los scripts solo pueden venir del propio sitio. | ✅ `unit/csp` (política); verificada con Chrome en producción |
| M6 | **Dado** el enlace de invitación, **cuando** se abre, **entonces** la dirección no se filtra a otros sitios (`Referrer-Policy: no-referrer`). | 🟡 |

### US-43 · Errores y mantenimiento controlados

**Como** operadora de la plataforma **quiero** ver los errores sin datos personales y que el mantenimiento solo corra autorizado **para** operar el sitio con seguridad.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| M7 | **Dado** un error del servidor, **cuando** ocurre, **entonces** queda una línea en los registros con la ruta (sin datos personales ni tokens). | ✅ `unit/log-error` |
| M8 | **Dado** la ruta de mantenimiento diario, **cuando** se llama sin la clave, con una incorrecta o sin la variable configurada, **entonces** no corre. | ✅ `unit/cron-route` |
| O4 | **Dado** el mantenimiento diario, **cuando** corre, **entonces** deja constancia solo si cambió algo. | ✅ `services/maintenance` |

### US-44 · Cambios de código y migraciones seguros

**Como** equipo de desarrollo **quiero** que todo cambio pase tests y que las migraciones se apliquen con autorización **para** no romper la base real.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| O2 | **Dado** un cambio de código, **cuando** se prepara para guardar, **entonces** `npm test`, el chequeo de tipos, el lint y el build pasan. | ✅ (305 tests) |
| O3 | **Dado** las migraciones, **cuando** se aplican a la base real, **entonces** solo se hace desde `main` y con autorización de la dueña del proyecto. | 🟡 (regla de trabajo) |

### US-45 · Promover administradoras de la plataforma

**Como** operadora de la plataforma **quiero** dar el rol de administración con un comando que primero simula **para** no otorgarlo por error.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| O1 | **Dado** el comando `npm run promote -- email --platform-admin`, **cuando** se corre con `--yes`, **entonces** esa cuenta pasa a ser administración de la plataforma; sin `--yes` solo simula. | 🟡 |

---

## Feature 14 — Interfaz e identidad

_Aspecto y usabilidad de TERRAE._

### US-46 · Identidad TERRAE

**Como** usuaria **quiero** ver el nombre, los íconos y la paleta de la marca **para** reconocer el producto en cada pantalla y email.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| N1 | **Dado** la aplicación, **cuando** se abre, **entonces** se llama TERRAE en el encabezado, la pestaña y los emails. | ✅ |
| N2 | **Dado** el panel de inicio y el Resumen de administración, **cuando** se abren, **entonces** cada tarjeta lleva un ícono según su tema. | 🟡 |
| N3 | **Dado** el entorno de desarrollo, **cuando** se abre cualquier página, **entonces** hay un selector para alternar entre dos paletas de color (arcilla y salvia / tierra y turquesa) y se ve cuál está activa. | 🟡 (temporal, hasta elegir una) |

### US-47 · Controles claros y accesibles

**Como** usuaria **quiero** listas, campos y estados de carga consistentes y usables con teclado **para** usar el sitio sin fricción.

| ID | Criterio de aceptación | Estado |
|---|---|---|
| N4 | **Dado** cualquier lista de opciones (desplegables), **cuando** se abre, **entonces** tiene fondo blanco, resalta la opción elegida y la que está bajo el cursor, y funciona con el teclado. | 🟡 |
| N5 | **Dado** cualquier campo enfocado, **cuando** se selecciona, **entonces** muestra un único borde del color de marca, sin doble borde. | 🟡 |
| N6 | **Dado** una página que carga datos, **cuando** tarda, **entonces** muestra un esqueleto de carga y no un espacio vacío. | 🟡 |

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

---

**Resumen:** 14 features, 47 historias, 135 criterios.
