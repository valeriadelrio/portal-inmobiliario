# TERRAE — Diagramas

Los diagramas están en Mermaid: GitHub y la mayoría de los editores los dibujan solos. Si cambia el código, estos archivos se actualizan junto con él.

## 1. Modelo de datos

Qué se guarda y cómo se relaciona. Las flechas leen "uno a muchos"; el círculo significa "opcional". `audit_log` no tiene relaciones a propósito: es un registro que no debe romperse si se borra algo.

```mermaid
erDiagram
  AGENCY ||--o{ AGENCY_MEMBER : "tiene integrantes"
  USER_PROFILE ||--o{ AGENCY_MEMBER : "es integrante"
  AGENCY ||--o{ AGENCY_INVITATION : "emite"
  AGENCY ||--o{ PROPERTY : "publica"
  AGENCY_MEMBER ||--o{ PROPERTY : "es responsable"
  ZONE ||--o{ PROPERTY : "ubica"
  ZONE |o--o{ ZONE : "barrio dentro de zona"
  PROPERTY ||--o| PROPERTY_BUILDING : "si no es lote"
  PROPERTY ||--o| PROPERTY_LOT : "si es lote"
  PROPERTY ||--o{ PROPERTY_PHOTO : "tiene"
  PROPERTY ||--o{ INQUIRY : "recibe"
  AGENCY_MEMBER ||--o{ INQUIRY : "destinatario"
  USER_PROFILE |o--o{ INQUIRY : "envía (si tiene cuenta)"
  PROPERTY ||--o{ PROPERTY_REPORT : "es denunciada"
  USER_PROFILE |o--o{ PROPERTY_REPORT : "denuncia (si tiene cuenta)"

  AGENCY {
    uuid id
    text name
    text slug "dirección web única"
    text status "pending | approved | suspended | rejected"
    text status_reason
  }
  USER_PROFILE {
    uuid id "= usuario de Supabase Auth"
    text email
    text platform_role "null | platform_admin"
    timestamp disabled_at
  }
  AGENCY_MEMBER {
    uuid id
    text role "agent | agency_admin"
    text status "invited | active | removed"
    text public_whatsapp
  }
  AGENCY_INVITATION {
    text email
    text token_hash "el token nunca se guarda"
    text status "pending | accepted | revoked"
    timestamp expires_at
  }
  ZONE {
    text slug
    text name_es
    text name_en
    boolean is_active
  }
  PROPERTY {
    uuid id
    text operation "sale | rent"
    text type "house, apartment, ph, lot, commercial, office, garage"
    text status "draft, active, reserved, sold_rented, paused"
    numeric price
    text currency "USD | ARS"
    text moderation_status "ok | hidden"
    text moderation_reason
    text slug
  }
  PROPERTY_BUILDING {
    int rooms
    int bedrooms
    int bathrooms
    int garages
  }
  PROPERTY_LOT {
    numeric frontage_m
    numeric depth_m
    jsonb services
    boolean is_corner
  }
  PROPERTY_PHOTO {
    text storage_key
    int position
    boolean is_cover
    text status "pending | ready"
  }
  INQUIRY {
    text name
    text email
    text message
    text status "new | read | answered | archived"
    timestamp consent_at "Ley 25.326"
    text ip_hash "se borra a los 30 días"
  }
  PROPERTY_REPORT {
    text reason "fake, duplicate, wrong_info, inappropriate, sold, other"
    text status "open | dismissed | actioned"
    text reporter_email
  }
  AUDIT_LOG {
    text action
    text entity
    uuid actor_id
    text detail
  }
```

## 2. Arquitectura por capas

Por dónde pasa un pedido. Lo importante: ninguna pantalla habla con la base directamente. Todo pasa por un servicio, que recibe quién es la persona (`Actor`), y la base vuelve a comprobar los permisos con RLS.

```mermaid
flowchart TB
  nav["Navegador<br/>(visitante, agente, admin)"]
  proxy["proxy.ts<br/>sesión, idioma /en, rutas protegidas"]
  subgraph app["Next.js (src/app)"]
    pub["Páginas públicas<br/>[locale]: inicio, buscador, ficha,<br/>inmobiliarias, privacidad"]
    panel["Panel y administración<br/>(app): panel, admin, login, invitación"]
    actions["Server Actions<br/>formularios"]
    routes["Rutas /api<br/>exportar datos, cron, subida local"]
  end
  actor["getActor()<br/>quién es: anónimo | usuario + rol + inmobiliaria"]
  policies["policies.ts<br/>can(actor, acción)"]
  subgraph svc["Servicios (src/server/services)"]
    s1["public, property, photo, zone"]
    s2["agency, inquiry"]
    s3["moderation, account"]
  end
  withactor["withActor()<br/>SET ROLE app_user + id de usuario"]
  db[("Postgres (Supabase)<br/>RLS + triggers + funciones app_*")]
  auth["Supabase Auth"]
  email["Resend<br/>emails"]
  storage["Fotos<br/>R2 (producción) / disco local"]
  cron["Vercel Cron<br/>mantenimiento diario"]
  maint["maintenance<br/>(rol dueño, sin usuario)"]

  nav --> proxy --> app
  proxy -. "refresca sesión" .-> auth
  pub --> actor
  panel --> actor
  actions --> actor
  routes --> actor
  actor -. "lee la sesión" .-> auth
  actor --> svc
  svc --> policies
  svc --> withactor --> db
  svc --> email
  svc --> storage
  cron --> routes --> maint --> db
  maint --> storage
```

