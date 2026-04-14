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
import { Loader2, LogIn, AtSign, KeyRound } from "lucide-react";
import { loginUser } from "../actions/auth-actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-5">
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
            placeholder="nombre@mareyway.com"
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
            className="text-xs text-[var(--brand)] hover:underline font-medium"
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

      <div className="flex items-center gap-2">
        <Checkbox id="remember" />
        <label
          htmlFor="remember"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Recordar dispositivo por 30 días
        </label>
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full h-11 text-sm font-semibold"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Iniciando sesión…
          </>
        ) : (
          <>
            Iniciar sesión
            <LogIn className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
