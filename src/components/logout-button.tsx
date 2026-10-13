"use client";

import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  async function logout() {
    await createClient().auth.signOut();
    location.assign("/login");
  }
  return (
    <button onClick={logout} className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
      Cerrar sesión
    </button>
  );
}
