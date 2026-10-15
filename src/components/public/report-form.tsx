"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Select } from "@/components/select";
import { reportAction } from "@/app/[locale]/propiedades/[slug]/actions";
import { REPORT_REASON } from "@/contracts";
import { getDict, type Locale } from "@/i18n";

/** Denuncia de una ficha: un enlace discreto que despliega un formulario corto (sin obligar a dejar datos). */
export function ReportForm({ propertyId, locale }: { propertyId: string; locale: Locale }) {
  const t = getDict(locale).report;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportAction, null);

  if (state?.ok) return <p role="status" className="alert alert-ok">{state.message}</p>;
  if (!open) {
    return <button type="button" className="link text-sm" onClick={() => setOpen(true)} aria-expanded="false">{t.open}</button>;
  }
  return (
    <form action={action} className="card space-y-3" aria-label={t.title}>
      <h2 className="font-medium">{t.title}</h2>
      <p className="muted text-sm">{t.intro}</p>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>No completar<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="label">{t.reason}
        <Select name="reason" required defaultValue="">
          <option value="" disabled>—</option>
          {REPORT_REASON.map((r) => <option key={r} value={r}>{t.reasons[r]}</option>)}
        </Select>
      </label>
      <label className="label">{t.message}
        <textarea name="message" maxLength={1000} rows={3} className="input" />
      </label>
      <label className="label">{t.email}
        <input name="email" type="email" maxLength={200} autoComplete="email" className="input" />
      </label>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary">{pending ? t.sending : t.send}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t.cancel}</button>
      </div>
    </form>
  );
}
