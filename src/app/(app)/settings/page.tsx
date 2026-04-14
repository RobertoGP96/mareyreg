"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
import { clearAllData } from "@/modules/core/actions/admin-actions";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    const result = await clearAllData();
    setIsClearing(false);

    if (result.success) {
      toast.success("Todos los datos han sido eliminados");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold font-headline tracking-tight text-foreground">Configuracion</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isAdmin && (
          <Link href="/settings/users" className="block">
            <div className="bg-card p-4 rounded-lg shadow-sm border hover:border-primary transition-colors h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Usuarios</h2>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Gestiona los usuarios y permisos del sistema
              </p>
            </div>
          </Link>
        )}

        <div className="bg-card p-4 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Datos de la Base de Datos
          </h2>
          <p className="text-muted-foreground mb-4">
            Esta accion borrara permanentemente todos los conductores, vehiculos y
            viajes de la base de datos. Esta accion no se puede deshacer.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Borrar Todos los Datos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta accion borrara permanentemente todos los datos de la base de
                  datos. Esto incluye todos los conductores, vehiculos y viajes.
                  Esta accion no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} disabled={isClearing}>
                  {isClearing ? "Borrando..." : "Borrar Todo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
