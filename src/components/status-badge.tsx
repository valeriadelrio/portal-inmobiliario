import type { Locale } from "@/i18n";
import { statusLabel } from "@/lib/labels";

/** Etiqueta de estado con color: borrador gris, activa verde, reservada ámbar, vendida/alquilada azul, pausada naranja. */
export function StatusBadge({ status, operation, className = "", locale = "es" }: { status: string; operation: string; className?: string; locale?: Locale }) {
  return <span className={`badge badge-${status} ${className}`}>{statusLabel(status, operation, locale)}</span>;
}
