import Link from "next/link";
import type { PublicCardDto } from "@/contracts";
import { PhotoImg } from "@/components/photo-img";
import { StatusBadge } from "@/components/status-badge";
import { formatPrice, OPERATION_LABEL, TYPE_LABEL } from "@/lib/labels";
import { photoUrl } from "@/lib/photo-url";

/** Tarjeta del buscador público. Las reservadas y vendidas/alquiladas se muestran con un cartel. */
export function PublicCard({ p, priority = false }: { p: PublicCardDto; priority?: boolean }) {
  const closed = p.status !== "active";
  return (
    <Link href={`/propiedades/${p.slug}`} className="card group block overflow-hidden p-0 hover:border-blue-700 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-200">
        {p.coverKey ? (
          <PhotoImg src={photoUrl(p.coverKey, 800)} alt={`${TYPE_LABEL[p.type] ?? p.type} en ${p.zoneName}`} loading={priority ? "eager" : "lazy"}
            className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${closed ? "opacity-80" : ""}`} />
        ) : (
          <div className="muted flex h-full items-center justify-center text-sm">Sin fotos</div>
        )}
        <span className="badge absolute left-3 top-3 bg-blue-700 text-white shadow">{OPERATION_LABEL[p.operation] ?? p.operation}</span>
        {closed && <StatusBadge status={p.status} operation={p.operation} className="absolute right-3 top-3 shadow" />}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-lg font-semibold">{formatPrice(p.price, p.currency)}</p>
        <p className="line-clamp-1 font-medium">{p.title}</p>
        <p className="muted text-sm">{TYPE_LABEL[p.type] ?? p.type} · {p.zoneName}</p>
        <p className="muted flex flex-wrap gap-x-3 text-sm">
          <span>{p.totalAreaM2} m²</span>
          {p.bedrooms !== null && <span>{p.bedrooms} dorm.</span>}
          {p.bathrooms !== null && <span>{p.bathrooms} {p.bathrooms === 1 ? "baño" : "baños"}</span>}
        </p>
        <p className="muted line-clamp-1 text-xs">{p.agencyName}</p>
      </div>
    </Link>
  );
}
