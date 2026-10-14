import Link from "next/link";
import type { PropertyListItemDto } from "@/contracts";
import { StatusBadge } from "@/components/status-badge";
import { formatPrice, OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";
import { photoUrl } from "@/lib/photo-url";

/** Tarjeta de propiedad: portada, estado con color y datos clave, sin entrar a la ficha. */
export function PropertyCard({ p }: { p: PropertyListItemDto }) {
  return (
    <Link href={`/panel/propiedades/${p.id}`} className="card group block overflow-hidden p-0 hover:border-blue-700 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-200">
        {p.coverKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(p.coverKey, 800)} alt={`Portada de ${p.title}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="muted flex h-full flex-col items-center justify-center gap-1 text-sm">
            <span aria-hidden className="text-3xl">🏠</span>Sin fotos todavía
          </div>
        )}
        <StatusBadge status={p.status} operation={p.operation} className="absolute left-3 top-3 shadow" />
        {p.photoCount > 0 && <span className="badge absolute bottom-3 right-3 bg-black/70 text-white">{p.photoCount} {p.photoCount === 1 ? "foto" : "fotos"}</span>}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-lg font-semibold">{formatPrice(p.price, p.currency)}</p>
        <p className="line-clamp-1 font-medium">{p.title}</p>
        <p className="muted text-sm">{TYPE_LABEL[p.type] ?? p.type} en {OPERATION_LABEL[p.operation]?.toLowerCase() ?? p.operation} · {p.zoneName}</p>
        <p className="muted flex flex-wrap gap-x-3 text-sm">
          <span>{p.totalAreaM2} m²</span>
          {p.bedrooms !== null && <span>{p.bedrooms} dorm.</span>}
          {p.bathrooms !== null && <span>{p.bathrooms} {p.bathrooms === 1 ? "baño" : "baños"}</span>}
        </p>
      </div>
    </Link>
  );
}
