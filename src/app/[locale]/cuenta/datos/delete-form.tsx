"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormMessage } from "@/components/form-message";
import { clearNavCache } from "@/components/nav-view";
import { getDict, localePath, type Locale } from "@/i18n";
import { createClient } from "@/lib/supabase/browser";
import { deleteAccountAction } from "./actions";

export function DeleteForm({ locale }: { locale: Locale }) {
  const t = getDict(locale).account;
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteAccountAction, null);

  useEffect(() => {
    if (!state?.ok) return;
    clearNavCache();
    createClient().auth.signOut().finally(() => {
      router.push(localePath(locale, "/"));
      router.refresh();
    });
  }, [state, locale, router]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="label">{t.confirmLabel}
        <input name="email" type="email" required autoComplete="off" className="input" />
      </label>
      {!state?.ok && <FormMessage state={state} />}
      <button disabled={pending || !!state?.ok} className="btn btn-danger">{pending || state?.ok ? t.working : t.confirmButton}</button>
    </form>
  );
}
