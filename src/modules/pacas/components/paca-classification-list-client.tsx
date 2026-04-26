"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
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
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  FolderTree,
  Tags,
  Plus,
  Search,
  MoreHorizontal,
  SquarePen,
  Trash2,
  ArrowUpDown,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPacaClassification,
  updatePacaClassification,
  deletePacaClassification,
} from "../actions/paca-classification-actions";
import type { PacaClassificationRow } from "../queries/paca-classification-queries";

interface Props {
  initialClassifications: PacaClassificationRow[];
}

export function PacaClassificationListClient({ initialClassifications }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<PacaClassificationRow | null>(null);
  const [toDelete, setToDelete] = useState<PacaClassificationRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialClassifications;
    return initialClassifications.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false)
    );
  }, [initialClassifications, search]);

  const totalCategories = initialClassifications.reduce(
    (acc, c) => acc + c.categoriesCount,
    0
  );
  const empty = initialClassifications.filter((c) => c.categoriesCount === 0).length;

  const resetForm = () => {
    setName("");
    setDescription("");
    setSortOrder("0");
  };
  const fillEditForm = (c: PacaClassificationRow) => {
    setName(c.name);
    setDescription(c.description ?? "");
    setSortOrder(String(c.sortOrder));
    setToEdit(c);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await createPacaClassification({
      name,
      description: description || null,
      sortOrder: Number(sortOrder) || 0,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Clasificación creada");
      setIsCreateOpen(false);
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await updatePacaClassification(toEdit.classificationId, {
      name,
      description: description || null,
      sortOrder: Number(sortOrder) || 0,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Clasificación actualizada");
      setToEdit(null);
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deletePacaClassification(toDelete.classificationId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Clasificación eliminada");
      setToDelete(null);
      router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<PacaClassificationRow>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (c) => (
        <div className="flex items-center gap-2 min-w-0">
          <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">{c.name}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      cell: (c) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {c.description ?? "—"}
        </span>
      ),
    },
    {
      key: "categories",
      header: "Categorías",
      align: "right",
      cell: (c) =>
        c.categoriesCount > 0 ? (
          <Badge variant="brand">{c.categoriesCount}</Badge>
        ) : (
          <Badge variant="outline">0</Badge>
        ),
    },
    {
      key: "order",
      header: "Orden",
      align: "right",
      cell: (c) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {c.sortOrder}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => fillEditForm(c)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToDelete(c)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Tags}
        title="Clasificaciones"
        description="Agrupadores padres de las categorías de pacas (p. ej. Hombre, Mujer, Mixto)."
        badge={`${initialClassifications.length} clasificaciones`}
      >
        <Button
          variant="brand"
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="hidden md:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nueva clasificación
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile
          label="Clasificaciones"
          value={initialClassifications.length}
          icon={Tags}
          tone="active"
        />
        <MetricTile
          label="Categorías totales"
          value={totalCategories}
          icon={FolderTree}
          tone="track"
        />
        <MetricTile
          label="Sin categorías"
          value={empty}
          icon={ArrowUpDown}
          tone={empty > 0 ? "warning" : "idle"}
        />
      </div>

      <ResponsiveListView<PacaClassificationRow>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.classificationId}
        mobileCard={(c) => (
          <MobileListCard
            key={c.classificationId}
            title={
              <span className="flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {c.name}
              </span>
            }
            subtitle={c.description ?? undefined}
            value={
              c.categoriesCount > 0 ? (
                <Badge variant="brand" className="text-[10px]">
                  {c.categoriesCount} cat.
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">0 cat.</Badge>
              )
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => fillEditForm(c)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(c)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                Orden: {c.sortOrder}
              </span>
            }
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar nombre o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        }
        emptyState={
          <EmptyState
            title="Sin clasificaciones"
            description={
              search
                ? "No hay coincidencias con la búsqueda."
                : "Crea la primera clasificación para agrupar tus categorías."
            }
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false);
            setToEdit(null);
            resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar clasificación" : "Nueva clasificación"}
        description="Las clasificaciones agrupan categorías de pacas."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Tags}
          title={toEdit ? "Editar clasificación" : "Nueva clasificación"}
          description="Las clasificaciones agrupan categorías de pacas."
        />
        <div className="space-y-4 mt-4">
            <FormSection icon={Tags} title="Datos">
              <Field label="Nombre" icon={Tags} required>
                <Input
                  placeholder="Ej. Hombre, Mujer, Mixto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Descripción" icon={FileText}>
                <Textarea
                  rows={2}
                  placeholder="Notas opcionales"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label="Orden" icon={ArrowUpDown} hint="Menor número aparece primero.">
                <Input
                  type="number"
                  step="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </Field>
            </FormSection>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setToEdit(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={toEdit ? handleUpdate : handleCreate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar clasificación?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.categoriesCount
                ? `Esta clasificación tiene ${toDelete.categoriesCount} categoría(s) asociada(s) y no puede eliminarse.`
                : `Se eliminará "${toDelete?.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || (toDelete?.categoriesCount ?? 0) > 0}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nueva clasificación"
        onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
}
