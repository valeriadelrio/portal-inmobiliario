"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { inquiryAction } from "@/app/propiedades/[slug]/actions";

/** Formulario de contacto de la ficha. Con sesión, nombre y email vienen precargados. */
export function InquiryForm({ propertyId, title, defaults }: { propertyId: string; title: string; defaults?: { name: string; email: string } }) {
  const [state, action, pending] = useActionState(inquiryAction, null);
  if (state?.ok) return <p role="status" className="alert alert-ok">{state.message}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="propertyId" value={propertyId} />
      {/* campo trampa anti-bots: oculto para las personas */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>No completar<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="label">Nombre
        <input name="name" required minLength={2} maxLength={100} defaultValue={defaults?.name} autoComplete="name" className="input" />
      </label>
      <label className="label">Email
        <input name="email" type="email" required defaultValue={defaults?.email} autoComplete="email" className="input" />
      </label>
      <label className="label">Teléfono (opcional)
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" className="input" />
      </label>
      <label className="label">Mensaje
        <textarea name="message" required minLength={10} maxLength={2000} rows={4} defaultValue={`Hola, me interesa "${title}". ¿Podemos coordinar una visita?`} className="input" />
      </label>
      <label className="flex items-start gap-2 text-xs font-normal text-slate-700">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>Acepto que mis datos se envíen a la inmobiliaria para que me contacte por esta propiedad (Ley 25.326 de protección de datos personales).</span>
      </label>
      <FormMessage state={state} />
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Enviando…" : "Enviar consulta"}</button>
    </form>
  );
}
