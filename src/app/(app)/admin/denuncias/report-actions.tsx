"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { resolveReportAction } from "../moderacion-actions";

/** Resolver una denuncia abierta: descartarla o ocultar la publicación (el motivo lo ve la inmobiliaria). */
export function ReportActions({ id, alreadyHidden }: { id: string; alreadyHidden: boolean }) {
  const [state, action, pending] = useActionState(resolveReportAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" maxLength={500} placeholder="Nota o motivo" className="input w-64" aria-label="Nota o motivo" />
      <button name="action" value="dismiss" disabled={pending} className="btn">Descartar</button>
      {!alreadyHidden && <button name="action" value="hide" disabled={pending} className="btn btn-danger">Ocultar publicación</button>}
      <FormMessage state={state} />
    </form>
  );
}
