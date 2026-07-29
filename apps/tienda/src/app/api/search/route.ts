import { NextResponse } from "next/server";
import { getCatalog, type CatalogResponse } from "@/lib/erp-client";
import { DEFAULT_CURRENCY } from "@/lib/format";
import {
  MIN_SEARCH_LENGTH,
  searchProducts,
  type SearchResponse,
} from "@/lib/search";

const MAX_TERM_LENGTH = 80;

// Cache breve en memoria: el buscador del navbar dispara una petición por
// pausa de tecleo y el catálogo completo del ERP no cambia tan rápido como
// para pagar un round-trip por cada una. Best-effort en serverless (por
// instancia), suficiente para amortiguar la escritura rápida.
const CATALOG_TTL_MS = 30_000;
let catalogCache: { data: CatalogResponse; expiresAt: number } | null = null;

async function getCatalogCached(): Promise<CatalogResponse> {
  if (catalogCache && Date.now() < catalogCache.expiresAt) {
    return catalogCache.data;
  }
  const data = await getCatalog();
  catalogCache = { data, expiresAt: Date.now() + CATALOG_TTL_MS };
  return data;
}

export async function GET(request: Request): Promise<NextResponse> {
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const term = raw.trim().slice(0, MAX_TERM_LENGTH);

  if (term.length < MIN_SEARCH_LENGTH) {
    const empty: SearchResponse = {
      currency: DEFAULT_CURRENCY,
      results: [],
      total: 0,
    };
    return NextResponse.json(empty);
  }

  try {
    const catalog = await getCatalogCached();
    const { results, total } = searchProducts(catalog.products, term);
    const body: SearchResponse = {
      // Tolerancia al desfase de deploy tienda/ERP: un ERP viejo podría no
      // mandar currency en el catálogo.
      currency: catalog.currency ?? DEFAULT_CURRENCY,
      results,
      total,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("GET /api/search:", e);
    return NextResponse.json(
      { error: "No se pudo buscar productos" },
      { status: 502 }
    );
  }
}
