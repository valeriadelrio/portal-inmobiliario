import { statusLabel } from "@/lib/labels";

/** Etiqueta de estado con color: borrador gris, activa verde, reservada ámbar, vendida/alquilada azul, pausada naranja. */
export function StatusBadge({ status, operation, className = "" }: { status: string; operation: string; className?: string }) {
  return <span className={`badge badge-${status} ${className}`}>{statusLabel(status, operation)}</span>;
}