## 3. Quién puede qué

```mermaid
flowchart LR
  V(["Público<br/>sin cuenta"])
  U(["Profesional<br/>con cuenta"])
  A(["Agente"])
  AA(["Admin de<br/>inmobiliaria"])
  P(["Admin de<br/>plataforma"])

  V --> v1["Buscar y ver fichas"]
  V --> v2["Enviar consulta"]
  V --> v3["Denunciar una ficha"]
  U --> V
  U --> u2["Descargar o eliminar sus datos"]
  U --> u3["Registrar una inmobiliaria"]
  A --> U
  A --> a1["Crear y editar SUS propiedades"]
  A --> a2["Subir fotos y publicar"]
  A --> a3["Ver SUS consultas"]
  AA --> A
  AA --> b1["Ver y editar TODAS las de su inmobiliaria"]
  AA --> b2["Invitar y quitar integrantes"]
  AA --> b3["Editar datos de la inmobiliaria"]
  P --> c1["Aprobar, rechazar, suspender inmobiliarias"]
  P --> c2["Ocultar o restituir fichas"]
  P --> c3["Resolver denuncias"]
  P --> c4["Zonas y barrios"]
  P --> c5["Ver el registro de acciones"]
```

Una flecha de un rol a otro significa "puede todo lo que puede el otro". Un usuario activo pertenece a una sola inmobiliaria. El agente propietario no puede consultar sus propias fichas, ni nadie de su misma inmobiliaria.

## 4. Estados

### Propiedad

El estado lo elige la inmobiliaria. La moderación es independiente: una ficha oculta no se muestra al público aunque esté "activa".

```mermaid
stateDiagram-v2
  [*] --> draft: crear
  draft --> active: publicar (3 fotos listas + portada,<br/>zona activa, inmobiliaria aprobada)
  active --> reserved
  active --> sold_rented
  active --> paused
  reserved --> active
  reserved --> sold_rented
  reserved --> paused
  sold_rented --> active
  sold_rented --> paused
  paused --> active
  draft --> [*]: borrar
  paused --> [*]: borrar (sin consultas)
```

```mermaid
stateDiagram-v2
  [*] --> ok
  ok --> hidden: plataforma oculta (con motivo)
  hidden --> ok: plataforma restituye
  note right of hidden
    No se ve en el sitio público.
    La inmobiliaria la ve con el motivo
    y no puede borrarla.
  end note
```

### Inmobiliaria, consulta, invitación y denuncia

```mermaid
stateDiagram-v2
  direction LR
  state "Inmobiliaria" as ag {
    [*] --> pending: registrarse
    pending --> approved
    pending --> rejected
    approved --> suspended
    suspended --> approved
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Consulta" as q {
    [*] --> new
    new --> read
    read --> answered
    answered --> archived
    read --> archived
    archived --> new: volver a nueva
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Invitación" as inv {
    [*] --> pending: invitar (7 días)
    pending --> accepted: acepta con el mismo email
    pending --> revoked: revocar o reenviar
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Denuncia" as rep {
    [*] --> open: visitante denuncia
    open --> dismissed: plataforma descarta
    open --> actioned: plataforma oculta la ficha
  }
```

## 5. Secuencias

### Publicar una propiedad con fotos

```mermaid
sequenceDiagram
  actor Ag as Agente
  participant UI as Panel
  participant S as Servicio de fotos
  participant DB as Postgres
  participant ST as Almacenamiento

  Ag->>UI: elige una foto
  UI->>S: requestPhotoUpload(propiedad, tipo, tamaño)
  S->>DB: crea fila "pending" (la base valida máximo 30)
  S->>ST: pide URL de subida
  S-->>UI: URL firmada
  UI->>ST: sube el original (hasta 10 MB)
  UI->>S: confirmPhotoUpload(foto)
  S->>ST: lee el original, genera WebP 400/800/1600, quita metadatos
  S->>DB: marca "ready" (la primera queda como portada)
  Ag->>UI: Publicar
  UI->>S: changeStatus(active)
  S->>DB: UPDATE status
  DB-->>S: ok, o "publish_blocked" si faltan fotos, portada o zona
```

### Consulta de un visitante

```mermaid
sequenceDiagram
  actor Vi as Visitante
  participant F as Ficha pública
  participant S as Servicio de consultas
  participant DB as Postgres
  participant R as Resend
  actor Ag as Agente

  Vi->>F: completa el formulario y acepta el consentimiento
  F->>S: createInquiry(datos, huella de IP)
  S->>S: valida; máximo 5 por hora por IP; descarta bots (campo trampa)
  S->>DB: inserta si la ficha es visible y no es de su propia inmobiliaria
  S->>DB: busca el email de la cuenta del agente (rol dueño)
  S->>R: avisa al agente (Reply-To = visitante)
  S-->>F: listo
  Ag->>DB: abre su bandeja (RLS: solo las suyas, o todas si es admin)
```

