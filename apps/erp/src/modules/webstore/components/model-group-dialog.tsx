"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Badge } from "@/components/ui/badge";
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
import { Layers, Search, Loader2, PackageSearch, Plus, Trash2, X } from "lucide-react";
import {
  createModelGroup,
  updateModelGroup,
  deleteModelGroup,
} from "@/modules/webstore/actions/model-group-actions";
import { modelGroupInputSchema } from "@/modules/webstore/lib/model-group-schemas";
import { isModelGroupStaleError } from "@/modules/webstore/lib/model-group-messages";
import type { CatalogRow } from "@/modules/webstore/queries/catalog-queries";
import type { ModelGroupRow } from "@/modules/webstore/queries/model-group-queries";

interface Props {
  open: boolean;
  group: ModelGroupRow | null;
  /** Producto con el que se arranca un grupo nuevo ("Modelos" desde una fila). */
  initialProduct: CatalogRow | null;
  rows: CatalogRow[];
  /** Eliminar exige admin en el servidor; sin el rol no se ofrece el botón. */
  isAdmin?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** El grupo cambió o desapareció en el servidor: el padre debe recargar datos. */
  onStale: () => void;
}

interface MemberDraft {
  productId: number;
  modelLabel: string;
  modelSortOrder: string;
}

/** Datos de presentación de un miembro: del catálogo si está activo, si no del grupo. */
interface MemberView {
  productId: number;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  webstoreEnabled: boolean;
  isActive: boolean;
  stockAvailable: number;
}

const MAX_CANDIDATES = 30;

