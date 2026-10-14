import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Administración de la plataforma</h1>
      <p className="muted mt-2">Las secciones se agregan a medida que se construyen.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/agencias" className="card block hover:border-blue-700">
          <p className="font-medium">Todas las inmobiliarias</p>
          <p className="muted mt-1 text-sm">Aprobar, rechazar o suspender inmobiliarias.</p>
        </Link>
        <Link href="/admin/zonas" className="card block hover:border-blue-700">
          <p className="font-medium">Zonas y barrios</p>
          <p className="muted mt-1 text-sm">Alta, edición e importación por CSV.</p>
        </Link>
      </div>
    </main>
  );
}
