"use client";

import { useActionState } from "react";
import type { InquiryStatus } from "@/contracts";
import { inquiryStatusAction } from "./actions";

const NEXT: { status: InquiryStatus; label: string }[] = [
  { status: "read", label: "Marcar como leída" },
  { status: "answered", label: "Marcar como respondida" },
  { status: "archived", label: "Archivar" },
  { status: "new", label: "Volver a nueva" },
];

export function StatusButtons({ id, current }: { id: string; current: InquiryStatus }) {
  const [state, action, pending] = useActionState(inquiryStatusAction, null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {NEXT.filter((n) => n.status !== current).map((n) => (
        <form key={n.status} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={n.status} />
          <button disabled={pending} className="btn text-sm">{n.label}</button>
        </form>
      ))}
      {state && !state.ok && <span role="alert" className="text-sm text-red-700">{state.message}</span>}
    </div>
  );
}
