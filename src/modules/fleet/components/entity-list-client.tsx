"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Search,
  Trash2,
  MoreHorizontal,
  Plus,
  Pen,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createEntity,
  updateEntity,
  deleteEntity,
} from "../actions/entity-actions";
import { EntityForm } from "./entity-form";
import type { Entity } from "@/types";

interface Props {
  initialEntities: Entity[];
}

export function EntityListClient({ initialEntities }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<number | null>(null);
  const [entityToEdit, setEntityToEdit] = useState<Entity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredEntities = initialEntities.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateEntity = async (data: { name: string }) => {
    setIsSubmitting(true);
    const result = await createEntity(data);
    setIsSubmitting(false);

    if (result.success) {
      setIsCreateDialogOpen(false);
      toast.success("Entidad creada exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleUpdateEntity = async (data: { name: string }) => {
    if (!entityToEdit) return;
    setIsSubmitting(true);
    const result = await updateEntity(entityToEdit.entityId, data);
    setIsSubmitting(false);

    if (result.success) {
      setEntityToEdit(null);
      toast.success("Entidad actualizada exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteEntity = async () => {
    if (!entityToDelete) return;
    setIsSubmitting(true);
    const result = await deleteEntity(entityToDelete);
    setIsSubmitting(false);

    if (result.success) {
      setEntityToDelete(null);
      toast.success("Entidad eliminada exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium text-foreground">
              Lista de Entidades
            </h2>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar entidades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filteredEntities.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {filteredEntities.length > 0 ? (
            filteredEntities.map((entity) => (
              <div
                key={entity.entityId}
                className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-muted">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {entity.name}
                    </h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEntityToEdit(entity)}
                        className="flex items-center space-x-2"
                      >
                        <Pen className="h-4 w-4" />
                        <span>Editar</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEntityToDelete(entity.entityId)}
                        className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Eliminar</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No hay entidades"
              description="No se encontraron entidades registradas."
            />
          )}
        </div>
      </div>

      <EntityForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateEntity}
        isLoading={isSubmitting}
      />

      <EntityForm
        open={!!entityToEdit}
        onOpenChange={(open) => !open && setEntityToEdit(null)}
        onSubmit={handleUpdateEntity}
        isLoading={isSubmitting}
        entity={entityToEdit}
      />

      <AlertDialog
        open={!!entityToDelete}
        onOpenChange={() => setEntityToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estas seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente la entidad. No se puede
              eliminar si tiene conductores asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntity}
              className="bg-red-600 hover:bg-red-700"
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
