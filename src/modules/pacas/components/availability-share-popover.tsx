"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Share2,
  Copy,
  Check,
  ImageDown,
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Image as ImageIcon,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatAvailabilityText,
  formatShareDate,
  toShareGroups,
  totalAvailable,
  DEFAULT_SHARE_TITLE,
} from "../lib/format-availability-share";
import { renderAvailabilityPng } from "../lib/render-availability-png";

interface CategoryShape {
  name: string;
  available: number;
}
interface ClassificationShape {
  classification: string;
  classificationId: number;
  categories: CategoryShape[];
}

interface Props {
  data: ClassificationShape[];
}

export function AvailabilitySharePopover({ data }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const [customTitle, setCustomTitle] = useState(DEFAULT_SHARE_TITLE);
  const [customCta, setCustomCta] = useState("");
  const [includeDate, setIncludeDate] = useState(true);
  const [includeTotal, setIncludeTotal] = useState(true);

  const [text, setText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [refreshingPreview, setRefreshingPreview] = useState(false);

  const today = useMemo(() => new Date(), []);
  const groups = useMemo(() => toShareGroups(data), [data]);
  const total = useMemo(() => totalAvailable(groups), [groups]);
  const dateLabel = useMemo(() => formatShareDate(today), [today]);

  const lastSyncedTextRef = useRef("");
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const next = formatAvailabilityText(groups, {
      date: today,
      title: customTitle,
      cta: customCta,
      includeDate,
      includeTotal,
    });
    setText((prev) => {
      if (!prev || prev === lastSyncedTextRef.current) {
        lastSyncedTextRef.current = next;
        return next;
      }
      lastSyncedTextRef.current = next;
      return next;
    });
  }, [groups, today, customTitle, customCta, includeDate, includeTotal]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRefreshingPreview(true);

    const timer = setTimeout(async () => {
      try {
        const blob = await renderAvailabilityPng(data, {
          date: today,
          title: customTitle,
          cta: customCta,
          includeDate,
          includeTotal,
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const oldUrl = previewUrlRef.current;
        previewUrlRef.current = url;
        setPreviewUrl(url);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setRefreshingPreview(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, data, today, customTitle, customCta, includeDate, includeTotal]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const resetText = () => {
    const next = formatAvailabilityText(groups, {
      date: today,
      title: customTitle,
      cta: customCta,
      includeDate,
      includeTotal,
    });
    setText(next);
    lastSyncedTextRef.current = next;
    toast.success("Texto regenerado");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Texto copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  };

  const handleDownloadPng = async () => {
    setGenerating(true);
    try {
      const blob = await renderAvailabilityPng(data, {
        date: today,
        title: customTitle,
        cta: customCta,
        includeDate,
        includeTotal,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = today.toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `pacas-disponibles-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Imagen descargada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar la imagen");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="brand"
          size="sm"
          className="cursor-pointer gap-2 group"
          aria-label="Compartir disponibilidad"
        >
          <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
          Compartir
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden border-border/60 shadow-2xl sm:max-w-2xl gap-0 flex flex-col max-h-[90vh]"
      >
        <DialogTitle className="sr-only">Compartir disponibilidad</DialogTitle>
        <DialogDescription className="sr-only">
          Genera un texto e imagen listos para publicar en redes sociales con la disponibilidad actual de pacas.
        </DialogDescription>

        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[var(--brand)]/12 via-[var(--brand)]/6 to-transparent border-b border-border/60 px-6 py-5">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[var(--brand)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0 flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-sky-500 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)]">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-headline font-bold text-[17px] tracking-tight text-foreground leading-tight">
                  Compartir en redes
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-snug">
                  <span className="font-semibold text-foreground tabular-nums">{groups.length}</span>{" "}
                  {groups.length === 1 ? "clasificación" : "clasificaciones"}{" "}
                  ·{" "}
                  <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
                  {total === 1 ? "paca lista" : "pacas listas"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/60">
                {dateLabel}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-5 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="paca-share-text"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <TypeIcon className="h-3.5 w-3.5" />
                Texto editable
              </label>
              <button
                type="button"
                onClick={resetText}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                aria-label="Regenerar texto desde los datos"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerar
              </button>
            </div>
            <Textarea
              id="paca-share-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-[12px] leading-relaxed resize-none h-[300px] overflow-y-auto"
              aria-label="Texto editable a compartir"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" />
                Vista previa imagen
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                {refreshingPreview && (
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--brand)]" />
                )}
                1080 × 1350 · 4:5
              </span>
            </div>
            <div className="relative h-[300px] w-full rounded-xl border border-border/60 bg-muted/30 overflow-hidden ring-1 ring-inset ring-border/30 shadow-inner grid place-items-center p-3">
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Vista previa de la imagen para redes"
                    className={`max-h-full w-auto object-contain rounded-md shadow-md transition-opacity duration-200 ${
                      refreshingPreview ? "opacity-60" : "opacity-100"
                    }`}
                  />
                  {refreshingPreview && (
                    <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/60 shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin text-[var(--brand)]" />
                      Actualizando
                    </div>
                  )}
                </>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-4">
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors px-3 py-2 cursor-pointer"
            aria-expanded={showCustomize}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
              Personalizar contenido
            </span>
            {showCustomize ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {showCustomize && (
            <div className="mt-3 grid gap-3 rounded-lg border border-border/60 bg-card/50 p-4 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="paca-share-title"
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  Título
                </label>
                <Input
                  id="paca-share-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={DEFAULT_SHARE_TITLE}
                  className="h-9 text-sm"
                  maxLength={60}
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="paca-share-cta"
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  Mensaje al final (opcional)
                </label>
                <Input
                  id="paca-share-cta"
                  value={customCta}
                  onChange={(e) => setCustomCta(e.target.value)}
                  placeholder="Ej: Reserva al WhatsApp 809-000-0000"
                  className="h-9 text-sm"
                  maxLength={80}
                />
              </div>

              <label className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2 cursor-pointer">
                <span className="text-xs font-semibold text-foreground">Incluir fecha</span>
                <Switch
                  checked={includeDate}
                  onCheckedChange={setIncludeDate}
                  aria-label="Incluir fecha"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2 cursor-pointer">
                <span className="text-xs font-semibold text-foreground">Incluir total</span>
                <Switch
                  checked={includeTotal}
                  onCheckedChange={setIncludeTotal}
                  aria-label="Incluir total"
                />
              </label>
            </div>
          )}
        </div>

        <div className="px-6 pb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Listo para
          </span>
          <ChannelChip label="WhatsApp" tone="emerald" />
          <ChannelChip label="Instagram" tone="pink" />
          <ChannelChip label="Facebook" tone="blue" />
        </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Pega el texto en cualquier red, o sube la imagen como Story.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleDownloadPng}
              disabled={generating}
              className="cursor-pointer gap-1.5"
              aria-label="Descargar como imagen PNG"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageDown className="h-4 w-4" />
              )}
              {generating ? "Generando…" : "Descargar PNG"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCopy}
              className="cursor-pointer gap-1.5"
              aria-label="Copiar texto al portapapeles"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado" : "Copiar texto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ChipTone = "emerald" | "pink" | "blue";
const TONE_MAP: Record<ChipTone, string> = {
  emerald:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  pink: "bg-pink-500/10 text-pink-700 ring-pink-500/20 dark:text-pink-300",
  blue: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300",
};

function ChannelChip({ label, tone }: { label: string; tone: ChipTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${TONE_MAP[tone]}`}
    >
      {label}
    </span>
  );
}
