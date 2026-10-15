"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { acceptAction } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptAction.bind(null, token), null);
  return (
    <form action={action} className="grid gap-4">
      <label className="label">Tu nombre (como aparecerá en tus propiedades)
        <input name="displayName" required minLength={2} className="input" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-primary">Aceptar invitación</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
