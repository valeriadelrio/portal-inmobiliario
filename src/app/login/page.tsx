"use client";

import { useState } from "react";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
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
      setMessage(error ? { text: error.message, ok: false } : { text: "Revisá tu email para confirmar la cuenta.", ok: true });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, ok: false });
      else {
        const next = new URLSearchParams(location.search).get("next");
        location.assign(safeNext(next));
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <div className="card flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Ingresar" : "Crear cuenta"}</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password" required minLength={8} placeholder="Contraseña (mín. 8)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        <button disabled={busy} className="btn btn-primary">
          {mode === "login" ? "Ingresar" : "Registrarme"}
        </button>
      </form>
      {message && <p role="status" className={`alert ${message.ok ? "alert-ok" : "alert-error"}`}>{message.text}</p>}
      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="link text-sm"
      >
        {mode === "login" ? "No tengo cuenta" : "Ya tengo cuenta"}
      </button>
      </div>
    </main>
  );
}
