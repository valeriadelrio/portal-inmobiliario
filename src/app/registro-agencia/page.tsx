import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "@/server/auth/get-actor";
import { getMyAgency } from "@/server/services/agency";
import { RegisterForm } from "./register-form";

async function Content() {
  const mine = await getMyAgency(await getActor());
  if (mine.ok && mine.data) {
    return (
      <p className="card">
        Ya sos parte de <strong>{mine.data.name}</strong>. <Link href="/panel/agencia" className="link">Ir a mi agencia</Link>
      </p>
    );
  }
  return <RegisterForm />;
}

export default function RegistroAgenciaPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Registrar mi inmobiliaria</h1>
        <p className="muted mt-1 text-sm">
          La solicitud queda pendiente hasta que la administración del portal la apruebe. Mientras tanto vas a poder ver su estado.
        </p>
      </div>
      <Suspense fallback={<p className="muted">Cargando…</p>}><Content /></Suspense>
    </main>
  );
}
