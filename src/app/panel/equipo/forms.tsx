"use client";

import { Select } from "@/components/select";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { inviteAction, removeAction, resendAction, revokeAction, roleAction } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, null);
  const [copied, setCopied] = useState(false);
  const full = state?.link ? `${location.origin}${state.link}` : "";
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="label">Email de la persona
          <input name="email" type="email" required className="input w-72 max-w-full" />
        </label>
        <label className="label">Rol
          <Select name="role" className="input"><option value="agent">Agente</option><option value="agency_admin">Administrador</option></Select>
        </label>
        <button disabled={pending} className="btn btn-primary">Crear invitación</button>
      </form>
      <FormMessage state={state} />
      {full && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={full} className="input max-w-xl" aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn" onClick={async () => { await navigator.clipboard.writeText(full); setCopied(true); }}>
            {copied ? "¡Copiado!" : "Copiar enlace"}
          </button>
        </div>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn btn-danger">Revocar</button>
      <FormMessage state={state} />
    </form>
  );
}

export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resendAction, null);
  const [copied, setCopied] = useState(false);
  const full = state?.link ? `${location.origin}${state.link}` : "";
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action} className="inline-flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <button disabled={pending} className="btn">{pending ? "Reenviando…" : "Reenviar"}</button>
      </form>
      <FormMessage state={state} />
      {full && (
        <button type="button" className="btn text-sm" onClick={async () => { await navigator.clipboard.writeText(full); setCopied(true); }}>
          {copied ? "¡Copiado!" : "Copiar enlace nuevo"}
        </button>
      )}
    </div>
  );
}

export function RoleSelect({ memberId, role }: { memberId: string; role: string }) {
  const [state, action, pending] = useActionState(roleAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <Select name="role" defaultValue={role} className="input w-auto" aria-label="Rol">
        <option value="agent">Agente</option><option value="agency_admin">Administrador</option>
      </Select>
      <button disabled={pending} className="btn">Cambiar</button>
      <FormMessage state={state} />
    </form>
  );
}

export function RemoveMember({ memberId, others }: { memberId: string; others: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(removeAction, null);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Dar de baja</button>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <Select name="reassignTo" className="input w-auto" aria-label="Reasignar propiedades a">
        <option value="">Reasignar a… (solo si tiene propiedades)</option>
        {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
      <button disabled={pending} className="btn btn-danger">Confirmar baja</button>
      <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancelar</button>
      <FormMessage state={state} />
    </form>
  );
}
