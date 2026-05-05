"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Users, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2,
  Phone, MapPin, Link as LinkIcon, ToggleLeft, UserRound, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRecipient,
  updateRecipient,
  toggleRecipientActive,
  deleteRecipient,
} from "../../actions/recipient-actions";
import type { RecipientRow } from "../../queries/recipient-queries";

interface Props {
  initialRecipients: RecipientRow[];
}

export function RecipientListClient({ initialRecipients }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<RecipientRow | null>(null);
  const [toDelete, setToDelete] = useState<RecipientRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialRecipients;
    return initialRecipients.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q)
    );
  }, [initialRecipients, search]);

  const resetForm = () => {
    setFullName(""); setPhone(""); setAddress(""); setMapUrl(""); setActive(true);
  };
  const fillEdit = (r: RecipientRow) => {
    setFullName(r.fullName);
    setPhone(r.phone ?? "");
    setAddress(r.address ?? "");
    setMapUrl(r.mapUrl ?? "");
    setActive(r.active);
    setToEdit(r);
  };

  const validate = () => {
    if (fullName.trim().length < 2) return "El nombre es requerido (mínimo 2 caracteres)";
    if (mapUrl.trim().length > 0) {
      try { new URL(mapUrl.trim()); } catch { return "URL del mapa inválida"; }
    }
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createRecipient({
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      mapUrl: mapUrl.trim() || null,
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Destinatario creado");
      setIsCreateOpen(false); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await updateRecipient(toEdit.recipientId, {
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      mapUrl: mapUrl.trim() || null,
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Destinatario actualizado");
      setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleToggle = async (r: RecipientRow) => {
    const res = await toggleRecipientActive(r.recipientId);
    if (res.success) {
      toast.success(res.data.active ? "Destinatario activado" : "Destinatario desactivado");
      router.refresh();
    } else toast.error(res.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const res = await deleteRecipient(toDelete.recipientId);
    setSubmitting(false);
    if (res.success) {
      toast.success("Destinatario eliminado");
      setToDelete(null); router.refresh();
    } else toast.error(res.error);
  };

  const columns: DataTableColumn<RecipientRow>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (r) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-foreground truncate">{r.fullName}</span>
          {r.phone && <span className="text-xs text-muted-foreground truncate">{r.phone}</span>}
        </div>
      ),
    },
    {
      key: "address",
      header: "Dirección",
      cell: (r) =>
        r.address ? (
          <span className="text-sm text-muted-foreground truncate">{r.address}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "mapUrl",
      header: "Ubicación",
      align: "center",
      cell: (r) =>
        r.mapUrl ? (
          <a
            href={r.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Mapa
          </a>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "deliveries",
      header: "Entregas",
      align: "right",
      cell: (r) =>
        r.deliveriesCount > 0 ? <Badge variant="brand">{r.deliveriesCount}</Badge> : <Badge variant="outline">0</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (r) => <StatusPill status={r.active ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => fillEdit(r)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggle(r)}>
              <ToggleLeft className="h-4 w-4" /> {r.active ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToDelete(r)}
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
        icon={Users}
        title="Destinatarios"
        description="Catálogo de personas que reciben entregas de efectivo. Reusa estos contactos en cada entrega."
        badge={`${initialRecipients.length} destinatarios`}
        actions={
          <Button
            variant="brand"
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nuevo destinatario
          </Button>
        }
      />

      <ResponsiveListView<RecipientRow>
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.recipientId}
        mobileCard={(r) => (
          <MobileListCard
            key={r.recipientId}
            title={
              <span className="flex items-center gap-2 min-w-0">
                <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{r.fullName}</span>
              </span>
            }
            subtitle={
              <span className="flex flex-col gap-0.5">
                {r.phone && <span className="truncate">{r.phone}</span>}
                {r.address && <span className="text-[11px] text-muted-foreground truncate">{r.address}</span>}
              </span>
            }
            value={<StatusPill status={r.active ? "active" : "inactive"} size="sm" />}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => fillEdit(r)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggle(r)}>
                    <ToggleLeft className="h-4 w-4" /> {r.active ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(r)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={
              r.mapUrl ? (
                <a
                  href={r.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir mapa
                </a>
              ) : null
            }
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, teléfono o dirección…"
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
            title="Sin destinatarios"
            description={search ? "No hay coincidencias." : "Agrega destinatarios para registrar entregas de efectivo."}
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false); setToEdit(null); resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar destinatario" : "Nuevo destinatario"}
        description="Captura los datos de contacto del destinatario."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Users}
          title={toEdit ? "Editar destinatario" : "Nuevo destinatario"}
          description="Captura los datos de contacto del destinatario."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={UserRound} title="Identificación">
            <Field label="Nombre completo" icon={UserRound} required>
              <Input
                placeholder="Juan Pérez"
                value={fullName}
                maxLength={120}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <Field label="Teléfono" icon={Phone} hint="Incluye código de país si aplica.">
              <Input
                placeholder="+52 55 1234 5678"
                value={phone}
                maxLength={40}
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection icon={MapPin} title="Ubicación">
            <Field label="Dirección" icon={MapPin} hint="Calle, número, colonia, ciudad.">
              <Textarea
                placeholder="Av. Reforma 100, Col. Centro, CDMX"
                value={address}
                rows={2}
                maxLength={500}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field label="URL del mapa" icon={LinkIcon} hint="Pega el enlace de Google Maps u otro mapa.">
              <Input
                placeholder="https://maps.google.com/..."
                value={mapUrl}
                maxLength={500}
                inputMode="url"
                onChange={(e) => setMapUrl(e.target.value)}
              />
            </Field>
            {mapUrl.trim() && (
              <a
                href={mapUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir mapa en nueva pestaña
              </a>
            )}
          </FormSection>

          <FormSection icon={ToggleLeft} title="Estado">
            <Field label="Activo" icon={ToggleLeft} hint="Solo los activos aparecen al registrar entregas.">
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-sm text-muted-foreground">{active ? "Sí" : "No"}</span>
              </div>
            </Field>
          </FormSection>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setIsCreateOpen(false); setToEdit(null); resetForm(); }}
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
            <AlertDialogTitle>¿Eliminar destinatario?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.deliveriesCount
                ? `${toDelete.deliveriesCount} entrega(s) asocian a "${toDelete.fullName}" y bloquean la eliminación. Desactívalo en su lugar.`
                : `Se eliminará al destinatario "${toDelete?.fullName}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || (toDelete?.deliveriesCount ?? 0) > 0}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nuevo destinatario"
        onClick={() => { resetForm(); setIsCreateOpen(true); }}
      />
    </div>
  );
}
