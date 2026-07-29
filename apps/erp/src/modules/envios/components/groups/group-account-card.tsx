"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  MinusCircle,
  MoreHorizontal,
  SquarePen,
  ToggleLeft,
  Trash2,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountGroupRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";

type Props = {
  group: AccountGroupRow;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

export function GroupAccountCard({ group, onEdit, onToggle, onDelete }: Props) {
  const router = useRouter();
  const goToDetail = () => router.push(`/envios/grupos/${group.groupId}`);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card shadow-xs overflow-hidden",
        !group.active && "opacity-80"
      )}
    >
      <header
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (
            t.closest(
              'button, a, [role="menu"], [role="menuitem"], [role="dialog"], [data-no-row-click]'
            )
          )
            return;
          goToDetail();
        }}
        className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground truncate">
              {group.name}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              {group.code}
            </span>
            <StatusPill
              status={group.active ? "active" : "inactive"}
              size="sm"
            />
          </div>
          {group.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {group.description}
            </p>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {group.ownerName ?? group.ownerEmail ?? "—"}
              </span>
            </span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              {group.accountsCount}{" "}
              {group.accountsCount === 1 ? "cuenta" : "cuentas"}
            </span>
          </div>
        </div>
        <div onClick={stop} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`Acciones del grupo ${group.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(goToDetail, 0);
                }}
              >
                <Eye className="h-4 w-4" /> Ver detalles
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(onEdit, 0);
                }}
              >
                <SquarePen className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(onToggle, 0);
                }}
              >
                <ToggleLeft className="h-4 w-4" />{" "}
                {group.active ? "Desactivar" : "Activar"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(onDelete, 0);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {group.accounts.length === 0 ? (
        <div className="border-t border-border bg-muted/10 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay cuentas en este grupo.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {group.accounts.map((a) => (
            <li key={a.accountId}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/envios/cuentas/${a.accountId}`)
                }
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40",
                  !a.active && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CurrencyChip code={a.currencyCode} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {a.name}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-muted-foreground truncate">
                      {a.accountNumber}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {a.allowNegativeBalance ? (
                      <Badge
                        variant="warning"
                        className="text-[10px] gap-1"
                      >
                        <MinusCircle className="h-3 w-3" />
                        Negativo OK
                      </Badge>
                    ) : null}
                    {!a.active ? (
                      <StatusPill status="inactive" size="sm" />
                    ) : null}
                  </div>
                </div>
                <AmountDisplay
                  value={a.balance}
                  decimalPlaces={a.currencyDecimals}
                  signed
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {group.balancesByCurrency.length > 0 ? (
        <footer className="border-t border-border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
              Total
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {group.balancesByCurrency.map((b) => (
                <span
                  key={b.currencyId}
                  className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 ring-1 ring-inset ring-border"
                >
                  <CurrencyChip code={b.code} size="sm" />
                  <AmountDisplay
                    value={b.balance}
                    decimalPlaces={b.decimalPlaces}
                    signed
                    size="sm"
                  />
                </span>
              ))}
            </div>
          </div>
        </footer>
      ) : null}
    </article>
  );
}
