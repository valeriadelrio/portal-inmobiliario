/** Esqueletos de carga: copian la forma de cada pantalla para que no "salte" el diseño al llegar los datos. */

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Contenedor accesible: los lectores de pantalla anuncian "Cargando…" una sola vez. */
export function Loading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

function CardBone() {
  return (
    <div className="card overflow-hidden p-0" aria-hidden>
      <Bone className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Bone className="h-6 w-1/3" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-4 w-3/5" />
        <Bone className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Loading>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => <li key={i}><CardBone /></li>)}
      </ul>
    </Loading>
  );
}

/** Buscador público: filtros + resultados. */
export function SearchSkeleton() {
  return (
    <Loading className="space-y-5">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="space-y-1.5"><Bone className="h-3 w-1/3" /><Bone className="h-10 w-full" /></div>)}
      </div>
      <Bone className="h-4 w-28" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <li key={i}><CardBone /></li>)}
      </ul>
    </Loading>
  );
}

/** Ficha pública: galería a la izquierda, contacto a la derecha. */
export function FichaSkeleton() {
  return (
    <Loading className="space-y-4">
      <Bone className="h-4 w-48" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4" aria-hidden>
          <Bone className="aspect-[4/3] w-full rounded-xl" />
          <div className="flex gap-2">{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-16 w-24" />)}</div>
          <Bone className="h-6 w-24" />
          <Bone className="h-8 w-3/4" />
          <Bone className="h-10 w-1/3" />
          <div className="space-y-2"><Bone className="h-4 w-full" /><Bone className="h-4 w-full" /><Bone className="h-4 w-2/3" /></div>
          <div className="card space-y-3">{Array.from({ length: 5 }, (_, i) => <Bone key={i} className="h-4 w-full" />)}</div>
        </div>
        <div className="space-y-4" aria-hidden>
          <div className="card space-y-3"><Bone className="h-5 w-1/3" /><div className="flex items-center gap-3"><Bone className="h-12 w-12 rounded-full" /><Bone className="h-4 w-32" /></div><Bone className="h-10 w-full" /></div>
          <div className="card space-y-2"><Bone className="h-5 w-1/2" /><Bone className="h-4 w-2/3" /></div>
        </div>
      </div>
    </Loading>
  );
}

/** Página de una inmobiliaria: cabecera + propiedades. */
export function AgencySkeleton() {
  return (
    <Loading className="space-y-6">
      <div className="card flex items-center gap-4" aria-hidden>
        <Bone className="h-16 w-16" />
        <div className="flex-1 space-y-2"><Bone className="h-7 w-1/3" /><Bone className="h-4 w-2/3" /></div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <li key={i}><CardBone /></li>)}
      </ul>
    </Loading>
  );
}

/** Título + lista de filas (equipo, inmobiliarias, zonas…). */
export function ListSkeleton({ rows = 4, heading = true }: { rows?: number; heading?: boolean }) {
  return (
    <Loading className="space-y-4">
      {heading && <Bone className="h-8 w-48" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center justify-between gap-4" aria-hidden>
          <div className="flex-1 space-y-2"><Bone className="h-5 w-1/3" /><Bone className="h-4 w-1/2" /></div>
          <Bone className="h-9 w-24" />
        </div>
      ))}
    </Loading>
  );
}

/** Formulario con N campos. */
export function FormSkeleton({ fields = 6, heading = true }: { fields?: number; heading?: boolean }) {
  return (
    <Loading className="space-y-4">
      {heading && <Bone className="h-8 w-56" />}
      <div className="card grid gap-4 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: fields }, (_, i) => <div key={i} className="space-y-1.5"><Bone className="h-3 w-1/3" /><Bone className="h-10 w-full" /></div>)}
        <Bone className="h-10 w-36" />
      </div>
    </Loading>
  );
}

/** Inicio del panel: título + tarjetas de acceso. */
export function DashboardSkeleton() {
  return (
    <Loading className="space-y-4">
      <Bone className="h-8 w-32" />
      <Bone className="h-4 w-48" />
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="card space-y-2"><Bone className="h-5 w-1/2" /><Bone className="h-4 w-3/4" /></div>)}
      </div>
    </Loading>
  );
}

/** Ficha de edición de una propiedad: estado + fotos + datos. */
export function PropertyDetailSkeleton() {
  return (
    <Loading className="space-y-4">
      <Bone className="h-4 w-28" />
      <Bone className="h-8 w-2/3" />
      <div className="card space-y-3" aria-hidden><Bone className="h-5 w-20" /><Bone className="h-6 w-32" /><div className="flex gap-2"><Bone className="h-10 w-28" /><Bone className="h-10 w-28" /></div></div>
      <div className="card space-y-3" aria-hidden>
        <Bone className="h-5 w-20" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="aspect-[4/3]" />)}</div>
      </div>
      <FormSkeleton fields={6} heading={false} />
    </Loading>
  );
}
