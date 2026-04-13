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
import { Loader2, LogIn, Mail, Lock } from "lucide-react";
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
        description: "Verifica tu email y contrasena",
      });
      return;
    }

    router.push(result.data.callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Correo Electronico
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <Mail className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="email"
            name="email"
            type="email"
            placeholder="nombre@mareyreg.com"
            required
            autoComplete="email"
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Contrasena
          </Label>
          <button
            type="button"
            className="text-xs text-primary hover:underline font-medium"
          >
            Olvidaste tu contrasena?
          </button>
        </div>
        <InputGroup>
          <InputGroupAddon>
            <Lock className="h-4 w-4" />
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

      <div className="flex items-center space-x-2">
        <Checkbox id="remember" />
        <label
          htmlFor="remember"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Recordar dispositivo por 30 dias
        </label>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-sm font-semibold uppercase tracking-wider"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Iniciando sesion...
          </>
        ) : (
          <>
            Iniciar Sesion
            <LogIn className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
