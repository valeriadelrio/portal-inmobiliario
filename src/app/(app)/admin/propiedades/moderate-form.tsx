"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { moderateAction } from "../moderacion-actions";

/** Ocultar (con motivo obligatorio, visible para la inmobiliaria) o restituir una publicación. */
export function ModerateForm({ id, hidden }: { id: string; hidden: boolean }) {
  const [state, action, pending] = useActionState(moderateAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hide" value={hidden ? "0" : "1"} />
      {!hidden && <input name="reason" required minLength={3} maxLength={500} placeholder="Motivo (lo ve la inmobiliaria)" className="input w-72" aria-label="Motivo" />}
      <button disabled={pending} className={`btn ${hidden ? "btn-primary" : "btn-danger"}`}>{hidden ? "Restituir" : "Ocultar"}</button>
      <FormMessage state={state} />
    </form>
  );
}
