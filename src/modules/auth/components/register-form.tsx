"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
      toast.error("Las contrasenas no coinciden");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres");
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
      <div className="space-y-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" name="fullName" placeholder="Juan Perez" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="admin@mareyreg.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contrasena</Label>
        <Input id="password" name="password" type="password" placeholder="********" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="********" required />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          "Registrar Administrador"
        )}
      </Button>
    </form>
  );
}
