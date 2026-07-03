"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";

const inputClass =
  "rounded-xl border border-line bg-white p-3.5 text-sm text-ink placeholder:text-muted-2 transition-colors focus:border-brand focus:outline-none";

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
    <div className="flex flex-1 flex-col md:items-center md:justify-center">
      <div className="grad-header rounded-b-[26px] px-5 pt-[18px] pb-[34px] text-white md:my-10 md:w-full md:max-w-md md:rounded-[26px] md:shadow-[0_12px_32px_rgba(10,31,63,.18)]">
        <div className="flex items-center gap-3">
          <Link
            href="/perfil"
            aria-label="Volver"
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="text-[17px] font-bold">Iniciar sesión</div>
        </div>
        <div className="mt-5 text-[23px] leading-[1.25] font-semibold">
          Hola de nuevo
          <br />
          <span className="text-brand-soft">Entra a tu cuenta.</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-[22px] md:w-full md:max-w-md md:flex-none">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono"
          type="tel"
          autoComplete="tel"
          className={inputClass}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
        <div className="text-right text-[12.5px] font-medium text-brand-mid">
          ¿Olvidaste tu contraseña?
        </div>
        <button
          type="button"
          onClick={handleLogin}
          className="grad-cta mt-1.5 rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white transition-colors hover:opacity-90"
        >
          Entrar
        </button>
        <div className="mt-2 text-center text-[13px] text-muted">
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-semibold text-brand-mid transition-colors hover:text-brand"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
