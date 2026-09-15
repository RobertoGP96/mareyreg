"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LABEL = "mb-1.5 block text-[12px] font-semibold text-slate-500";

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

      <div className="mx-auto w-full max-w-[720px] px-5 pb-14 md:px-6">
        <div className="rounded-lg bg-canvas p-5 shadow-card md:p-6">
          <p className="eyebrow">Datos personales</p>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="perfil-nombre" className={LABEL}>
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
            <div>
              <label htmlFor="perfil-telefono" className={LABEL}>
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

          <div className="mt-6 border-t border-line-soft pt-5">
            <p className="eyebrow">Contacto y entrega</p>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="perfil-email" className={LABEL}>
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
              <div>
                <label htmlFor="perfil-direccion" className={LABEL}>
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

          <Button
            variant="solid"
            size="lg"
            onClick={handleSave}
            disabled={sending}
            className="mt-6 w-full"
          >
            {sending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
