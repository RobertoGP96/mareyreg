"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";
import { AuthDivider, GoogleSignIn } from "@/components/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LABEL = "mb-1.5 block text-[12px] font-semibold text-slate-500";

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
    <div className="mx-auto w-full max-w-[420px] px-5 py-8 md:px-6 md:py-12">
      <Link
        href="/perfil"
        className="nav-label -ml-1 inline-flex items-center gap-0.5 text-slate-500 transition-colors duration-150 hover:text-navy-700"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Volver
      </Link>

      <div className="mt-4 rounded-lg bg-canvas p-6 shadow-card md:p-8">
        <p className="eyebrow">Bienvenido</p>
        <h1 className="font-display mt-2 text-[26px] leading-[1.05] text-navy-900 md:text-[30px]">
          Crear cuenta
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
          Regístrate en un minuto y guarda tus datos para la próxima compra.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <GoogleSignIn label="Registrarme con Google" />
          <AuthDivider label="o con tus datos" />
          <div>
            <label htmlFor="registro-nombre" className={LABEL}>
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
          <div>
            <label htmlFor="registro-telefono" className={LABEL}>
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
          <div>
            <label htmlFor="registro-password" className={LABEL}>
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
          <p className="text-[12.5px] leading-[1.65] text-pretty text-slate-400">
            Al crear tu cuenta aceptas los términos y condiciones de la tienda.
          </p>
        </div>

        <Button
          variant="solid"
          size="lg"
          onClick={handleRegister}
          disabled={sending}
          className="mt-2 w-full"
        >
          {sending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-semibold text-navy-700 transition-colors duration-150 hover:text-navy-600"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
