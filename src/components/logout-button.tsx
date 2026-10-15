"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { clearNavCache } from "./nav-view";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    clearNavCache();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={logout} className="btn">
      Cerrar sesión
    </button>
  );
}
