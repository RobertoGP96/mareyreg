"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthDivider, GoogleSignIn } from "@/components/google-sign-in";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="flex flex-1 flex-col items-center px-5 py-12 md:px-10 md:py-20">
      <div className="w-full max-w-[420px]">
        <Link
          href="/perfil"
          className="nav-label -ml-0.5 inline-flex items-center gap-1 text-slate-400 transition-colors duration-150 hover:text-navy-900"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
          Volver
        </Link>

        <p className="eyebrow mt-10">Hola de nuevo</p>
        <h1 className="font-display mt-4 text-[32px] leading-none text-navy-900 md:text-[42px]">
          Iniciar sesión
        </h1>
        <p className="mt-5 text-[13.5px] leading-[1.65] text-slate-500">
          Entra a tu cuenta para seguir tus pedidos y guardar tus datos.
        </p>

        <div className="mt-10 flex flex-col gap-7 border-t border-line pt-8">
          <GoogleSignIn />
          <AuthDivider label="o con tu teléfono" />
          <div className="flex flex-col gap-2.5">
            <label htmlFor="login-telefono" className="eyebrow">
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
          <div className="flex flex-col gap-2.5">
            <label htmlFor="login-password" className="eyebrow">
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
          className="mt-8 w-full"
        >
          Entrar
        </Button>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-line pt-8">
          <p className="text-[13px] text-slate-500">¿No tienes cuenta?</p>
          <ButtonLink href="/registro">Crear cuenta</ButtonLink>
        </div>
      </div>
    </div>
  );
}
