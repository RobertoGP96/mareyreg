"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";
import { ScreenHeader } from "@/components/screen-header";

const inputClass =
  "rounded-xl border border-line bg-white p-3.5 text-sm text-ink placeholder:text-muted-2 transition-colors focus:border-brand focus:outline-none";

export default function DatosPage() {
  const router = useRouter();
  const { state, setProfile, showToast } = useStore();
  const profile = state.profile;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!state.hydrated || loaded) return;
    setLoaded(true);
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone);
      setEmail(profile.email ?? "");
      setAddress(profile.address ?? "");
    }
  }, [state.hydrated, loaded, profile]);

  if (state.hydrated && !profile) {
    router.replace("/perfil");
    return null;
  }

  const handleSave = async () => {
    if (sending) return;
    if (!name.trim() || !phone.trim()) {
      showToast("Completa nombre y teléfono");
      return;
    }

    const updated = {
      name: name.trim(),
      phone: phone.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(profile?.erpCustomerId != null
        ? { erpCustomerId: profile.erpCustomerId }
        : {}),
    };
    setProfile(updated);
    showToast("Datos actualizados");

    setSending(true);
    try {
      const result = await syncProfile(updated);
      if (result.success) {
        setProfile({ ...updated, erpCustomerId: result.data.customerId });
      } else {
        console.warn("syncProfile en datos falló:", result.error);
      }
    } catch (e) {
      console.warn("syncProfile en datos lanzó:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Mis datos" backHref="/perfil" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-[18px] md:mx-auto md:w-full md:max-w-2xl">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellidos"
          autoComplete="name"
          className={inputClass}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono"
          type="tel"
          autoComplete="tel"
          className={inputClass}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          type="email"
          autoComplete="email"
          className={inputClass}
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Dirección de entrega"
          autoComplete="street-address"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={sending}
          className={`grad-cta mt-1.5 rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white transition-colors ${
            sending ? "opacity-60" : "hover:opacity-90"
          }`}
        >
          {sending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
