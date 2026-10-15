"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { slugify } from "@/lib/slug-client";
import { registerAgencyAction } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAgencyAction, null);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  return (
    <form action={action} className="card grid gap-4">
      <label className="label">Nombre de la inmobiliaria
        <input name="name" required minLength={2} maxLength={120} className="input"
          onChange={(e) => !touched && setSlug(slugify(e.target.value))} />
      </label>
      <label className="label">Dirección en el portal
        <input name="slug" required value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value); }}
          pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" placeholder="mi-inmobiliaria" />
        <span className="muted text-xs font-normal">Será parte del enlace público. Solo minúsculas, números y guiones.</span>
      </label>
      <label className="label">Tu nombre (como aparecerá en tus propiedades)
        <input name="displayName" required minLength={2} className="input" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Teléfono (opcional)<input name="phone" className="input" /></label>
        <label className="label">Email de contacto (opcional)<input name="email" type="email" className="input" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary">Enviar solicitud</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
