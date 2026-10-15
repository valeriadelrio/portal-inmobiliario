import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Administración de la plataforma</h1>
      
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/agencias" className="card block hover:border-blue-700">
          <p className="font-medium">Todas las inmobiliarias</p>
          <p className="muted mt-1 text-sm">Aprobar, rechazar o suspender inmobiliarias.</p>
        </Link>
        <Link href="/admin/zonas" className="card block hover:border-blue-700">
          <p className="font-medium">Zonas y barrios</p>
          <p className="muted mt-1 text-sm">Alta, edición e importación por CSV.</p>
        </Link>
        <Link href="/admin/denuncias" className="card block hover:border-blue-700">
          <p className="font-medium">Denuncias</p>
          <p className="muted mt-1 text-sm">Lo que reportan los visitantes: descartar u ocultar la publicación.</p>
        </Link>
        <Link href="/admin/propiedades" className="card block hover:border-blue-700">
          <p className="font-medium">Moderar propiedades</p>
          <p className="muted mt-1 text-sm">Buscar una publicación y ocultarla o restituirla, con motivo.</p>
        </Link>
        <Link href="/admin/registro" className="card block hover:border-blue-700">
          <p className="font-medium">Registro de acciones</p>
          <p className="muted mt-1 text-sm">Quién aprobó, suspendió u ocultó qué, y cuándo.</p>
        </Link>
      </div>
    </main>
  );
}
