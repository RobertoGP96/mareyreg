import { Suspense } from "react";
import { LoginForm } from "@/modules/auth/components/login-form";
import { Shield } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Warm header */}
      <div className="bg-muted py-10 flex flex-col items-center gap-3 border-b">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-background border">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground roadway-font tracking-wide">
            MAREYREG
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.25em] mt-1">
            Sistema de Gestion
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 flex items-start justify-center px-4 -mt-6">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-xl border p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                Autenticacion del Sistema
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresa tus credenciales para acceder al sistema.
              </p>
            </div>

            <Suspense>
              <LoginForm />
            </Suspense>

            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                El acceso no autorizado es estrictamente monitoreado y registrado.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              &copy; {new Date().getFullYear()} MAREYreg. Sistema de Gestion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
