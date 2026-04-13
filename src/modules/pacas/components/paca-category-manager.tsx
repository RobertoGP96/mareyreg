"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreHorizontal, Pen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPacaCategory,
  updatePacaCategory,
  deletePacaCategory,
} from "../actions/paca-category-actions";

interface CategoryItem {
  categoryId: number;
  name: string;
  description: string | null;
}

interface Props {
  categories: CategoryItem[];
}

export function PacaCategoryManager({ categories }: Props) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState<CategoryItem | null>(null);
  const [catToDelete, setCatToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await createPacaCategory({
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Categoria creada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!catToEdit) return;
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const result = await updatePacaCategory(catToEdit.categoryId, {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      setCatToEdit(null);
      toast.success("Categoria actualizada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!catToDelete) return;
    setIsSubmitting(true);
    const result = await deletePacaCategory(catToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setCatToDelete(null);
      toast.success("Categoria eliminada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium">Categorias de Pacas</h2>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
        <div className="grid gap-3 p-6">
          {categories.length > 0 ? (
            categories.map((cat) => (
              <div
                key={cat.categoryId}
                className="bg-card border rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{cat.name}</p>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground">{cat.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCatToEdit(cat)}>
                      <Pen className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCatToDelete(cat.categoryId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <EmptyState title="No hay categorias" description="Crea la primera categoria de pacas." />
          )}
        </div>
      </div>

      {/* Create */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Input name="description" />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Categoria"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!catToEdit} onOpenChange={(o) => !o && setCatToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="name" defaultValue={catToEdit?.name} required />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Input name="description" defaultValue={catToEdit?.description ?? ""} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Actualizar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!catToDelete} onOpenChange={() => setCatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar si no tiene pacas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
