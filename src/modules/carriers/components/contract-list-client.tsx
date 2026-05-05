"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  FileSignature,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Download,
  CircleCheck,
  Ban,
  Hourglass,
  FileText,
  FileType2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContractForm } from "./contract-form";
import { deleteContract, setContractStatus } from "../actions/contract-actions";
import type {
  ContractRow,
  ContractDriverOption,
} from "../queries/contract-queries";
import type { ContractStatus } from "../lib/schemas";
import { isPdfMime } from "../lib/schemas";

type Props = {
  initialContracts: ContractRow[];
  drivers: ContractDriverOption[];
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  active: "Activo",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<ContractStatus, string> = {
  active: "bg-[var(--ops-success)]/10 text-[var(--ops-success)] ring-[var(--ops-success)]/25",
  expired: "bg-[var(--ops-warning)]/12 text-[var(--ops-warning)] ring-[var(--ops-warning)]/30",
  cancelled: "bg-[var(--ops-critical)]/10 text-[var(--ops-critical)] ring-[var(--ops-critical)]/25",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function StatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset whitespace-nowrap",
        STATUS_TONE[status],
      )}
    >
      {status === "active" && <CircleCheck className="h-3 w-3" />}
      {status === "expired" && <Hourglass className="h-3 w-3" />}
      {status === "cancelled" && <Ban className="h-3 w-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ContractListClient({ initialContracts, drivers }: Props) {
  const router = useRouter();
  const [openForm, setOpenForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContractStatus>("all");
  const [toDelete, setToDelete] = useState<ContractRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialContracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.contractNo.toLowerCase().includes(q) ||
        c.driverName.toLowerCase().includes(q) ||
        c.driverIdentification.toLowerCase().includes(q) ||
        c.entityName.toLowerCase().includes(q)
      );
    });
  }, [initialContracts, search, statusFilter]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.contractId);
    const r = await deleteContract(toDelete.contractId);
    setBusyId(null);
    if (r.success) {
      toast.success("Contrato eliminado");
      setToDelete(null);
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const handleStatus = async (id: number, next: ContractStatus) => {
    setBusyId(id);
    const r = await setContractStatus(id, next);
    setBusyId(null);
    if (r.success) {
      toast.success("Estado actualizado");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const columns: DataTableColumn<ContractRow>[] = [
    {
      key: "folio",
      header: "Folio",
      cell: (c) => (
        <div className="flex items-center gap-2">
          {isPdfMime(c.fileMime) ? (
            <FileText className="h-4 w-4 text-rose-500" />
          ) : (
            <FileType2 className="h-4 w-4 text-sky-500" />
          )}
          <span className="font-medium">{c.contractNo}</span>
        </div>
      ),
    },
    {
      key: "driver",
      header: "Conductor",
      cell: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.driverName}</span>
          <span className="text-xs text-muted-foreground">
            {c.driverIdentification} · {c.entityName}
          </span>
        </div>
      ),
    },
    {
      key: "validity",
      header: "Vigencia",
      cell: (c) => (
        <div className="text-xs">
          <div>{fmtDate(c.startDate)}</div>
          <div className="text-muted-foreground">
            {c.endDate ? `→ ${fmtDate(c.endDate)}` : "→ sin fin"}
          </div>
        </div>
      ),
    },
    {
      key: "size",
      header: "Tamaño",
      cell: (c) => <span className="text-xs font-mono tabular-nums">{fmtBytes(c.fileSize)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" title="Ver">
            <Link href={`/contracts/${c.contractId}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={busyId === c.contractId}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={`/api/contracts/${c.contractId}/file?download=1`}
                  download={c.fileName}
                >
                  <Download className="h-4 w-4" /> Descargar
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {c.status !== "active" && (
                <DropdownMenuItem onClick={() => handleStatus(c.contractId, "active")}>
                  <CircleCheck className="h-4 w-4" /> Marcar activo
                </DropdownMenuItem>
              )}
              {c.status !== "expired" && (
                <DropdownMenuItem onClick={() => handleStatus(c.contractId, "expired")}>
                  <Hourglass className="h-4 w-4" /> Marcar expirado
                </DropdownMenuItem>
              )}
              {c.status !== "cancelled" && (
                <DropdownMenuItem onClick={() => handleStatus(c.contractId, "cancelled")}>
                  <Ban className="h-4 w-4" /> Cancelar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setToDelete(c)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <InputGroup className="w-full md:max-w-sm">
        <InputGroupAddon>
          <Search className="h-4 w-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Folio, conductor, identificación…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </InputGroup>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | ContractStatus)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="expired">Expirados</SelectItem>
          <SelectItem value="cancelled">Cancelados</SelectItem>
        </SelectContent>
      </Select>
      <Badge variant="outline" className="ml-auto">
        {filtered.length} {filtered.length === 1 ? "contrato" : "contratos"}
      </Badge>
    </>
  );

  return (
    <>
      <PageHeader
        icon={FileSignature}
        title="Contratos"
        description="Documentos contractuales firmados con conductores."
        actions={
          <Button variant="brand" onClick={() => setOpenForm(true)} disabled={drivers.length === 0}>
            <Plus className="h-4 w-4" /> Nuevo contrato
          </Button>
        }
      />

      <div className="mt-4">
        <ResponsiveListView
          rows={filtered}
          rowKey={(c) => c.contractId}
          columns={columns}
          toolbar={toolbar}
          onRowClick={(c) => router.push(`/contracts/${c.contractId}`)}
          emptyState={
            <EmptyState
              icon={<FileSignature className="size-10" />}
              title={initialContracts.length === 0 ? "Sin contratos" : "Sin coincidencias"}
              description={
                initialContracts.length === 0
                  ? "Aún no se ha registrado ningún contrato. Adjunta el primero."
                  : "Cambia los filtros o el término de búsqueda."
              }
            >
              {initialContracts.length === 0 && (
                <Button variant="brand" onClick={() => setOpenForm(true)} disabled={drivers.length === 0}>
                  <Plus className="h-4 w-4" /> Nuevo contrato
                </Button>
              )}
            </EmptyState>
          }
          mobileCard={(c) => {
            const FileIcon = isPdfMime(c.fileMime) ? FileText : FileType2;
            return (
              <MobileListCard
                key={c.contractId}
                onClick={() => router.push(`/contracts/${c.contractId}`)}
                title={
                  <span className="flex items-center gap-2">
                    <FileIcon className={cn("h-4 w-4", isPdfMime(c.fileMime) ? "text-rose-500" : "text-sky-500")} />
                    {c.contractNo}
                  </span>
                }
                subtitle={`${c.driverName} · ${c.entityName}`}
                meta={
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {fmtDate(c.startDate)}
                      {c.endDate ? ` – ${fmtDate(c.endDate)}` : ""}
                    </span>
                  </div>
                }
              />
            );
          }}
        />
      </div>

      <ContractForm open={openForm} onOpenChange={setOpenForm} drivers={drivers} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el folio <strong>{toDelete?.contractNo}</strong> de{" "}
              <strong>{toDelete?.driverName}</strong> y su archivo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
