"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthDivider, GoogleSignIn } from "@/components/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LABEL = "mb-1.5 block text-[12px] font-semibold text-slate-500";

export default function LoginPage() {
  const router = useRouter();
  const { state, setProfile, showToast } = useStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (!phone.trim()) {
      showToast("Escribe tu teléfono");
      return;
    }
    setProfile({
      name: state.profile?.name || "Cliente",
      phone: phone.trim(),
      ...(state.profile?.email ? { email: state.profile.email } : {}),
      ...(state.profile?.address ? { address: state.profile.address } : {}),
    });
    showToast("Sesión iniciada");
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
        <p className="eyebrow">Hola de nuevo</p>
        <h1 className="font-display mt-2 text-[26px] leading-[1.05] text-navy-900 md:text-[30px]">
          Iniciar sesión
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.65] text-pretty text-slate-500">
          Entra a tu cuenta para seguir tus pedidos y guardar tus datos.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <GoogleSignIn />
          <AuthDivider label="o con tu teléfono" />
          <div>
            <label htmlFor="login-telefono" className={LABEL}>
              Teléfono
            </label>
            <Input
              id="login-telefono"
              variant="box"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="login-password" className={LABEL}>
              Contraseña
            </label>
            <Input
              id="login-password"
              variant="box"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              type="password"
              autoComplete="current-password"
            />
          </div>
          <p className="text-[12.5px] text-slate-400">
            ¿Olvidaste tu contraseña?
          </p>
        </div>

        <Button
          variant="solid"
          size="lg"
          onClick={handleLogin}
          className="mt-2 w-full"
        >
          Entrar
        </Button>
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link
          href="/registro"
          className="font-semibold text-navy-700 transition-colors duration-150 hover:text-navy-600"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
