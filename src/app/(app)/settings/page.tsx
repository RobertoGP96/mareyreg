"use client";

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
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { clearAllData } from "@/modules/core/actions/admin-actions";
import { toast } from "sonner";

export default function SettingsPage() {
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Configuracion</h1>

      <div className="bg-card p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-foreground mb-4">
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
  );
}
