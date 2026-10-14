import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Propiedades y lotes en Tandil</h1>
      <p className="muted mt-3 text-lg">
        Un solo lugar con las propiedades de varias inmobiliarias. El buscador público llega en las próximas etapas.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn btn-primary">Ingresar</Link>
        <Link href="/panel" className="btn">Mi panel</Link>
      </div>
    </main>
  );
}
