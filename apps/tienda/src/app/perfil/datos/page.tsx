"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <ScreenHeader eyebrow="Mi cuenta" title="Mis datos" backHref="/perfil" />

      <div className="w-full max-w-[520px] px-5 py-10 md:px-10">
        <p className="eyebrow">Datos personales</p>
        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="perfil-nombre" className="eyebrow">
              Nombre y apellidos
            </label>
            <Input
              id="perfil-nombre"
              variant="box"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="perfil-telefono" className="eyebrow">
              Teléfono
            </label>
            <Input
              id="perfil-telefono"
              variant="box"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <p className="eyebrow">Contacto y entrega</p>
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <label htmlFor="perfil-email" className="eyebrow">
                Correo electrónico
              </label>
              <Input
                id="perfil-email"
                variant="box"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                type="email"
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <label htmlFor="perfil-direccion" className="eyebrow">
                Dirección de entrega
              </label>
              <Input
                id="perfil-direccion"
                variant="box"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección de entrega"
                autoComplete="street-address"
              />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <Button
            variant="solid"
            size="lg"
            onClick={handleSave}
            disabled={sending}
            className="w-full"
          >
            {sending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
