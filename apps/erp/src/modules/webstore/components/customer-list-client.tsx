"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Search,
  UserRound,
  Phone,
  Mail,
  Users,
  ShoppingBag,
  UserPlus,
  MoreHorizontal,
  SquarePen,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { toggleWebstoreCustomerActive } from "../actions/customer-actions";
import { CustomerEditDialog, type CustomerEditItem } from "./customer-edit-dialog";

export interface WebstoreCustomerItem {
  customerId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  currentBalance: number;
  version: number;
  createdAt: string;
  ordersCount: number;
  lastOrderAt: string | null;
}

export interface WebstoreCustomerKpis {
  total: number;
  active: number;
  newThisMonth: number;
  withOrders: number;
}

export function CustomerListClient({
  customers,
  kpis,
}: {
  customers: WebstoreCustomerItem[];
  kpis: WebstoreCustomerKpis;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [toEdit, setToEdit] = useState<WebstoreCustomerItem | null>(null);
  const [toToggle, setToToggle] = useState<WebstoreCustomerItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, search]);

  const handleToggle = async () => {
    if (!toToggle) return;
    setSubmitting(true);
    const result = await toggleWebstoreCustomerActive(toToggle.customerId, !toToggle.isActive);
    setSubmitting(false);
    if (result.success) {
      toast.success(toToggle.isActive ? "Cliente desactivado" : "Cliente reactivado");
      setToToggle(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const editItem: CustomerEditItem | null = toEdit
    ? {
        customerId: toEdit.customerId,
        name: toEdit.name,
        phone: toEdit.phone,
        email: toEdit.email,
        address: toEdit.address,
        version: toEdit.version,
      }
    : null;

  const columns: DataTableColumn<WebstoreCustomerItem>[] = [
    {
      key: "name",
      header: "Cliente",
      cell: (c) => (
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">{c.name}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (c) =>
        c.phone ? (
          <a
            href={`tel:${c.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sm text-foreground hover:text-[var(--ops-active)]"
          >
            <Phone className="h-3 w-3" />
            {c.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      cell: (c) =>
        c.email ? (
          <span className="text-sm text-foreground truncate max-w-[180px] inline-block">
            {c.email}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "orders",
      header: "Pedidos",
      cell: (c) => <span className="font-mono tabular-nums text-sm">{c.ordersCount}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (c) => <StatusPill status={c.isActive ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setToEdit(c)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToToggle(c)}
              className={c.isActive ? "text-destructive focus:text-destructive" : undefined}
            >
              {c.isActive ? (
                <>
                  <Ban className="h-4 w-4" /> Desactivar
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Reactivar
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes de la tienda en línea"
        description="Clientes registrados o creados por pedidos de la tienda web."
        badge={`${customers.length} clientes`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile label="Total" value={kpis.total} icon={Users} tone="idle" />
        <MetricTile label="Activos" value={kpis.active} icon={CheckCircle2} tone="success" />
        <MetricTile label="Nuevos este mes" value={kpis.newThisMonth} icon={UserPlus} tone="active" />
        <MetricTile label="Con pedidos" value={kpis.withOrders} icon={ShoppingBag} tone="track" />
      </div>

      <ResponsiveListView<WebstoreCustomerItem>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.customerId}
        density="compact"
        onRowClick={(c) => router.push(`/webstore/clientes/${c.customerId}`)}
        mobileCard={(c) => (
          <Link key={c.customerId} href={`/webstore/clientes/${c.customerId}`}>
            <MobileListCard
              title={
                <span className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {c.name}
                </span>
              }
              subtitle={
                <>
                  {c.phone ?? "—"}
                  {c.email && ` · ${c.email}`}
                </>
              }
              value={<StatusPill status={c.isActive ? "active" : "inactive"} size="sm" />}
              actions={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setToEdit(c)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setToToggle(c)}
                      className={c.isActive ? "text-destructive focus:text-destructive" : undefined}
                    >
                      {c.isActive ? (
                        <>
                          <Ban className="h-4 w-4" /> Desactivar
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Reactivar
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
              meta={
                <span className="text-[11px] text-muted-foreground">
                  {c.ordersCount} pedido(s)
                </span>
              }
            />
          </Link>
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar nombre, teléfono o email…"
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
            title="Sin clientes"
            description={
              search
                ? "No hay coincidencias."
                : "Cuando alguien se registre en la tienda o haga un pedido, aparecerá aquí."
            }
          />
        }
      />

      <CustomerEditDialog customer={editItem} open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)} />

      <AlertDialog open={!!toToggle} onOpenChange={() => setToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toToggle?.isActive ? "¿Desactivar cliente?" : "¿Reactivar cliente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toToggle?.name}</strong>{" "}
              {toToggle?.isActive
                ? "será marcado como inactivo. El historial de pedidos se conservará."
                : "volverá a estar activo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              className={
                toToggle?.isActive ? "bg-destructive text-white hover:bg-destructive/90" : undefined
              }
              disabled={submitting}
            >
              {submitting ? "Guardando…" : toToggle?.isActive ? "Desactivar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
