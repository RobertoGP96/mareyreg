"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import { StatusPill } from "@/components/ui/status-pill";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Bike, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2, Phone,
  FileText, CircleDollarSign, Power, Hash,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  createCourierProfile,
  updateCourierProfile,
  toggleCourierActive,
  deleteCourierProfile,
} from "../../actions/courier-actions";
import type { CourierRow } from "../../queries/courier-queries";
import type { CommissionSummaryRow } from "../../queries/cash-delivery-queries";
import type { CurrencyRow } from "../../lib/types";
import { formatAmount } from "../../lib/format";

interface Props {
  couriers: CourierRow[];
  assignableUsers: { userId: number; fullName: string; email: string }[];
  currencies: CurrencyRow[];
  commissionSummary: CommissionSummaryRow[];
}

export function CourierListClient({
  couriers,
  assignableUsers,
  currencies,
  commissionSummary,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<CourierRow | null>(null);
  const [toDelete, setToDelete] = useState<CourierRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [defaultCommission, setDefaultCommission] = useState("");
  const [defaultCurrencyId, setDefaultCurrencyId] = useState<string>("");

  const activeCurrencies = useMemo(() => currencies.filter((c) => c.active), [currencies]);

  const pendingByCourier = useMemo(() => {
    const map = new Map<number, CommissionSummaryRow[]>();
    for (const row of commissionSummary) {
      const list = map.get(row.courierId) ?? [];
      list.push(row);
      map.set(row.courierId, list);
    }
    return map;
  }, [commissionSummary]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return couriers;
    return couriers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [couriers, search]);

  const resetForm = () => {
    setUserId("");
    setPhone("");
    setNotes("");
    setDefaultCommission("");
    setDefaultCurrencyId("");
  };

  const fillEdit = (c: CourierRow) => {
    setUserId(String(c.userId));
    setPhone(c.phone ?? "");
    setNotes(c.notes ?? "");
    setDefaultCommission(c.defaultCommission ?? "");
    setDefaultCurrencyId(
      c.defaultCommissionCurrencyId ? String(c.defaultCommissionCurrencyId) : ""
    );
    setToEdit(c);
  };

  const buildInput = () => {
    const commission = defaultCommission.trim() === "" ? null : Number(defaultCommission);
    return {
      userId: Number(userId),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      defaultCommission: commission,
      defaultCommissionCurrencyId:
        commission != null && commission > 0 && defaultCurrencyId
          ? Number(defaultCurrencyId)
          : null,
    };
  };

  const validate = (): string | null => {
    if (!userId) return "Selecciona un usuario";
    const commission = defaultCommission.trim() === "" ? null : Number(defaultCommission);
    if (commission != null && (!Number.isFinite(commission) || commission < 0)) {
      return "Comisión inválida";
    }
    if (commission != null && commission > 0 && !defaultCurrencyId) {
      return "Selecciona la moneda de la comisión por defecto";
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const input = buildInput();
      const r = toEdit
        ? await updateCourierProfile(toEdit.courierProfileId, input)
        : await createCourierProfile(input);
      if (r.success) {
        toast.success(toEdit ? "Mensajero actualizado" : "Mensajero registrado");
        setIsCreateOpen(false);
        setToEdit(null);
        resetForm();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (c: CourierRow) => {
    setSubmitting(true);
    try {
      const r = await toggleCourierActive(c.courierProfileId);
      if (r.success) {
        toast.success(c.active ? "Mensajero desactivado" : "Mensajero activado");
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    try {
      const r = await deleteCourierProfile(toDelete.courierProfileId);
      if (r.success) {
        toast.success("Mensajero eliminado");
        setToDelete(null);
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPending = (c: CourierRow) => {
    const rows = pendingByCourier.get(c.courierProfileId) ?? [];
    if (rows.length === 0) {
      return <span className="text-xs text-muted-foreground italic">—</span>;
    }
    return (
      <span className="flex flex-col items-end gap-0.5">
        {rows.map((r) => (
          <span key={r.currencyId} className="font-mono tabular-nums text-sm">
            {formatAmount(Number(r.pendingAmount), r.currencyDecimals)} {r.currencyCode}
          </span>
        ))}
      </span>
    );
  };

  const renderActions = (c: CourierRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => fillEdit(c)}>
          <SquarePen className="h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleToggle(c)}>
          <Power className="h-4 w-4" /> {c.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        {c.deliveriesCount === 0 && (
          <DropdownMenuItem
            onClick={() => setToDelete(c)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: DataTableColumn<CourierRow>[] = [
    {
      key: "name",
      header: "Mensajero",
      cell: (c) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-foreground truncate">{c.fullName}</span>
          <span className="text-xs text-muted-foreground truncate">{c.email}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (c) =>
        c.phone ? (
          <span className="text-sm tabular-nums">{c.phone}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "defaultCommission",
      header: "Comisión por defecto",
      align: "right",
      cell: (c) =>
        c.defaultCommission != null && Number(c.defaultCommission) > 0 ? (
          <span className="font-mono tabular-nums text-sm">
            {formatAmount(
              Number(c.defaultCommission),
              c.defaultCommissionCurrencyDecimals ?? 2
            )}{" "}
            {c.defaultCommissionCurrencyCode}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        ),
    },
    {
      key: "pending",
      header: "Comisión pendiente",
      align: "right",
      cell: renderPending,
    },
    {
      key: "deliveries",
      header: "Entregas",
      align: "right",
      cell: (c) => <span className="tabular-nums text-sm">{c.deliveriesCount}</span>,
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (c) => (
        <StatusPill
          status={c.active ? "completed" : "cancelled"}
          size="sm"
          label={c.active ? "Activo" : "Inactivo"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (c) => renderActions(c),
    },
  ];

  // Al editar, el usuario actual ya tiene perfil y no está en assignableUsers.
  const userOptions = toEdit
    ? [{ userId: toEdit.userId, fullName: toEdit.fullName, email: toEdit.email }]
    : assignableUsers;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mensajeros"
        description="Usuarios que entregan efectivo. Su comisión por defecto pre-llena el formulario de entrega."
        badge={`${couriers.length} mensajeros`}
        actions={
          <Button
            variant="brand"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nuevo mensajero
          </Button>
        }
      />

      <ResponsiveListView<CourierRow>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.courierProfileId}
        mobileCard={(c) => (
          <MobileListCard
            key={c.courierProfileId}
            title={
              <span className="flex items-center gap-2 min-w-0">
                <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{c.fullName}</span>
              </span>
            }
            subtitle={
              <span className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                {c.phone && <span className="text-[11px] tabular-nums">{c.phone}</span>}
              </span>
            }
            value={
              <StatusPill
                status={c.active ? "completed" : "cancelled"}
                size="sm"
                label={c.active ? "Activo" : "Inactivo"}
              />
            }
            actions={renderActions(c)}
            meta={
              <span className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">{c.deliveriesCount} entregas</span>
                {renderPending(c)}
              </span>
            }
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, correo o teléfono…"
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
            title="Sin mensajeros"
            description={
              search
                ? "No hay coincidencias con la búsqueda."
                : "Registra al primer usuario que hará entregas."
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
        a11yTitle={toEdit ? "Editar mensajero" : "Nuevo mensajero"}
        description="Selecciona el usuario y su comisión habitual."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Bike}
          title={toEdit ? "Editar mensajero" : "Nuevo mensajero"}
          description="Selecciona el usuario y su comisión habitual."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={Bike} title="Usuario">
            <Field
              label="Usuario del sistema"
              required
              hint={
                toEdit
                  ? "El usuario de un mensajero existente no se puede cambiar."
                  : "Solo aparecen usuarios que aún no son mensajeros."
              }
            >
              <Select value={userId} onValueChange={setUserId} disabled={!!toEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((u) => (
                    <SelectItem key={u.userId} value={String(u.userId)}>
                      {u.fullName} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Teléfono" icon={Phone}>
              <Input
                placeholder="+53 5555 5555"
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Comisión por defecto">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto" icon={Hash} hint="Se puede cambiar en cada entrega.">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label="Moneda" icon={CircleDollarSign}>
                <Select value={defaultCurrencyId} onValueChange={setDefaultCurrencyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCurrencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Notas">
            <Field label="Notas" icon={FileText}>
              <Textarea
                placeholder="Zona que cubre, horarios, observaciones…"
                value={notes}
                rows={2}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
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
          <Button type="button" variant="brand" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Registrar"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mensajero?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el perfil de {toDelete?.fullName}. El usuario del sistema no se
              elimina. Solo es posible si no tiene entregas registradas.
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
        label="Nuevo mensajero"
        onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
}
