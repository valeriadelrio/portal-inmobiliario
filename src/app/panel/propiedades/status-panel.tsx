"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { canTransition, type PropertyStatus, type PublishBlocker } from "@/contracts";
import { BLOCKER_LABEL, statusLabel } from "@/lib/labels";
import { deleteAction, statusAction } from "./actions";

const MOVES: { to: PropertyStatus; label: (op: string) => string; cls: string }[] = [
  { to: "active", label: () => "Publicar", cls: "btn-primary" },
  { to: "reserved", label: () => "Marcar como reservada", cls: "" },
  { to: "sold_rented", label: (op) => (op === "rent" ? "Marcar como alquilada" : "Marcar como vendida"), cls: "" },
  { to: "paused", label: () => "Pausar", cls: "" },
];

export function StatusPanel({ id, status, operation, blockers }: { id: string; status: PropertyStatus; operation: string; blockers: PublishBlocker[] }) {
  const [state, action, pending] = useActionState(statusAction, null);
  const [delState, delAction, delPending] = useActionState(deleteAction, null);
  const [confirming, setConfirming] = useState(false);
  const moves = MOVES.filter((m) => canTransition(status, m.to));
  const canDelete = status === "draft" || status === "paused";
  const publishing = moves.some((m) => m.to === "active");

  return (
    <div className="space-y-4">
      <p>Estado actual: <span className="badge">{statusLabel(status, operation)}</span></p>

      {publishing && blockers.length > 0 && (
        <div className="alert alert-error">
          <p className="font-medium">Para publicar todavía falta:</p>
          <ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{BLOCKER_LABEL[b]}</li>)}</ul>
        </div>
      )}

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        {moves.map((m) => (
          <button
            key={m.to} name="status" value={m.to}
            disabled={pending || (m.to === "active" && blockers.length > 0)}
            className={`btn ${m.cls}`}
          >
            {m.label(operation)}
          </button>
        ))}
        <FormMessage state={state} />
      </form>

      {canDelete && (
        <form action={delAction} className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          <input type="hidden" name="id" value={id} />
          {!confirming ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Eliminar propiedad</button>
          ) : (
            <>
              <span className="text-sm">¿Eliminar definitivamente?</span>
              <button disabled={delPending} className="btn btn-danger">Sí, eliminar</button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancelar</button>
            </>
          )}
          <FormMessage state={delState} />
        </form>
      )}
      {!canDelete && <p className="muted text-sm">Para eliminarla, primero pausala.</p>}
    </div>
  );
}
