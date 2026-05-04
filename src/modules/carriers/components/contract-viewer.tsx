"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  ExternalLink,
  FileWarning,
  Loader2,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPdfMime, isWordMime } from "../lib/schemas";

type Props = {
  fileUrl: string;
  fileName: string;
  fileMime: string;
  className?: string;
  /** Altura mínima del visor; default h-[70vh] */
  heightClassName?: string;
};

/**
 * Visor de documentos:
 *  - PDF: <iframe> nativo apuntando al blob público (el navegador renderiza).
 *  - Word (.doc/.docx): Office Online Viewer (https://view.officeapps.live.com/op/embed.aspx?src=...).
 *    Requiere que `fileUrl` sea una URL pública accesible (Vercel Blob `access: "public"`).
 */
export function ContractViewer({
  fileUrl,
  fileName,
  fileMime,
  className,
  heightClassName = "h-[70vh]",
}: Props) {
  const [loaded, setLoaded] = useState(false);

  const kind = useMemo<"pdf" | "word" | "other">(() => {
    if (isPdfMime(fileMime)) return "pdf";
    if (isWordMime(fileMime)) return "word";
    return "other";
  }, [fileMime]);

  const officeUrl = useMemo(() => {
    if (kind !== "word") return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }, [kind, fileUrl]);

  const openInNewTab = () => window.open(fileUrl, "_blank", "noopener,noreferrer");

  return (
    <div className={cn("rounded-md ring-1 ring-inset ring-border overflow-hidden bg-muted/20", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background/50">
        <div className="text-xs truncate flex-1">
          <span className="font-medium">{fileName}</span>
          <span className="ml-2 text-muted-foreground uppercase">
            {kind === "pdf" ? "PDF" : kind === "word" ? "Word" : "Archivo"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openInNewTab} title="Abrir en pestaña nueva">
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Abrir</span>
          </Button>
          <Button size="sm" variant="ghost" asChild title="Descargar">
            <a href={fileUrl} download={fileName}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Descargar</span>
            </a>
          </Button>
        </div>
      </div>

      <div className={cn("relative w-full bg-background", heightClassName)}>
        {!loaded && kind !== "other" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando vista previa…
          </div>
        )}

        {kind === "pdf" && (
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full"
            onLoad={() => setLoaded(true)}
          />
        )}

        {kind === "word" && officeUrl && (
          <iframe
            src={officeUrl}
            title={fileName}
            className="w-full h-full"
            onLoad={() => setLoaded(true)}
          />
        )}

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
