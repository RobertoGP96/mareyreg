"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
import { Search, Trash2, MoreHorizontal, Plus, Pen, Building2 } from "lucide-react";
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
    } else toast.error(result.error);
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
    } else toast.error(result.error);
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
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Building2}
        title="Entidades"
        description="Organizaciones o empresas que operan dentro del sistema."
        badge={`${initialEntities.length} registradas`}
      >
        <Button variant="brand" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva entidad
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar entidades…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filteredEntities.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="divide-y divide-border/60">
          {filteredEntities.length > 0 ? (
            filteredEntities.map((entity) => (
              <div
                key={entity.entityId}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04]"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <Building2 className="h-4.5 w-4.5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <h3 className="flex-1 font-semibold text-foreground truncate">
                  {entity.name}
                </h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setEntityToEdit(entity)}>
                      <Pen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setEntityToDelete(entity.entityId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay entidades"
                description={
                  searchQuery
                    ? `No se encontraron resultados para "${searchQuery}".`
                    : "Registra la primera entidad para empezar."
                }
              />
            </div>
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

      <AlertDialog open={!!entityToDelete} onOpenChange={() => setEntityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entidad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la entidad. No se puede eliminar si tiene conductores asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntity}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
