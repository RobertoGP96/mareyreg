"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2,
  AtSign,
  KeyRound,
  ArrowRight,
  Building2,
  UserRound,
} from "lucide-react";
import { registerInitialAdmin } from "../actions/auth-actions";

type Strength = 0 | 1 | 2 | 3 | 4;

function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  return Math.min(score, 4) as Strength;
}

const STRENGTH_LABELS = [
  { label: "Muy débil", color: "var(--destructive)" },
  { label: "Débil", color: "var(--destructive)" },
  { label: "Aceptable", color: "var(--warning)" },
  { label: "Buena", color: "var(--success)" },
  { label: "Excelente", color: "var(--success)" },
];

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthMeta = STRENGTH_LABELS[strength];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!acceptTerms) {
      toast.error("Debes aceptar los términos y condiciones");
      return;
    }

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const firstName = (formData.get("firstName") as string).trim();
    const lastName = (formData.get("lastName") as string).trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = formData.get("email") as string;
    const pwd = formData.get("password") as string;

    if (pwd.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      setIsLoading(false);
      return;
    }

    const result = await registerInitialAdmin({
      email,
      password: pwd,
      fullName,
    });
    setIsLoading(false);

    if (result.success) {
      toast.success("Administrador registrado exitosamente");
      router.push("/login");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field id="firstName" label="Nombre" required>
          <InputGroup>
            <InputGroupAddon>
              <UserRound className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="firstName"
              name="firstName"
              placeholder="Andrea"
              required
            />
          </InputGroup>
        </Field>

        <Field id="lastName" label="Apellido" required>
          <InputGroup>
            <InputGroupInput
              id="lastName"
              name="lastName"
              placeholder="Rivas"
              required
            />
          </InputGroup>
        </Field>
      </div>

      <Field id="email" label="Email corporativo" required>
        <InputGroup>
          <InputGroupAddon>
            <AtSign className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="email"
            name="email"
            type="email"
            placeholder="andrea@empresa.com"
            required
            autoComplete="email"
          />
        </InputGroup>
      </Field>

      <Field id="companyName" label="Empresa">
        <InputGroup>
          <InputGroupAddon>
            <Building2 className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            id="companyName"
            name="companyName"
            placeholder="Nombre de la empresa"
          />
        </InputGroup>
      </Field>

      <div className="space-y-1.5">
        <Field id="password" label="Contraseña" required>
          <InputGroup>
            <InputGroupAddon>
              <KeyRound className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </InputGroup>
        </Field>

        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors"
              style={{
                background:
                  i <= strength ? strengthMeta.color : "var(--muted)",
              }}
            />
          ))}
        </div>
        {password.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            Fortaleza:{" "}
            <strong style={{ color: strengthMeta.color }}>
              {strengthMeta.label}
            </strong>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-[12px] text-muted-foreground leading-relaxed pt-1 cursor-pointer">
        <Checkbox
          id="acceptTerms"
          checked={acceptTerms}
          onCheckedChange={(v) => setAcceptTerms(v === true)}
          className="mt-0.5"
        />
        <span>
          Acepto los{" "}
          <a href="#" className="text-[var(--brand)] font-medium hover:underline">
            términos y condiciones
          </a>{" "}
          y la política de privacidad de GrayRegistration.
        </span>
      </label>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full h-11 mt-2 font-semibold"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creando cuenta…
          </>
        ) : (
          <>
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
