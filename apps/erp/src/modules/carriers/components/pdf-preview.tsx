"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, AlertTriangle, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker self-hosteado en /public/pdfjs/ (más confiable que unpkg/CDNs externos
// y evita problemas de CSP/CORS). Sincronizado manualmente con la versión
// instalada de pdfjs-dist (ver scripts/copy-pdf-worker o postinstall).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

type Props = {
  /** URL del PDF (preferiblemente la del proxy /api/contracts/[id]/file). */
  src: string;
  /** Mostrado en errores y como aria-label. */
  fileName: string;
  className?: string;
};

export function PdfPreview({ src, fileName, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState<number | null>(null);

  // El objeto `file` y `options` deben ser estables — si cambian de identidad
  // entre renders, react-pdf re-descarga el PDF.
  const file = useMemo(
    () => ({ url: src, withCredentials: true }),
    [src],
  );
  const documentOptions = useMemo(
    () => ({
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      withCredentials: true,
    }),
    [],
  );

  // Ajuste de ancho responsivo: la página se renderiza al ancho del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      // Margen interno; dejamos un poco de aire a los lados.
      setWidth(Math.max(280, w - 24));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-auto bg-muted/20",
        className,
      )}
    >
      {/* Toolbar flotante */}
      {numPages !== null && (
        <div className="sticky top-2 z-10 mx-auto flex w-fit items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 shadow-sm backdrop-blur">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            title="Reducir"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="font-mono tabular-nums text-[10px] w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            title="Ampliar"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <span className="mx-1 h-3 w-px bg-border" />
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotar"
          >
            <RotateCw className="h-3 w-3" />
          </Button>
          <span className="mx-1 h-3 w-px bg-border" />
          <span className="font-mono tabular-nums text-[10px] px-1">
            {numPages} {numPages === 1 ? "página" : "páginas"}
          </span>
        </div>
      )}

      <div className="px-3 pb-6 -mt-8">
        <Document
          file={file}
          loading={
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando PDF…
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-2 py-12 px-4 text-center text-xs text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <div>No se pudo cargar el PDF</div>
              {loadError && (
                <div className="text-muted-foreground font-mono break-all">{loadError}</div>
              )}
            </div>
          }
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setLoadError(null);
          }}
          onLoadError={(err) => {
            console.error("[PdfPreview] load error:", err);
            setLoadError(err.message);
          }}
          options={documentOptions}
        >
          {numPages !== null &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
              <div key={pageNumber} className="mt-4 flex justify-center">
                <Page
                  pageNumber={pageNumber}
                  width={width ?? undefined}
                  scale={scale}
                  rotate={rotation}
                  className="shadow-md ring-1 ring-border bg-white"
                  loading={
                    <div className="flex items-center justify-center w-full py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin mr-2" /> Página {pageNumber}…
                    </div>
                  }
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                />
              </div>
            ))}
        </Document>
      </div>

      <span className="sr-only">{fileName}</span>
    </div>
  );
}
