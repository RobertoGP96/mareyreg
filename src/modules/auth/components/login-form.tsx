"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "sonner";
import { Loader2, ArrowRight, AtSign, KeyRound } from "lucide-react";
import { loginUser, loginWithGoogle } from "../actions/auth-actions";

type LoginFormProps = {
  googleEnabled?: boolean;
};

export function LoginForm({ googleEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await loginUser({ email, password, callbackUrl });
    setIsLoading(false);

    if (!result.success) {
      toast.error("Credenciales incorrectas", {
        description: "Verifica tu email y contraseña",
      });
      return;
    }

    router.push(result.data.callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="space-y-1.5">
        <Label htmlFor="email">
          <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
          Correo electrónico
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <AtSign className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="email"
            name="email"
            type="email"
            placeholder="andrea@grayreg.com"
            required
            autoComplete="email"
          />
        </InputGroup>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            Contraseña
          </Label>
          <button
            type="button"
            className="text-[11.5px] text-[var(--brand)] hover:underline font-medium"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <InputGroup>
          <InputGroupAddon>
            <KeyRound className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="password"
            name="password"
            type="password"
            placeholder="••••••••••••"
            required
            autoComplete="current-password"
          />
        </InputGroup>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground cursor-pointer pt-1">
        <Checkbox id="remember" defaultChecked />
        <span>Mantener sesión iniciada por 30 días</span>
      </label>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full h-11 text-sm font-semibold mt-1.5"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Iniciando sesión…
          </>
        ) : (
          <>
            Entrar al sistema
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
          O CONTINÚA CON
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full h-11 text-sm font-semibold gap-2"
        disabled={!googleEnabled || isGoogleLoading}
        title={googleEnabled ? "Iniciar sesión con Google" : "Google auth no configurado"}
        onClick={async () => {
          if (!googleEnabled) return;
          setIsGoogleLoading(true);
          try {
            await loginWithGoogle(callbackUrl);
          } catch {
            toast.error("No se pudo iniciar sesión con Google");
            setIsGoogleLoading(false);
          }
        }}
      >
        {isGoogleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.5 12.27c0-.81-.07-1.59-.21-2.34H12v4.43h5.92a5.05 5.05 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.28-4.74 3.28-8.17z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.76c-.98.66-2.24 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.55H2.16v2.85A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.83 14.08a6.61 6.61 0 0 1 0-4.16V7.07H2.16a11 11 0 0 0 0 9.86l3.67-2.85z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.16 7.07l3.67 2.85C6.7 7.32 9.13 5.38 12 5.38z"
            />
          </svg>
        )}
        {googleEnabled ? "Iniciar con Google" : "Google (próximamente)"}
      </Button>
    </form>
  );
}
