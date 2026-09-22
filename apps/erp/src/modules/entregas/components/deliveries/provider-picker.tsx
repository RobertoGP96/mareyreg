"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { createDeliveryProvider } from "../../actions/provider-actions";
import type { ProviderPickerOption } from "../../queries/provider-queries";

interface Props {
  providers: ProviderPickerOption[];
  value: number | null;
  onChange: (provider: ProviderPickerOption | null) => void;
}

export function ProviderPicker({ providers, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [local, setLocal] = useState(providers);

  const selected = useMemo(
    () => local.find((p) => p.providerId === value) ?? null,
    [local, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return local;
    return local.filter((p) => p.name.toLowerCase().includes(q));
  }, [local, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim() ?? "";
    if (name.length < 2) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    try {
      const r = await createDeliveryProvider({ name, active: true });
      if (r.success) {
        const created: ProviderPickerOption = { providerId: r.data.providerId, name };
        setLocal((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(created);
        toast.success("Proveedor creado");
        setCreateOpen(false);
        setOpen(false);
        setSearch("");
      } else {
        toast.error(r.error);
      }
    } catch (error) {
      console.error("createDeliveryProvider:", error);
      toast.error("No se pudo crear el proveedor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              {selected ? (
                <span className="truncate">{selected.name}</span>
              ) : (
                <span className="text-muted-foreground">Sin proveedor</span>
              )}
            </span>
            <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]"
          align="start"
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sin resultados
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.providerId === value;
                return (
                  <button
                    key={p.providerId}
                    type="button"
                    onClick={() => {
                      onChange(p);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2",
                      isSelected && "bg-accent/60"
                    )}
                  >
                    <Check
                      className={cn("w-4 h-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <span className="font-medium truncate">{p.name}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2 border-t flex gap-2">
            {value != null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Limpiar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={() => {
                setCreateOpen(true);
                setOpen(false);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Nuevo proveedor
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="name" required autoFocus defaultValue={search} maxLength={120} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar proveedor
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
