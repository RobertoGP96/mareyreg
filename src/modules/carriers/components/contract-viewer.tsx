"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Download,
  ExternalLink,
  FileText,
  FileType2,
  FileWarning,
  Loader2,
  Maximize2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPdfMime, isWordMime } from "../lib/schemas";

// react-pdf usa `pdfjs-dist` que es pesado y client-only; lo cargamos dinámicamente.
const PdfPreview = dynamic(
  () => import("./pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Inicializando visor…
      </div>
    ),
  },
);

type Props = {
  fileUrl: string;
  fileName: string;
  fileMime: string;
  /**
   * URL inline servida por nuestro proxy (/api/contracts/[id]/file).
   * Necesaria para PDFs porque Vercel Blob añade Content-Security-Policy
   * que bloquea el render inline en iframe; el proxy elimina ese header.
   * Si no se pasa, se cae a `fileUrl` (puede forzar descarga).
   */
  inlineUrl?: string;
  className?: string;
  /** Altura mínima del visor; default h-[70vh] */
  heightClassName?: string;
};

const SLOW_THRESHOLD_MS = 6000;

/**
 * Visor de documentos:
 *  - PDF: <iframe> nativo apuntando al blob público (el navegador renderiza).
 *    Auto-carga; muestra "tardando demasiado" tras 6s.
 *  - Word (.doc/.docx): Office Online Viewer (view.officeapps.live.com).
 *    Opt-in (botón "Cargar vista previa") porque suele tardar 5-15s la
 *    primera vez. Mientras tanto se muestra un placeholder con descarga.
 */
export function ContractViewer({
  fileUrl,
  fileName,
  fileMime,
  inlineUrl,
  className,
  heightClassName = "h-[70vh]",
}: Props) {
  const pdfSrc = inlineUrl ?? fileUrl;
  const kind = useMemo<"pdf" | "word" | "other">(() => {
    if (isPdfMime(fileMime)) return "pdf";
    if (isWordMime(fileMime)) return "word";
    return "other";
  }, [fileMime]);

  // PDF carga inmediato; Word espera click del usuario.
  const [previewActive, setPreviewActive] = useState(kind === "pdf");
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!previewActive || loaded) return;
    const t = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [previewActive, loaded]);

  const officeUrl = useMemo(() => {
    if (kind !== "word") return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }, [kind, fileUrl]);

  const openInNewTab = () => window.open(pdfSrc, "_blank", "noopener,noreferrer");

  const KindIcon = kind === "pdf" ? FileText : kind === "word" ? FileType2 : FileWarning;
  const kindLabel = kind === "pdf" ? "PDF" : kind === "word" ? "Word" : "Archivo";

  return (
    <div className={cn("rounded-md ring-1 ring-inset ring-border overflow-hidden bg-muted/20", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background/50">
        <div className="text-xs truncate flex-1 flex items-center gap-2">
          <KindIcon className={cn("h-3.5 w-3.5 shrink-0", kind === "pdf" ? "text-rose-500" : kind === "word" ? "text-sky-500" : "text-muted-foreground")} />
          <span className="font-medium truncate">{fileName}</span>
          <span className="text-muted-foreground uppercase shrink-0">{kindLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openInNewTab} title="Abrir en pestaña nueva">
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Abrir</span>
          </Button>
          <Button size="sm" variant="ghost" asChild title="Descargar">
            <a
              href={inlineUrl ? `${inlineUrl}?download=1` : fileUrl}
              download={fileName}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Descargar</span>
            </a>
          </Button>
        </div>
      </div>

      <div className={cn("relative w-full bg-background", heightClassName)}>
        {/* Placeholder para Word antes del opt-in */}
        {kind === "word" && !previewActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileType2 className="h-10 w-10 text-sky-500" />
            <div className="text-sm font-medium">Vista previa de Word</div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Se renderiza con Office Online Viewer (Microsoft). Suele tardar entre 5 y 15 segundos la primera vez.
            </p>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant="brand" onClick={() => setPreviewActive(true)}>
                <Play className="h-3.5 w-3.5" /> Cargar vista previa
              </Button>
              <Button size="sm" variant="outline" onClick={openInNewTab}>
                <ExternalLink className="h-3.5 w-3.5" /> Descargar y abrir
              </Button>
            </div>
          </div>
        )}

        {/* Loading state mientras el iframe de Word se monta (PDF maneja su propio loader). */}
        {previewActive && !loaded && kind === "word" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando vista previa…</span>
            {slow && (
              <div className="flex flex-col items-center gap-2 mt-2 pointer-events-auto">
                <span className="text-amber-600 dark:text-amber-400">Está tardando más de lo normal.</span>
                <Button size="sm" variant="outline" onClick={openInNewTab}>
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir directo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* PDF render con pdfjs (no depende del visor nativo del browser) */}
        {previewActive && kind === "pdf" && (
          <div className="absolute inset-0">
            <PdfPreview src={pdfSrc} fileName={fileName} />
          </div>
        )}

        {/* Iframe Word/Office */}
        {previewActive && kind === "word" && officeUrl && (
          <iframe
            src={officeUrl}
            title={fileName}
            className="w-full h-full"
            onLoad={() => setLoaded(true)}
          />
        )}

        {/* Formato no soportado */}
        {kind === "other" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileWarning className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">No se puede previsualizar este formato</div>
            <div className="text-xs text-muted-foreground">{fileMime}</div>
            <Button variant="outline" size="sm" onClick={openInNewTab}>
              <ExternalLink className="h-3.5 w-3.5" /> Abrir archivo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
