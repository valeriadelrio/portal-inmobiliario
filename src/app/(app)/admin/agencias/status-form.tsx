"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { statusAction } from "./actions";

const ACTIONS: Record<string, { status: string; label: string; cls: string }[]> = {
  pending: [{ status: "approved", label: "Aprobar", cls: "btn-primary" }, { status: "rejected", label: "Rechazar", cls: "btn-danger" }],
  approved: [{ status: "suspended", label: "Suspender", cls: "btn-danger" }],
  suspended: [{ status: "approved", label: "Reactivar", cls: "btn-primary" }],
  rejected: [],
};

export function StatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(statusAction, null);
  const options = ACTIONS[status] ?? [];
  if (options.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" placeholder="Motivo (opcional)" className="input w-56" aria-label="Motivo" />
      {options.map((o) => (
        <button key={o.status} name="status" value={o.status} disabled={pending} className={`btn ${o.cls}`}>{o.label}</button>
      ))}
      <FormMessage state={state} />
    </form>
  );
}