### Invitar a un agente

```mermaid
sequenceDiagram
  actor Ad as Admin de inmobiliaria
  participant S as Servicio de inmobiliarias
  participant DB as Postgres
  participant R as Resend
  actor Ag as Persona invitada

  Ad->>S: inviteMember(email, rol)
  S->>S: genera token aleatorio
  S->>DB: guarda solo el hash (vence en 7 días)
  S->>R: envía el enlace /invitacion/token
  Ag->>S: abre el enlace (ingresa con el mismo email)
  S->>DB: app_accept_invitation(hash)
  DB-->>S: crea integrante activo y marca la invitación aceptada
```

### Denuncia y moderación

```mermaid
sequenceDiagram
  actor Vi as Visitante
  participant S as Servicio de moderación
  participant DB as Postgres
  actor Pl as Admin de plataforma
  actor Ag as Agente e inmobiliaria

  Vi->>S: reportProperty(ficha, motivo)
  S->>DB: inserta (la base limita a 5 por hora por IP)
  Pl->>S: abre Denuncias
  Pl->>S: resolveReport(ocultar, nota)
  S->>DB: app_resolve_report: oculta la ficha, cierra las denuncias y deja registro
  S-->>Ag: email con el motivo
  Note over DB: La ficha deja de verse en el sitio público y en las consultas
```

## 6. Servicios y contratos

```mermaid
classDiagram
  class Actor {
    <<tipo>>
    kind: anonymous | user
    userId
    platformAdmin
    membership: agencyId, memberId, role
  }
  class ServiceResult {
    <<tipo>>
    ok: data
    error: code, message
  }
  class Policies {
    can(actor, action) bool
  }
  class PublicService {
    searchProperties()
    getPublicProperty()
    listPublicSlugs()
  }
  class PropertyService {
    createProperty() updateProperty()
    changeStatus() deleteProperty()
    listMyProperties() getProperty()
  }
  class PhotoService {
    requestPhotoUpload()
    confirmPhotoUpload()
    reorderPhotos() setCover()
    deletePhoto() updateAltText()
  }
  class AgencyService {
    registerAgency() setAgencyStatus()
    inviteMember() acceptInvitation()
    listMembers() setMemberRole()
    removeMember() revokeInvitation()
    updateAgency() listAgenciesForAdmin()
  }
  class InquiryService {
    createInquiry()
    listInquiries() setInquiryStatus()
  }
  class ModerationService {
    reportProperty() listReports()
    resolveReport() moderateProperty()
    listAuditLog()
  }
  class AccountService {
    exportMyData()
    deleteMyAccount()
  }
  class ZoneService {
    listActiveZones() listAllZones()
    createZone() updateZone() deleteZone()
    importZonesFromCsv()
  }
  PublicService ..> Actor
  PropertyService ..> Actor
  PhotoService ..> Actor
  AgencyService ..> Actor
  InquiryService ..> Actor
  ModerationService ..> Actor
  AccountService ..> Actor
  ZoneService ..> Actor
  PropertyService ..> Policies
  AgencyService ..> Policies
  ModerationService ..> Policies
  PropertyService ..> ServiceResult
  InquiryService ..> ServiceResult
```

## 7. Mapa de pantallas

```mermaid
flowchart LR
  subgraph publico["Sitio público (es y /en)"]
    home["Inicio /"] --> buscador["Buscador /propiedades"]
    buscador --> ficha["Ficha /propiedades/slug"]
    ficha --> agencia["Inmobiliaria /inmobiliarias/slug"]
    agencia --> ficha
    ficha --> denuncia["Denunciar (formulario)"]
    ficha --> consulta["Consultar (formulario)"]
    datos["Mis datos /cuenta/datos"]
    priv["Privacidad /privacidad"]
  end
  subgraph acceso["Acceso"]
    login["/login"] --> reg["Registrar mi inmobiliaria /registro-agencia"]
    inv["Invitación /invitacion/token"]
  end
  subgraph panel["Panel (agente y admin de inmobiliaria)"]
    p0["Inicio /panel"] --> p1["Mi inmobiliaria"]
    p0 --> p2["Propiedades"] --> p2b["Nueva / editar ficha<br/>fotos, estado"]
    p0 --> p3["Consultas"]
    p0 --> p4["Equipo (solo admin)"]
  end
  subgraph admin["Administración de la plataforma"]
    a0["Resumen /admin"] --> a1["Inmobiliarias"]
    a0 --> a2["Zonas y barrios"]
    a0 --> a3["Denuncias"]
    a0 --> a4["Moderar propiedades"]
    a0 --> a5["Registro de acciones"]
  end
  login --> p0
  login --> a0
```
