"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/panel` },
      });
      setMessage(error ? error.message : "Revisá tu email para confirmar la cuenta.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        const next = new URLSearchParams(location.search).get("next");
        location.assign(next?.startsWith("/") ? next : "/panel");
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Ingresar" : "Crear cuenta"}</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        <input
          type="password" required minLength={8} placeholder="Contraseña (mín. 8)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        <button disabled={busy} className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50">
          {mode === "login" ? "Ingresar" : "Registrarme"}
        </button>
      </form>
      {message && <p role="status" className="text-sm text-zinc-700">{message}</p>}
      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm text-zinc-600 underline"
      >
        {mode === "login" ? "No tengo cuenta" : "Ya tengo cuenta"}
      </button>
    </main>
  );
}
