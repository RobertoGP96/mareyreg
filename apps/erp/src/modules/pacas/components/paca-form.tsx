"use client";

import { useMemo, useState } from "react";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { cn } from "@/lib/utils";
import {
  Package2,
  Hash,
  FolderTree,
  CircleDollarSign,
  CalendarDays,
  Store,
  Globe,
  NotebookPen,
  Loader2,
  Search,
  Filter,
  ChevronsUpDown,
  Check,
} from "lucide-react";

interface CategoryOption {
  categoryId: number;
  name: string;
  classification: { classificationId: number; name: string } | null;
}

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    categoryId: number;
    quantity: number;
    purchasePrice?: number;
    supplier?: string;
    origin?: string;
    arrivalDate?: string;
    notes?: string;
  }) => void;
  isLoading: boolean;
  categories: CategoryOption[];
}

export function PacaEntryForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  categories,
}: EntryFormProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const classifications = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => {
      if (c.classification) map.set(c.classification.classificationId, c.classification.name);
    });
    return Array.from(map.entries()).map(([classificationId, name]) => ({ classificationId, name }));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((c) => {
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.classification?.name.toLowerCase().includes(term) ?? false);
      const matchesClassification =
        classificationFilter === "all" ||
        (classificationFilter === "none"
          ? c.classification == null
          : c.classification?.classificationId === Number(classificationFilter));
      return matchesSearch && matchesClassification;
    });
  }, [categories, search, classificationFilter]);

  const selected = useMemo(
    () => categories.find((c) => c.categoryId === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const resetState = () => {
    setSelectedCategoryId(null);
    setSearch("");
    setClassificationFilter("all");
    setPickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      categoryId: Number(fd.get("categoryId")),
      quantity: Number(fd.get("quantity")),
      purchasePrice: fd.get("purchasePrice") ? Number(fd.get("purchasePrice")) : undefined,
      supplier: (fd.get("supplier") as string) || undefined,
      origin: (fd.get("origin") as string) || undefined,
      arrivalDate: (fd.get("arrivalDate") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetState();
      }}
      a11yTitle="Registrar entrada de pacas"
      description="Añade pacas al inventario indicando categoría y cantidad."
    >
      <FormDialogHeader
        icon={Package2}
        title="Registrar entrada de pacas"
        description="Añade pacas al inventario indicando categoría y cantidad."
      />
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <FormSection icon={FolderTree} title="Clasificación" description="Categoría y cantidad recibida.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Categoría" icon={FolderTree} required>
                <input type="hidden" name="categoryId" value={selectedCategoryId ?? ""} required />
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      className={cn(
                        "w-full justify-between font-normal",
                        !selected && "text-muted-foreground"
                      )}
                    >
                      {selected ? (
                        <span className="flex items-center gap-2 truncate">
                          {selected.classification && (
                            <Badge variant="secondary" className="shrink-0">
                              {selected.classification.name}
                            </Badge>
                          )}
                          <span className="truncate">{selected.name}</span>
                        </span>
                      ) : (
                        <span>Seleccionar...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-3 space-y-3"
                  >
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <Search />
                      </InputGroupAddon>
                      <InputGroupInput
                        placeholder="Buscar categoría..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>

                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <Filter />
                      </InputGroupAddon>
                      <Select
                        value={classificationFilter}
                        onValueChange={setClassificationFilter}
                      >
                        <SelectTrigger className="flex-1 rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 dark:bg-transparent">
                          <SelectValue placeholder="Filtrar por clasificación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las clasificaciones</SelectItem>
                          {classifications.map((cls) => (
                            <SelectItem key={cls.classificationId} value={String(cls.classificationId)}>
                              {cls.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="none">Sin clasificación</SelectItem>
                        </SelectContent>
                      </Select>
                    </InputGroup>

                    <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                      {filteredCategories.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No se encontraron categorías
                        </div>
                      ) : (
                        <ul className="py-1">
                          {filteredCategories.map((c) => {
                            const isSelected = c.categoryId === selectedCategoryId;
                            return (
                              <li key={c.categoryId}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategoryId(c.categoryId);
                                    setPickerOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                                    isSelected && "bg-accent/60"
                                  )}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    {c.classification ? (
                                      <Badge variant="secondary" className="shrink-0">
                                        {c.classification.name}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                        Sin clasificar
                                      </Badge>
                                    )}
                                    <span className="truncate">{c.name}</span>
                                  </span>
                                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </Field>
              <Field label="Cantidad" icon={Hash} required>
                <Input name="quantity" type="number" min="1" required placeholder="Ej. 10" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Datos comerciales" description="Costo y detalles de llegada.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Precio de compra (unidad)" icon={CircleDollarSign}>
                <Input name="purchasePrice" type="number" step="0.01" placeholder="Ej. 25.00" />
              </Field>
              <Field label="Fecha de llegada" icon={CalendarDays}>
                <Input name="arrivalDate" type="date" />
              </Field>
              <Field label="Proveedor" icon={Store}>
                <Input name="supplier" placeholder="Nombre del proveedor" />
              </Field>
              <Field label="Origen" icon={Globe}>
                <Input name="origin" placeholder="País o región" />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={NotebookPen} title="Notas" description="Observaciones adicionales (opcional).">
            <Textarea name="notes" placeholder="Observaciones, defectos visibles, estado general…" />
          </FormSection>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={isLoading || !selectedCategoryId}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Registrando..." : "Registrar entrada"}
            </Button>
          </div>
      </form>
    </ResponsiveFormDialog>
  );
}
