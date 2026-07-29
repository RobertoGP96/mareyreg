"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { syncProfile } from "@/app/actions/customer-actions";
import { useStore } from "@/lib/store";

const inputClass =
  "rounded-xl border border-line bg-white p-3.5 text-sm text-ink placeholder:text-muted-2 transition-colors focus:border-brand focus:outline-none";

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
          <div className="text-[17px] font-bold">Crear cuenta</div>
        </div>
        <div className="mt-5 text-[23px] leading-[1.25] font-semibold">
          Bienvenido.
          <br />
          <span className="text-brand-soft">Regístrate en un minuto.</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-[22px] md:w-full md:max-w-md md:flex-none">
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
        <div className="text-xs leading-[1.45] text-muted">
          Al crear tu cuenta aceptas los términos y condiciones de la tienda.
        </div>
        <button
          type="button"
          onClick={handleRegister}
          disabled={sending}
          className={`grad-cta mt-1.5 rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white transition-colors ${
            sending ? "opacity-60" : "hover:opacity-90"
          }`}
        >
          {sending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
        <div className="mt-2 text-center text-[13px] text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-mid transition-colors hover:text-brand"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
