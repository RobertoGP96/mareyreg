"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";

const inputClass =
  "rounded-xl border border-line bg-white p-3.5 text-sm text-ink placeholder:text-muted-2";

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
    <div className="flex flex-1 flex-col">
      <div className="grad-header rounded-b-[26px] px-5 pt-[18px] pb-[34px] text-white">
        <div className="flex items-center gap-3">
          <Link href="/perfil" aria-label="Volver" className="text-base">
            ←
          </Link>
          <div className="text-[17px] font-bold">Iniciar sesión</div>
        </div>
        <div className="mt-5 text-[23px] leading-[1.25] font-semibold">
          Hola de nuevo 👋
          <br />
          <span className="text-brand-soft">Entra a tu cuenta.</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-[22px]">
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
          className="grad-cta mt-1.5 rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white"
        >
          Entrar
        </button>
        <div className="mt-2 text-center text-[13px] text-muted">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-brand-mid">
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
