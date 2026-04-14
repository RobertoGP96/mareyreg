"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field } from "@/components/ui/field";
import { toast } from "sonner";
import { Loader2, UserRound, AtSign, KeyRound, UserRoundPlus } from "lucide-react";
import { registerInitialAdmin } from "../actions/auth-actions";

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    const result = await registerInitialAdmin({ email, password, fullName });
    setIsLoading(false);

    if (result.success) {
      toast.success("Administrador registrado exitosamente");
      router.push("/login");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field id="fullName" label="Nombre completo" icon={UserRound} required>
        <InputGroup>
          <InputGroupAddon>
            <UserRound className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput id="fullName" name="fullName" placeholder="Juan Pérez" required />
        </InputGroup>
      </Field>

      <Field id="email" label="Correo electrónico" icon={AtSign} required>
        <InputGroup>
          <InputGroupAddon>
            <AtSign className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput id="email" name="email" type="email" placeholder="admin@mareyway.com" required />
        </InputGroup>
      </Field>

      <Field id="password" label="Contraseña" icon={KeyRound} required hint="Mínimo 6 caracteres.">
        <InputGroup>
          <InputGroupAddon>
            <KeyRound className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput id="password" name="password" type="password" placeholder="••••••••" required />
        </InputGroup>
      </Field>

      <Field id="confirmPassword" label="Confirmar contraseña" icon={KeyRound} required>
        <InputGroup>
          <InputGroupAddon>
            <KeyRound className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required />
        </InputGroup>
      </Field>

      <Button type="submit" variant="brand" size="lg" className="w-full h-11 mt-2" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Registrando…
          </>
        ) : (
          <>
            Crear administrador
            <UserRoundPlus className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
