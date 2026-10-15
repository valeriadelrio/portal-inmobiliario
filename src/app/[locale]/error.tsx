"use client";

import { getDict } from "@/i18n";

export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const es = getDict("es").site;
  const en = getDict("en").site;
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-16 text-center">
      <section lang="es" className="space-y-2">
        <h1 className="text-2xl font-semibold">{es.errorTitle}</h1>
        <p className="muted">{es.errorText}</p>
      </section>
      <section lang="en" className="space-y-2">
        <h2 className="text-xl font-semibold">{en.errorTitle}</h2>
        <p className="muted">{en.errorText}</p>
      </section>
      <button onClick={() => unstable_retry()} className="btn btn-primary">{es.retry} / {en.retry}</button>
    </main>
  );
}
