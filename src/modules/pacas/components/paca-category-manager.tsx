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
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import {
  MoreHorizontal,
  SquarePen,
  Plus,
  Trash2,
  FolderTree,
  Tags,
  Search,
  ListFilter,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPacaCategory,
  updatePacaCategory,
  deletePacaCategory,
} from "../actions/paca-category-actions";

interface ClassificationItem {
  classificationId: number;
  name: string;
}

interface CategoryItem {
  categoryId: number;
  name: string;
  description: string | null;
  classificationId: number | null;
  classification: { name: string } | null;
}

interface Props {
  categories: CategoryItem[];
  classifications: ClassificationItem[];
}

const ALL = "__all__";
const NONE = "none";

export function PacaCategoryManager({ categories, classifications }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState<CategoryItem | null>(null);
  const [catToDelete, setCatToDelete] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classificationId, setClassificationId] = useState<string>(NONE);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return categories.filter((c) => {
      if (
        classFilter !== ALL &&
        String(c.classificationId ?? NONE) !== classFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false) ||
        (c.classification?.name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [categories, search, classFilter]);

  const orphans = categories.filter((c) => !c.classification).length;

  const resetForm = () => {
    setName("");
    setDescription("");
    setClassificationId(NONE);
  };

  const fillEdit = (c: CategoryItem) => {
    setName(c.name);
    setDescription(c.description ?? "");
    setClassificationId(c.classificationId ? String(c.classificationId) : NONE);
    setCatToEdit(c);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await createPacaCategory({
      name,
      description: description || undefined,
      classificationId: classificationId !== NONE ? Number(classificationId) : undefined,
    });
    setSubmitting(false);
    if (r.success) {
      setIsCreateOpen(false);
      toast.success("Categoría creada");
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!catToEdit) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await updatePacaCategory(catToEdit.categoryId, {
      name,
      description: description || undefined,
      classificationId: classificationId !== NONE ? Number(classificationId) : null,
    });
    setSubmitting(false);
    if (r.success) {
      setCatToEdit(null);
      toast.success("Categoría actualizada");
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!catToDelete) return;
    setSubmitting(true);
    const r = await deletePacaCategory(catToDelete);
    setSubmitting(false);
    if (r.success) {
      setCatToDelete(null);
      toast.success("Categoría eliminada");
      router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<CategoryItem>[] = [
    {
      key: "name",
      header: "Categoría",
      cell: (c) => (
        <div className="flex items-center gap-2 min-w-0">
          <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">{c.name}</span>
        </div>
      ),
    },
    {
      key: "classification",
      header: "Clasificación",
      cell: (c) =>
        c.classification ? (
          <Badge variant="outline">{c.classification.name}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Sin clasificación</span>
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fillEdit(c)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCatToDelete(c.categoryId)}
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
        title="Categorías de pacas"
        description="Catálogo de categorías SKU. Cada categoría puede agruparse bajo una clasificación."
        badge={`${categories.length} categorías`}
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
          Nueva categoría
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile label="Categorías" value={categories.length} icon={Tags} tone="active" />
        <MetricTile
          label="Clasificaciones"
          value={classifications.length}
          icon={FolderTree}
          tone="track"
        />
        <MetricTile
          label="Sin clasificación"
          value={orphans}
          icon={ListFilter}
          tone={orphans > 0 ? "warning" : "idle"}
        />
      </div>

      <ResponsiveListView<CategoryItem>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.categoryId}
        density="compact"
        mobileCard={(c) => (
          <MobileListCard
            key={c.categoryId}
            title={
              <span className="flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {c.name}
              </span>
            }
            subtitle={c.description ?? undefined}
            value={
              c.classification ? (
                <Badge variant="outline" className="text-[10px]">
                  {c.classification.name}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">Sin clasif.</span>
              )
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fillEdit(c)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setCatToDelete(c.categoryId)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        )}
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <InputGroup className="flex-1 min-w-[180px] max-w-md">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Buscar nombre o clasificación…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <Badge variant="brand">{filtered.length}</Badge>
                </InputGroupAddon>
              </InputGroup>
              <div className="md:hidden">
                <MobileFilterSheet
                  activeCount={classFilter !== ALL ? 1 : 0}
                  onClear={() => setClassFilter(ALL)}
                >
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Clasificación
                    </label>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger className="h-10 w-full text-sm">
                        <SelectValue placeholder="Clasificación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Todas</SelectItem>
                        <SelectItem value={NONE}>Sin clasificación</SelectItem>
                        {classifications.map((c) => (
                          <SelectItem key={c.classificationId} value={String(c.classificationId)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </MobileFilterSheet>
              </div>
            </div>
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros
              </div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
                  <SelectValue placeholder="Clasificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  <SelectItem value={NONE}>Sin clasificación</SelectItem>
                  {classifications.map((c) => (
                    <SelectItem key={c.classificationId} value={String(c.classificationId)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classFilter !== ALL && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setClassFilter(ALL)}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin categorías"
            description={
              search || classFilter !== ALL
                ? "No hay coincidencias."
                : "Crea la primera categoría para empezar."
            }
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!catToEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false);
            setCatToEdit(null);
            resetForm();
          }
        }}
        a11yTitle={catToEdit ? "Editar categoría" : "Nueva categoría"}
        description="Una categoría representa un SKU de pacas."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Tags}
          title={catToEdit ? "Editar categoría" : "Nueva categoría"}
          description="Una categoría representa un SKU de pacas."
        />
        <div className="space-y-4 mt-4">
            <FormSection icon={Tags} title="Datos">
              <Field label="Nombre" icon={Tags} required>
                <Input
                  placeholder="Ej. Hombre invierno premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Clasificación" icon={FolderTree}>
                <Select value={classificationId} onValueChange={setClassificationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin clasificación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin clasificación</SelectItem>
                    {classifications.map((c) => (
                      <SelectItem key={c.classificationId} value={String(c.classificationId)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descripción" icon={FileText}>
                <Textarea
                  rows={2}
                  placeholder="Notas opcionales"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                setCatToEdit(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={catToEdit ? handleUpdate : handleCreate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando…" : catToEdit ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </ResponsiveFormDialog>

      <AlertDialog open={!!catToDelete} onOpenChange={() => setCatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar si no tiene pacas asociadas en inventario, ventas o reservaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nueva categoría"
        onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
}
