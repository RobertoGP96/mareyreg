"use client";

import { GOOGLE_CLIENT_ID } from "@/lib/config";
import { useStore } from "@/lib/store";

/** Logo de Google: es un activo de marca, así que conserva sus colores fijos y
 *  NO se tematiza. Es la única excepción a la regla de "cero hex" del sistema;
 *  alterarlo incumpliría las directrices de uso del botón de acceso. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] flex-none" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface GoogleSignInProps {
  label?: string;
}

/** Punto único de integración con OAuth.
 *
 *  La tienda todavía no tiene proveedor de sesión: el "login" actual solo
 *  escribe el perfil en localStorage. Conectar Google de verdad pide, además
 *  del client id, un proveedor real (next-auth u OAuth propio), su ruta de
 *  callback y sincronizar el cliente contra el ERP vía `syncProfile`.
 *
 *  Mientras eso no exista, el botón lo dice en voz alta en lugar de simular una
 *  sesión iniciada: un acceso falso sería indistinguible de uno real para quien
 *  lo pruebe, y acabaría en producción sin que nadie lo note. */
export function GoogleSignIn({
  label = "Continuar con Google",
}: GoogleSignInProps) {
  const { showToast } = useStore();

  const handleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast("Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      return;
    }
    showToast("El acceso con Google aún no está conectado");
    console.warn(
      "GoogleSignIn: hay client id pero no hay proveedor OAuth montado en la tienda."
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center gap-3 border border-line bg-canvas px-5 py-3.5 text-[12.5px] font-semibold tracking-[.06em] text-ink transition-colors duration-150 hover:border-navy-900"
    >
      <GoogleMark />
      {label}
    </button>
  );
}

/** Separador entre el acceso federado y el formulario. */
export function AuthDivider({ label = "o" }: { label?: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
