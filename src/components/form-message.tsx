import type { ActionState } from "@/lib/form-state";

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p role="status" className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>;
}
