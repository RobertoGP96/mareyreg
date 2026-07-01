"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { KeyRound, Plus, Ban, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { createWebstoreApiKey, revokeWebstoreApiKey } from "../actions/api-key-actions";

interface ApiKeyItem {
  apiKeyId: number;
  label: string;
  keyPrefix: string;
  isActive: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

export function ApiKeyListClient({ apiKeys }: { apiKeys: ApiKeyItem[] }) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const label = fd.get("label") as string;

    const result = await createWebstoreApiKey(label);
    setIsSubmitting(false);
    if (result.success) {
      setCreatedKey(result.data.rawKey);
      toast.success("API key creada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleRevoke = async () => {
    if (!toRevoke) return;
    setIsSubmitting(true);
    const result = await revokeWebstoreApiKey(toRevoke);
    setIsSubmitting(false);
    if (result.success) {
      setToRevoke(null);
      toast.success("API key revocada");
      router.refresh();
    } else toast.error(result.error);
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setCopied(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={KeyRound}
        title="API keys de la tienda en línea"
        description="Credenciales que usa la tienda web para enviar ventas y consultar el catálogo de Mareyway."
        badge={`${apiKeys.length} keys`}
        actions={
          <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva API key
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="divide-y divide-border/60">
          {apiKeys.length > 0 ? (
            apiKeys.map((k) => (
              <div
                key={k.apiKeyId}
                className={`flex items-start gap-4 px-5 py-4 ${!k.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <KeyRound className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{k.label}</h3>
                    <Badge variant="outline" className="font-mono">{k.keyPrefix}…</Badge>
                    {!k.isActive && <Badge variant="destructive">Revocada</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span>Creada: {new Date(k.createdAt).toLocaleDateString("es-MX")}</span>
                    {k.createdByName && <span>por {k.createdByName}</span>}
                    {k.lastUsedAt && (
                      <span>Último uso: {new Date(k.lastUsedAt).toLocaleString("es-MX")}</span>
                    )}
                    {!k.lastUsedAt && k.isActive && <span>Sin uso todavía</span>}
                  </div>
                </div>
                {k.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToRevoke(k.apiKeyId)}
                  >
                    <Ban className="h-4 w-4" /> Revocar
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay API keys"
                description="Crea una API key para que la tienda web pueda enviar ventas a Mareyway."
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(o) => !o && closeCreateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <FormDialogHeader icon={KeyRound} title="Nueva API key" description="Credencial para la tienda en línea." />
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copia esta key ahora — por seguridad no se volverá a mostrar.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <code className="flex-1 text-sm font-mono break-all">{createdKey}</code>
                <Button type="button" variant="outline" size="icon" onClick={copyKey}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="brand" onClick={closeCreateDialog}>Listo</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <Field label="Etiqueta" icon={KeyRound} required hint="Ej. 'Tienda producción' o 'Tienda staging'.">
                <Input name="label" required placeholder="Tienda producción" />
              </Field>
              <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={closeCreateDialog}>
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creando…" : "Crear API key"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRevoke} onOpenChange={() => setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar API key?</AlertDialogTitle>
            <AlertDialogDescription>
              La tienda dejará de poder usar esta key de inmediato. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Revocando…" : "Revocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
