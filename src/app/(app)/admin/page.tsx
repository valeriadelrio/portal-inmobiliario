import { IconCard } from "@/components/icon-card";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Administración de la plataforma</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <IconCard href="/admin/agencias" icon="building" title="Todas las inmobiliarias" text="Aprobar, rechazar o suspender inmobiliarias." />
        <IconCard href="/admin/zonas" icon="pin" title="Zonas y barrios" text="Alta, edición e importación por CSV." />
        <IconCard href="/admin/denuncias" icon="flag" title="Denuncias" text="Lo que reportan los visitantes: descartar u ocultar la publicación." />
        <IconCard href="/admin/propiedades" icon="shield" title="Moderar propiedades" text="Buscar una publicación y ocultarla o restituirla, con motivo." />
        <IconCard href="/admin/registro" icon="list" title="Registro de acciones" text="Quién aprobó, suspendió u ocultó qué, y cuándo." />
      </div>
    </main>
  );
}
