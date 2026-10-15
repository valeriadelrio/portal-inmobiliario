"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { saveAgency, saveMyProfile } from "./actions";

type AgencyValues = { name: string; description: string; phone: string; email: string; website: string; address: string; logoUrl: string };
type ProfileValues = { displayName: string; bio: string; photoUrl: string; publicPhone: string; publicWhatsapp: string; publicEmail: string };

export function AgencyForm({ v }: { v: AgencyValues }) {
  const [state, action, pending] = useActionState(saveAgency, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="label sm:col-span-2">Nombre<input name="name" defaultValue={v.name} required minLength={2} className="input" /></label>
      <label className="label sm:col-span-2">Descripción
        <textarea name="description" defaultValue={v.description} rows={3} maxLength={2000} className="input" />
      </label>
      <label className="label">Teléfono<input name="phone" defaultValue={v.phone} className="input" /></label>
      <label className="label">Email<input name="email" type="email" defaultValue={v.email} className="input" /></label>
      <label className="label">Sitio web<input name="website" type="url" defaultValue={v.website} placeholder="https://" className="input" /></label>
      <label className="label">Dirección<input name="address" defaultValue={v.address} className="input" /></label>
      <label className="label sm:col-span-2">Logo (enlace a la imagen)
        <input name="logoUrl" type="url" defaultValue={v.logoUrl} placeholder="https://" className="input" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary">Guardar inmobiliaria</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ProfileForm({ v }: { v: ProfileValues }) {
  const [state, action, pending] = useActionState(saveMyProfile, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="label sm:col-span-2">Nombre público<input name="displayName" defaultValue={v.displayName} required minLength={2} className="input" /></label>
      <label className="label sm:col-span-2">Sobre mí
        <textarea name="bio" defaultValue={v.bio} rows={3} maxLength={1000} className="input" />
      </label>
      <label className="label">WhatsApp
        <input name="publicWhatsapp" defaultValue={v.publicWhatsapp} inputMode="numeric" placeholder="5492494123456" className="input" />
        <span className="muted text-xs font-normal">Código de país + número, sin + ni espacios. Es el que usa el botón de WhatsApp.</span>
      </label>
      <label className="label">Teléfono público<input name="publicPhone" defaultValue={v.publicPhone} className="input" /></label>
      <label className="label">Email público<input name="publicEmail" type="email" defaultValue={v.publicEmail} className="input" /></label>
      <label className="label">Foto (enlace)<input name="photoUrl" type="url" defaultValue={v.photoUrl} placeholder="https://" className="input" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary">Guardar mi perfil</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
