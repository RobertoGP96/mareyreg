"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { KeyRound, Plus, Ban, Copy, Loader2, Check, RefreshCw, ShieldCheck, CalendarClock } from "lucide-react";
import { toast } from "@/lib/toast";
import { createWebstoreApiKey, revokeWebstoreApiKey } from "../actions/api-key-actions";
import { WEBSTORE_API_KEY_SCOPES, type WebstoreApiKeyScope } from "../lib/api-key-scopes";

const SCOPE_LABELS: Record<WebstoreApiKeyScope, string> = {
  read_catalog: "Leer catálogo",
  create_orders: "Crear órdenes",
};

const EXPIRY_OPTIONS = [
  { value: "none", label: "Sin expiración", days: null },
  { value: "30", label: "30 días", days: 30 },
  { value: "90", label: "90 días", days: 90 },
  { value: "365", label: "365 días", days: 365 },
] as const;

interface ApiKeyItem {
  apiKeyId: number;
  label: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  isActive: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

function isExpired(expiresAt: string | null): boolean {
  return expiresAt != null && new Date(expiresAt) < new Date();
}

function toValidScopes(scopes: string[]): WebstoreApiKeyScope[] {
  return scopes.filter((s): s is WebstoreApiKeyScope =>
    (WEBSTORE_API_KEY_SCOPES as readonly string[]).includes(s)
  );
}

/** Bloque "copia el secreto una vez" compartido entre creación y rotación. */
function SecretReveal({ rawKey, onDone }: { rawKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Copia esta key ahora — por seguridad no se volverá a mostrar.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <code className="flex-1 text-sm font-mono break-all">{rawKey}</code>
        <Button type="button" variant="outline" size="icon" onClick={copyKey}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex justify-end pt-2">
        <Button variant="brand" onClick={onDone}>Listo</Button>
      </div>
    </div>
  );
}

export function ApiKeyListClient({ apiKeys }: { apiKeys: ApiKeyItem[] }) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<number | null>(null);
  const [toRotate, setToRotate] = useState<ApiKeyItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<WebstoreApiKeyScope[]>([
    ...WEBSTORE_API_KEY_SCOPES,
  ]);
  const [expiryOption, setExpiryOption] = useState<string>("none");

  const toggleScope = (scope: WebstoreApiKeyScope, checked: boolean) => {
    setSelectedScopes((prev) =>
      checked ? [...prev, scope] : prev.filter((s) => s !== scope)
    );
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      toast.error("Selecciona al menos un permiso");
      return;
    }
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const label = fd.get("label") as string;
    const expiresInDays = EXPIRY_OPTIONS.find((o) => o.value === expiryOption)?.days ?? null;

    const result = await createWebstoreApiKey({ label, scopes: selectedScopes, expiresInDays });
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

  const handleRotate = async () => {
    if (!toRotate) return;
    setIsSubmitting(true);
    const scopes = toValidScopes(toRotate.scopes);
    const result = await createWebstoreApiKey({
      label: toRotate.label,
      scopes: scopes.length > 0 ? scopes : [...WEBSTORE_API_KEY_SCOPES],
      expiresInDays: null,
    });
    setIsSubmitting(false);
    if (result.success) {
      setRotatedKey(result.data.rawKey);
      toast.success("Nueva API key creada");
      router.refresh();
    } else toast.error(result.error);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setSelectedScopes([...WEBSTORE_API_KEY_SCOPES]);
    setExpiryOption("none");
  };

  const closeRotateDialog = () => {
    setToRotate(null);
    setRotatedKey(null);
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
            apiKeys.map((k) => {
              const expired = isExpired(k.expiresAt);
              return (
                <div
                  key={k.apiKeyId}
                  className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 ${!k.isActive || expired ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                      <KeyRound className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{k.label}</h3>
                        <Badge variant="outline" className="font-mono">{k.keyPrefix}…</Badge>
                        {!k.isActive && <Badge variant="destructive">Revocada</Badge>}
                        {k.isActive && expired && (
                          <StatusPill status="cancelled" label="Expirada" size="sm" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {toValidScopes(k.scopes).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10.5px] font-normal">
                            {SCOPE_LABELS[s]}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                        <span>Creada: {new Date(k.createdAt).toLocaleDateString("es-MX")}</span>
                        {k.createdByName && <span>por {k.createdByName}</span>}
                        {k.expiresAt ? (
                          <span>
                            {expired ? "Expiró" : "Expira"}:{" "}
                            {new Date(k.expiresAt).toLocaleDateString("es-MX")}
                          </span>
                        ) : (
                          <span>Sin expiración</span>
                        )}
                        {k.lastUsedAt && (
                          <span>Último uso: {new Date(k.lastUsedAt).toLocaleString("es-MX")}</span>
                        )}
                        {!k.lastUsedAt && k.isActive && <span>Sin uso todavía</span>}
                      </div>
                    </div>
                  </div>
                  {k.isActive && (
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                      <Button variant="ghost" size="sm" onClick={() => setToRotate(k)}>
                        <RefreshCw className="h-4 w-4" /> Rotar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setToRevoke(k.apiKeyId)}
                      >
                        <Ban className="h-4 w-4" /> Revocar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
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
            <SecretReveal rawKey={createdKey} onDone={closeCreateDialog} />
          ) : (
            <form onSubmit={handleCreate}>
              <div className="space-y-5">
                <Field label="Etiqueta" icon={KeyRound} required hint="Ej. 'Tienda producción' o 'Tienda staging'.">
                  <Input name="label" required placeholder="Tienda producción" />
                </Field>

                <Field label="Permisos" icon={ShieldCheck} hint="Limita qué puede hacer la tienda con esta key.">
                  <div className="space-y-1 rounded-lg border border-border p-2">
                    {WEBSTORE_API_KEY_SCOPES.map((scope) => (
                      <label
                        key={scope}
                        htmlFor={`scope-${scope}`}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`scope-${scope}`}
                          checked={selectedScopes.includes(scope)}
                          onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                        />
                        <span className="text-sm">{SCOPE_LABELS[scope]}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Vigencia" icon={CalendarClock} hint="La key dejará de funcionar automáticamente al expirar.">
                  <Select value={expiryOption} onValueChange={setExpiryOption}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
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

      <Dialog open={!!toRotate} onOpenChange={(o) => !o && closeRotateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <FormDialogHeader
              icon={RefreshCw}
              title="Rotar API key"
              description={toRotate ? `Reemplaza la credencial de "${toRotate.label}" sin interrumpir la tienda.` : undefined}
            />
          </DialogHeader>
          {rotatedKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                La key anterior sigue activa. Actualiza la tienda con la nueva credencial y, cuando
                confirmes que todo funciona, revoca la anterior desde la lista.
              </p>
              <SecretReveal rawKey={rotatedKey} onDone={closeRotateDialog} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se creará una API key nueva con la misma etiqueta y los mismos permisos que{" "}
                <span className="font-medium text-foreground">{toRotate?.label}</span>. La key
                actual (<span className="font-mono">{toRotate?.keyPrefix}…</span>) seguirá activa —
                no se revoca automáticamente. Actualiza la tienda con la nueva credencial y revoca
                la anterior manualmente cuando confirmes que la migración funcionó.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeRotateDialog}>
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleRotate} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creando…" : "Crear key nueva"}
                </Button>
              </div>
            </div>
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
