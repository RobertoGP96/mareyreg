import "server-only";

// Cliente hacia la API de webstore del ERP (apps/erp). Contrato documentado
// en docs/WEBSTORE.md; los tipos reflejan los endpoints reales:
// - GET  /api/webstore/products  (src/app/api/webstore/products/route.ts)
// - POST /api/webstore/orders    (src/app/api/webstore/orders/route.ts)

const BASE_URL = process.env.WEBSTORE_API_URL;
const API_KEY = process.env.WEBSTORE_API_KEY;

export interface WebstoreProduct {
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  compareAtPrice: number | null;
  featured: boolean;
  stockAvailable: number;
  imageUrl: string | null;
}

export interface OrderCustomer {
  email: string;
  name: string;
  phone?: string;
  taxId?: string;
  address?: string;
}

export interface OrderLine {
  sku: string;
  quantity: number;
  /** Informativo: el ERP recalcula el precio real con getEffectivePrice. */
  unitPrice: number;
}

export interface OrderPayment {
  amount: number;
  method: string;
  reference?: string;
}

export interface CreateOrderInput {
  externalOrderId: string;
  /** ISO 4217, 3 letras. El ERP asume "USD" si se omite. */
  currency?: string;
  customer: OrderCustomer;
  lines: OrderLine[];
  payment?: OrderPayment;
  warehouseId?: number;
  notes?: string;
}

export type CreateOrderResult =
  | {
      status: "processed";
      logId: number;
      salesOrderId?: number | null;
      invoiceId?: number | null;
    }
  | { status: "needs_review"; logId: number; unresolvedSkus?: string[] }
  | {
      status: "error" | "received";
      logId: number;
      salesOrderId?: number | null;
      invoiceId?: number | null;
      error?: string;
    };

export class ErpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`ERP API respondió ${status}`);
    this.name = "ErpApiError";
  }
}

function requireConfig(): { baseUrl: string; apiKey: string } {
  if (!BASE_URL || !API_KEY) {
    throw new Error(
      "Faltan WEBSTORE_API_URL o WEBSTORE_API_KEY en el entorno de la tienda"
    );
  }
  return { baseUrl: BASE_URL, apiKey: API_KEY };
}

async function erpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = requireConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ErpApiError(res.status, body);
  }
  return body as T;
}

export async function getProducts(): Promise<WebstoreProduct[]> {
  return erpFetch<WebstoreProduct[]>("/api/webstore/products", {
    // El catálogo cambia con precios/stock; no cachear en el server de la tienda.
    cache: "no-store",
  });
}

/**
 * Crea una orden en el ERP. Respuestas esperadas: 201 procesada, 200 ya
 * procesada (idempotente por externalOrderId), 202 requiere revisión manual.
 * 400/401/403/409/429/500 se lanzan como ErpApiError.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  return erpFetch<CreateOrderResult>("/api/webstore/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
