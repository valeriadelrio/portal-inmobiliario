"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/browser";

/** La cuenta es solo para quienes trabajan en una inmobiliaria: crear una se ofrece únicamente al registrar la inmobiliaria o aceptar una invitación. */
const canSignUp = (next: string) => next.startsWith("/registro-agencia") || next.startsWith("/invitacion/");

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const signupAllowed = canSignUp(next);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = signupAllowed && mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (signup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}${next}` },
      });
      setMessage(error ? { text: error.message, ok: false } : { text: "Revisá tu email para confirmar la cuenta.", ok: true });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, ok: false });
      else location.assign(next);
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <div className="card flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{signup ? "Crear cuenta de inmobiliaria" : "Acceso inmobiliarias"}</h1>
          <p className="muted text-sm">
            Este acceso es para quienes trabajan en una inmobiliaria. Para buscar propiedades, consultar o denunciar no necesitás cuenta.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email" required placeholder="Email" value={email} aria-label="Email"
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <input
            type="password" required minLength={8} placeholder="Contraseña (mín. 8)" value={password} aria-label="Contraseña"
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <button disabled={busy} className="btn btn-primary">
            {signup ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>
        {message && <p role="status" className={`alert ${message.ok ? "alert-ok" : "alert-error"}`}>{message.text}</p>}
        {signupAllowed ? (
          <button type="button" onClick={() => setMode(signup ? "login" : "signup")} className="link text-sm">
            {signup ? "Ya tengo cuenta" : "No tengo cuenta"}
          </button>
        ) : (
          <p className="muted text-sm">
            ¿Tenés una inmobiliaria y todavía no está en TERRAE?{" "}
            <Link href="/login?next=/registro-agencia" className="link">Registrala</Link>. Si te invitaron a un equipo, abrí el enlace de la invitación.
          </p>
        )}
      </div>
    </main>
  );
}
