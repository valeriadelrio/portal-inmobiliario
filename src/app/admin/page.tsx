import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Administración de la plataforma</h1>
      <p className="mt-2 text-zinc-600">Las secciones se agregan a medida que se construyen.</p>
      <ul className="mt-4 list-disc pl-5">
        <li><Link href="/admin/zonas" className="text-blue-700 underline">Zonas y barrios</Link></li>
      </ul>
    </main>
  );
}
