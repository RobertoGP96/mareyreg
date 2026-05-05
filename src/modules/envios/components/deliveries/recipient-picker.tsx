"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check, ChevronsUpDown, Loader2, Plus, Search, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createRecipient } from "../../actions/recipient-actions";
import type { RecipientPickerOption } from "../../queries/recipient-queries";

interface Props {
  recipients: RecipientPickerOption[];
  value: number | null;
  onChange: (recipient: RecipientPickerOption | null) => void;
}

export function RecipientPicker({ recipients, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [local, setLocal] = useState(recipients);

  const selected = useMemo(
    () => local.find((r) => r.recipientId === value) ?? null,
    [local, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return local;
    return local.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q)
    );
  }, [local, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = (fd.get("fullName") as string)?.trim() ?? "";
    const phone = (fd.get("phone") as string)?.trim();
    const address = (fd.get("address") as string)?.trim();
    const mapUrl = (fd.get("mapUrl") as string)?.trim();
    if (fullName.length < 2) {
      toast.error("El nombre es requerido");
      return;
    }
    if (mapUrl) {
      try { new URL(mapUrl); } catch { toast.error("URL del mapa inválida"); return; }
    }
    setSubmitting(true);
    const r = await createRecipient({
      fullName,
      phone: phone || null,
      address: address || null,
      mapUrl: mapUrl || null,
      active: true,
    });
    setSubmitting(false);
    if (r.success) {
      const created: RecipientPickerOption = {
        recipientId: r.data.recipientId,
        fullName,
        phone: phone || null,
        address: address || null,
      };
      setLocal((prev) => [...prev, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      onChange(created);
      toast.success("Destinatario creado");
      setCreateOpen(false);
      setOpen(false);
      setSearch("");
    } else {
      toast.error(r.error);
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
              <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
              {selected ? (
                <span className="truncate">
                  {selected.fullName}
                  {selected.phone && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {selected.phone}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Seleccionar destinatario...</span>
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
                placeholder="Buscar destinatario..."
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
              filtered.map((r) => {
                const isSelected = r.recipientId === value;
                return (
                  <button
                    key={r.recipientId}
                    type="button"
                    onClick={() => {
                      onChange(r);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2",
                      isSelected && "bg-accent/60"
                    )}
                  >
                    <Check
                      className={cn(
                        "w-4 h-4 mt-0.5 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.fullName}</p>
                      {(r.phone || r.address) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[r.phone, r.address].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
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
              <Plus className="w-4 h-4 mr-1" /> Nuevo destinatario
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo destinatario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input name="fullName" required autoFocus defaultValue={search} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input name="phone" inputMode="tel" maxLength={40} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Textarea name="address" rows={2} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>URL del mapa</Label>
              <Input name="mapUrl" inputMode="url" placeholder="https://maps.google.com/..." maxLength={500} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar destinatario
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
