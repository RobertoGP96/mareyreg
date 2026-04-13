import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/modules/auth/components/register-form";
import { getUserCount } from "@/modules/auth/queries/user-queries";

export default async function RegisterPage() {
  const count = await getUserCount();
  if (count > 0) {
    redirect("/login");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <img src="/truck.svg" alt="MAREYreg" className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl roadway-font">MAREYreg</CardTitle>
        <CardDescription>
          Configura el primer administrador del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
