import Link from "next/link";
import { getDict } from "@/i18n";

// El idioma no está disponible acá (no recibe params): se muestra en ambos idiomas.
export default function NotFound() {
  const es = getDict("es").site;
  const en = getDict("en").site;
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-16 text-center">
      <section lang="es" className="space-y-2">
        <h1 className="text-2xl font-semibold">{es.notFoundTitle}</h1>
        <p className="muted">{es.notFoundText}</p>
        <Link href="/propiedades" className="btn btn-primary">{es.seeProperties}</Link>
      </section>
      <section lang="en" className="space-y-2 border-t border-slate-200 pt-6">
        <h2 className="text-xl font-semibold">{en.notFoundTitle}</h2>
        <p className="muted">{en.notFoundText}</p>
        <Link href="/en/propiedades" className="btn">{en.seeProperties}</Link>
      </section>
    </main>
  );
}
