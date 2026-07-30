"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const { setProfile, showToast } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);

  const handleRegister = async () => {
    if (sending) return;
    if (!name.trim() || !phone.trim()) {
      showToast("Completa nombre y teléfono");
      return;
    }
    const profile = { name: name.trim(), phone: phone.trim() };
    setProfile(profile);
    showToast("Cuenta creada, bienvenido");

    setSending(true);
    try {
      const result = await syncProfile(profile);
      if (result.success) {
        setProfile({ ...profile, erpCustomerId: result.data.customerId });
      } else {
        console.warn("syncProfile en registro falló:", result.error);
      }
    } catch (e) {
      console.warn("syncProfile en registro lanzó:", e);
    } finally {
      setSending(false);
    }

    router.push("/perfil");
  };

  return (
    <div className="flex flex-1 flex-col items-center px-5 py-12 md:px-10 md:py-20">
      <div className="w-full max-w-[420px]">
        <Link
          href="/perfil"
          className="nav-label -ml-0.5 inline-flex items-center gap-1 text-slate-400 transition-colors duration-150 hover:text-navy-900"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          Volver
        </Link>

        <p className="eyebrow mt-10">Bienvenido</p>
        <h1 className="font-display mt-4 text-[32px] leading-none text-navy-900 md:text-[42px]">
          Crear cuenta
        </h1>
        <p className="mt-5 text-[13.5px] leading-[1.65] text-slate-500">
          Regístrate en un minuto y guarda tus datos para la próxima compra.
        </p>

        <div className="mt-10 flex flex-col gap-6 border-t border-line pt-8">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="registro-nombre" className="eyebrow">
              Nombre y apellidos
            </label>
            <Input
              id="registro-nombre"
              variant="box"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="registro-telefono" className="eyebrow">
              Teléfono
            </label>
            <Input
              id="registro-telefono"
              variant="box"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              autoComplete="tel"
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="registro-password" className="eyebrow">
              Contraseña
            </label>
            <Input
              id="registro-password"
              variant="box"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <p className="text-[12.5px] leading-[1.65] text-slate-400">
            Al crear tu cuenta aceptas los términos y condiciones de la tienda.
          </p>
        </div>

        <Button
          variant="solid"
          size="lg"
          onClick={handleRegister}
          disabled={sending}
          className="mt-8 w-full"
        >
          {sending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-line pt-8">
          <p className="text-[13px] text-slate-500">¿Ya tienes cuenta?</p>
          <ButtonLink href="/login">Iniciar sesión</ButtonLink>
        </div>
      </div>
    </div>
  );
}
