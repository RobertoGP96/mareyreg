"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  UserRound,
  Phone,
  Mail,
  MapPin,
  SquarePen,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { toggleWebstoreCustomerActive } from "../actions/customer-actions";
import { CustomerEditDialog } from "./customer-edit-dialog";
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

const ORDER_STATUS_MAP: Record<string, { status: import("@/components/ui/status-pill").OpsStatus; label: string }> = {
  draft: { status: "pending", label: "Borrador" },
  confirmed: { status: "in_progress", label: "Confirmado" },
  reserved: { status: "in_progress", label: "Reservado" },
  partial: { status: "delayed", label: "Parcial" },
  fulfilled: { status: "completed", label: "Completado" },
  cancelled: { status: "cancelled", label: "Cancelado" },
};

export interface WebstoreCustomerDetail {
  customerId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  currentBalance: number;
  version: number;
  createdAt: string;
  orders: Array<{
    orderId: number;
    folio: string;
    orderDate: string;
    status: string;
    total: number;
  }>;
}

export function CustomerDetailClient({ customer }: { customer: WebstoreCustomerDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleToggle = async () => {
    setSubmitting(true);
    const result = await toggleWebstoreCustomerActive(customer.customerId, !customer.isActive);
    setSubmitting(false);
    if (result.success) {
      toast.success(customer.isActive ? "Cliente desactivado" : "Cliente reactivado");
      setToggleOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={UserRound}
        title={customer.name}
        description={`Cliente de la tienda en línea desde ${new Date(customer.createdAt).toLocaleDateString("es-MX")}.`}
        badge={customer.isActive ? "Activo" : "Inactivo"}
        actions={
          <>
            <Link href="/webstore/clientes">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Volver
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <SquarePen className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              className={customer.isActive ? "text-destructive hover:text-destructive" : undefined}
              onClick={() => setToggleOpen(true)}
            >
              {customer.isActive ? (
                <>
                  <Ban className="h-4 w-4" /> Desactivar
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Reactivar
                </>
              )}
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-panel p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Datos de contacto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{customer.phone ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{customer.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{customer.address ?? "—"}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-border/60 text-sm text-muted-foreground">
          Saldo actual:{" "}
          <span className="font-mono tabular-nums text-foreground">
            ${customer.currentBalance.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-5 py-3">
          <h2 className="font-semibold text-foreground">Pedidos ({customer.orders.length})</h2>
        </div>
        <div className="divide-y divide-border/60">
          {customer.orders.length > 0 ? (
            customer.orders.map((o) => {
              const cfg = ORDER_STATUS_MAP[o.status] ?? { status: "pending" as const, label: o.status };
              return (
                <div key={o.orderId} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{o.folio}</span>
                      <StatusPill status={cfg.status} label={cfg.label} size="sm" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.orderDate).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-sm text-foreground">
                    ${o.total.toFixed(2)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8">
              <EmptyState title="Sin pedidos" description="Este cliente aún no ha hecho pedidos." />
            </div>
          )}
        </div>
      </div>

      <CustomerEditDialog
        customer={{
          customerId: customer.customerId,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          version: customer.version,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {customer.isActive ? "¿Desactivar cliente?" : "¿Reactivar cliente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {customer.isActive
                ? "El cliente será marcado como inactivo. El historial de pedidos se conservará."
                : "El cliente volverá a estar activo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              className={customer.isActive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : customer.isActive ? "Desactivar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