export function ModelGroupDialog({
  open,
  group,
  initialProduct,
  rows,
  isAdmin = false,
  onOpenChange,
  onSaved,
  onStale,
}: Props) {
  const [name, setName] = useState("");
  const [optionLabel, setOptionLabel] = useState("Modelo");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [memberErrors, setMemberErrors] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setOptionLabel(group.optionLabel);
      setMembers(
        group.members.map((m) => ({
          productId: m.productId,
          modelLabel: m.modelLabel,
          modelSortOrder: String(m.modelSortOrder),
        }))
      );
    } else {
      setName(initialProduct?.name ?? "");
      setOptionLabel("Modelo");
      setMembers(
        initialProduct
          ? [{ productId: initialProduct.productId, modelLabel: "", modelSortOrder: "0" }]
          : []
      );
    }
    setMemberErrors({});
    setSearch("");
    setNewLabel("");
    setConfirmDelete(false);
  }, [open, group, initialProduct]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.productId, r])), [rows]);
  const groupMemberById = useMemo(
    () => new Map((group?.members ?? []).map((m) => [m.productId, m])),
    [group]
  );

  const viewFor = (productId: number): MemberView => {
    const row = rowById.get(productId);
    if (row) {
      return {
        productId,
        name: row.name,
        sku: row.sku,
        imageUrl: row.imageUrl,
        webstoreEnabled: row.webstoreEnabled,
        isActive: row.isActive,
        stockAvailable: row.stockAvailable,
      };
    }
    const gm = groupMemberById.get(productId);
    return {
      productId,
      name: gm?.name ?? `Producto #${productId}`,
      sku: gm?.sku ?? null,
      imageUrl: null,
      webstoreEnabled: gm?.webstoreEnabled ?? false,
      isActive: gm?.isActive ?? false,
      stockAvailable: gm?.stockAvailable ?? 0,
    };
  };

  const memberIds = useMemo(() => new Set(members.map((m) => m.productId)), [members]);

  // El primer miembro presente en el catálogo fija unit / isCatchWeight del grupo.
  const reference = useMemo(() => {
    for (const m of members) {
      const row = rowById.get(m.productId);
      if (row) return row;
    }
    return null;
  }, [members, rowById]);

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!r.sku || memberIds.has(r.productId) || r.isService) return false;
      if (r.modelGroupId != null && r.modelGroupId !== group?.groupId) return false;
      if (reference && (r.unit !== reference.unit || r.isCatchWeight !== reference.isCatchWeight)) {
        return false;
      }
      if (!term) return true;
      return r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term);
    });
    return list.slice(0, MAX_CANDIDATES);
  }, [rows, search, memberIds, reference, group]);

  const clearMemberError = (productId: number) => {
    setMemberErrors((prev) => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const updateMember = (productId: number, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m) => (m.productId === productId ? { ...m, ...patch } : m)));
    clearMemberError(productId);
  };

  const removeMember = (productId: number) => {
    setMembers((prev) => prev.filter((m) => m.productId !== productId));
    clearMemberError(productId);
  };

  /**
   * Zod solo da `issues[0].message`; con varios modelos hay que señalar cuál
   * falla: por índice (`members[i].modelLabel`) o, en el refine de etiquetas
   * repetidas, calculando qué productos comparten etiqueta.
   */
  const describeValidationIssue = (issue: {
    path: PropertyKey[];
    message: string;
  }): { message: string; errors: Record<number, string> } => {
    const [root, index] = issue.path;
    if (root === "members" && typeof index === "number" && members[index]) {
      const productId = members[index].productId;
      return {
        message: `«${viewFor(productId).name}»: ${issue.message}`,
        errors: { [productId]: issue.message },
      };
    }
    if (root === "members" && index === undefined) {
      const byLabel = new Map<string, number[]>();
      for (const m of members) {
        const key = m.modelLabel.trim().toLowerCase();
        if (!key) continue;
        byLabel.set(key, [...(byLabel.get(key) ?? []), m.productId]);
      }
      const duplicates = Array.from(byLabel.values()).filter((ids) => ids.length > 1);
      if (duplicates.length > 0) {
        const errors: Record<number, string> = {};
        for (const ids of duplicates) {
          for (const id of ids) errors[id] = "Etiqueta repetida";
        }
        const names = duplicates
          .flat()
          .map((id) => `«${viewFor(id).name}»`)
          .join(", ");
        return { message: `Etiqueta repetida en: ${names}`, errors };
      }
    }
    return { message: issue.message, errors: {} };
  };

  const addMember = (row: CatalogRow) => {
    const nextOrder = members.reduce((max, m) => Math.max(max, Number(m.modelSortOrder) || 0), -1) + 1;
    setMembers((prev) => [
      ...prev,
      { productId: row.productId, modelLabel: newLabel.trim(), modelSortOrder: String(nextOrder) },
    ]);
    setNewLabel("");
    setSearch("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = {
      name,
      optionLabel,
      members: members.map((m) => ({
        productId: m.productId,
        modelLabel: m.modelLabel,
        modelSortOrder: Number(m.modelSortOrder),
      })),
      ...(group ? { version: group.version } : {}),
    };
    const parsed = modelGroupInputSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (!issue) {
        toast.error("Revisa los datos del grupo");
        return;
      }
      const described = describeValidationIssue(issue);
      setMemberErrors(described.errors);
      toast.error(described.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = group ? await updateModelGroup(group.groupId, input) : await createModelGroup(input);
      if (res.success) {
        toast.success(group ? "Grupo de modelos actualizado" : "Grupo de modelos creado");
        onSaved();
      } else {
        toast.error(res.error);
        if (isModelGroupStaleError(res.error)) onStale();
      }
    } catch {
      toast.error(group ? "No se pudo actualizar el grupo." : "No se pudo crear el grupo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    setIsDeleting(true);
    try {
      const res = await deleteModelGroup(group.groupId);
      if (res.success) {
        toast.success("Grupo de modelos eliminado");
        setConfirmDelete(false);
        onSaved();
      } else {
        toast.error(res.error);
        if (isModelGroupStaleError(res.error)) {
          setConfirmDelete(false);
          onStale();
        }
      }
    } catch {
      toast.error("No se pudo eliminar el grupo.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderThumbnail = (view: MemberView) =>
    view.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={view.imageUrl}
        alt={view.name}
        className={cn(
          "h-10 w-10 rounded-md object-cover shrink-0 border border-border",
          !view.webstoreEnabled && "grayscale opacity-60"
        )}
      />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0 border border-border">
        <PackageSearch className="h-4 w-4 text-muted-foreground" />
      </div>
    );

  return (
    <>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={group ? "Editar grupo de modelos" : "Nuevo grupo de modelos"}
        description="Varios productos con SKU propio en una sola card de la tienda con selector."
        showHeader
        desktopMaxWidth="sm:max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection icon={Layers} title="Datos del grupo">
            <Field label="Nombre de la card" required hint="Lo que ve el cliente como título. Cada modelo conserva su nombre interno.">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="Ej. Camiseta básica"
              />
            </Field>
            <Field label="Eje del selector" required hint="Nombre de lo que cambia entre modelos.">
              <Input
                value={optionLabel}
                onChange={(e) => setOptionLabel(e.target.value)}
                required
                maxLength={40}
                placeholder="Modelo, Talla, Color"
              />
            </Field>
          </FormSection>

          <FormSection
            icon={Layers}
            title="Modelos"
            description={`${members.length} modelo(s) en el grupo`}
          >
            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Agrega al menos un producto como modelo.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => {
                  const view = viewFor(m.productId);
                  return (
                    <li
                      key={m.productId}
                      className="rounded-lg border border-border p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderThumbnail(view)}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {view.name}
                            </span>
                            {!view.webstoreEnabled && (
                              <Badge variant="warning" className="text-[10px]">
                                Oculto
                              </Badge>
                            )}
                            {!view.isActive && (
                              <Badge variant="destructive" className="text-[10px]">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {view.sku && <span className="truncate">{view.sku}</span>}
                            <span className="font-mono tabular-nums">Stock: {view.stockAvailable}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          title="Quitar del grupo"
                          aria-label={`Quitar ${view.name} del grupo`}
                          onClick={() => removeMember(m.productId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <Input
                          value={m.modelLabel}
                          onChange={(e) => updateMember(m.productId, { modelLabel: e.target.value })}
                          maxLength={40}
                          placeholder={`Etiqueta (${optionLabel || "Modelo"})`}
                          aria-label={`Etiqueta de ${view.name}`}
                          aria-invalid={memberErrors[m.productId] ? true : undefined}
                          aria-describedby={
                            memberErrors[m.productId] ? `member-error-${m.productId}` : undefined
                          }
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={m.modelSortOrder}
                          onChange={(e) => updateMember(m.productId, { modelSortOrder: e.target.value })}
                          className="font-mono tabular-nums"
                          aria-label={`Orden de ${view.name}`}
                          title="Orden"
                        />
                      </div>
                      {memberErrors[m.productId] && (
                        <p
                          id={`member-error-${m.productId}`}
                          className="text-[0.78rem] text-destructive"
                        >
                          {memberErrors[m.productId]}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </FormSection>

          <FormSection
            icon={Plus}
            title="Añadir modelo"
            description={
              reference
                ? `Solo productos con SKU, sueltos, en «${reference.unit}»${reference.isCatchWeight ? " y de peso variable" : ""}.`
                : "Solo productos con SKU que no estén en otro grupo."
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={40}
                placeholder={`Etiqueta del nuevo (${optionLabel || "Modelo"})`}
                aria-label="Etiqueta del nuevo modelo"
              />
            </div>
            <div className="max-h-[32vh] overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
              {candidates.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin productos compatibles.
                </p>
              ) : (
                candidates.map((r) => (
                  <div
                    key={r.productId}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40"
                  >
                    {renderThumbnail(viewFor(r.productId))}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                        {!r.webstoreEnabled && (
                          <Badge variant="warning" className="text-[10px]">
                            Oculto
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{r.sku}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => addMember(r)}
                    >
                      <Plus className="h-4 w-4" />
                      Añadir
                    </Button>
                  </div>
                ))
              )}
            </div>
          </FormSection>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-3 border-t border-border">
            {group && isAdmin && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar grupo
              </Button>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}
                {isSubmitting ? "Guardando…" : group ? "Guardar cambios" : "Crear grupo"}
              </Button>
            </div>
          </div>
        </form>
      </ResponsiveFormDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !isDeleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el grupo de modelos?</AlertDialogTitle>
            <AlertDialogDescription>
              Los productos vuelven a mostrarse como cards independientes en la tienda. No se
              borra ningún producto ni su stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
