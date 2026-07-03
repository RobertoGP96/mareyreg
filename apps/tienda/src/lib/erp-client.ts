import "server-only";

// Cliente hacia la API de webstore del ERP (apps/erp). Contrato documentado
// en docs/WEBSTORE.md; los tipos reflejan los endpoints reales:
// - GET  /api/webstore/products   (src/app/api/webstore/products/route.ts)
// - POST /api/webstore/orders     (src/app/api/webstore/orders/route.ts)
// - POST /api/webstore/customers  (src/app/api/webstore/customers/route.ts)

const BASE_URL = process.env.WEBSTORE_API_URL;
const API_KEY = process.env.WEBSTORE_API_KEY;

export interface WebstoreProductPresentation {
  sku: string;
  name: string;
  factor: number;
  retailPrice: number;
  wholesalePrice: number | null;
  barcode: string | null;
  isBase: boolean;
  /** Piezas por unidad de esta presentación (catch-weight: Pieza/Caja). null en productos normales. */
  piecesPerUnit: number | null;
  /** Peso nominal (kg) de esta presentación, solo catch-weight. Estimación — el peso real se captura al pesar el pedido. */
  nominalWeightKg: number | null;
  /** Precio estimado de la presentación (pricePerKg × nominalWeightKg), solo catch-weight. */
  estimatedPrice: number | null;
  /** Piezas disponibles en stock, solo catch-weight. */
  stockPieces: number | null;
}

export interface WebstoreProductOffer {
  name: string;
  type: "percent" | "fixed";
  value: number;
  endsAt: string | null;
}

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
  /** Presentaciones activas del producto (ej. caja, paquete). Vacío si no tiene. */
  presentations: WebstoreProductPresentation[];
  /** Oferta vigente que generó el precio con descuento, si aplica. */
  offer: WebstoreProductOffer | null;
  /** Producto de peso variable (ej. queso): el precio mostrado es ESTIMADO, el total real se ajusta al pesar el pedido en el ERP. */
  isCatchWeight: boolean;
  /** Precio efectivo por kg. Solo presente cuando isCatchWeight es true. */
  pricePerKg: number | null;
}

/** Moneda base del ERP (getBaseCurrency). Todos los montos del catálogo ya vienen convertidos a esta moneda — la tienda nunca convierte ni conoce tasas de cambio. */
export interface WebstoreCurrency {
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export interface CatalogResponse {
  currency: WebstoreCurrency;
  products: WebstoreProduct[];
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
  /** ISO 4217, 3 letras. Requerido: debe coincidir exactamente con la moneda base del ERP (ver WebstoreCurrency.code del catálogo). */
  currency: string;
  customer: OrderCustomer;
  lines: OrderLine[];
  payment?: OrderPayment;
  warehouseId?: number;
  notes?: string;
}

export interface OrderLineResult {
  sku: string;
  /** true si el precio de esta línea es estimado (catch-weight): el total real se ajusta al pesar el pedido. */
  priceIsEstimated: boolean;
  /** Peso nominal estimado (kg), solo presente en líneas catch-weight. */
  estimatedWeightKg?: number;
}

export type CreateOrderResult =
  | {
      status: "processed";
      logId: number;
      salesOrderId?: number | null;
      invoiceId?: number | null;
      lines?: OrderLineResult[];
    }
  | {
      /** Contiene líneas catch-weight: el pedido se factura hasta que se pese en el ERP, sin descuento de stock todavía. */
      status: "awaiting_weighing";
      logId: number;
      salesOrderId?: number | null;
      invoiceId?: number | null;
      lines?: OrderLineResult[];
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

export async function getCatalog(): Promise<CatalogResponse> {
  return erpFetch<CatalogResponse>("/api/webstore/products", {
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

export interface UpsertCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpsertCustomerResult {
  customerId: number;
  created: boolean;
}

/**
 * Crea o actualiza un cliente en el ERP (match por teléfono/email). Requiere
 * API key con scope "manage_customers". Respuestas: 201 creado, 200 ya
 * existía (idempotente). 400/401/403/429/500 se lanzan como ErpApiError.
 */
export async function upsertCustomer(
  input: UpsertCustomerInput
): Promise<UpsertCustomerResult> {
  return erpFetch<UpsertCustomerResult>("/api/webstore/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
