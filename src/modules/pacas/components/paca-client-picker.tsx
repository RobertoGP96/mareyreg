"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createPacaClient,
  type PacaClientInput,
} from "../actions/paca-client-actions";

export interface PacaClientOption {
  clientId: number;
  name: string;
  phone: string | null;
  email: string | null;
}

interface PacaClientPickerProps {
  clients: PacaClientOption[];
  value: number | null;
  onChange: (client: PacaClientOption | null) => void;
}

export function PacaClientPicker({ clients, value, onChange }: PacaClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localClients, setLocalClients] = useState(clients);

  const selected = useMemo(
    () => localClients.find((c) => c.clientId === value) ?? null,
    [localClients, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localClients;
    return localClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [localClients, search]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: PacaClientInput = {
      name: fd.get("name") as string,
      phone: (fd.get("phone") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    };
    setIsSubmitting(true);
    const result = await createPacaClient(data);
    setIsSubmitting(false);
    if (result.success && result.data) {
      const newClient: PacaClientOption = {
        clientId: result.data.clientId,
        name: result.data.name,
        phone: result.data.phone,
        email: result.data.email,
      };
      setLocalClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(newClient);
      toast.success("Cliente creado");
      setCreateOpen(false);
      setOpen(false);
    } else if (!result.success) {
      toast.error(result.error);
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
                  {selected.name}
                  {selected.phone && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {selected.phone}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Seleccionar cliente...</span>
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
                placeholder="Buscar cliente..."
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
              filtered.map((c) => {
                const isSelected = c.clientId === value;
                return (
                  <button
                    key={c.clientId}
                    type="button"
                    onClick={() => {
                      onChange(c);
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
                      <p className="font-medium truncate">{c.name}</p>
                      {(c.phone || c.email) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.phone, c.email].filter(Boolean).join(" · ")}
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
              <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input name="name" required autoFocus defaultValue={search} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input name="phone" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea name="notes" rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar cliente
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
