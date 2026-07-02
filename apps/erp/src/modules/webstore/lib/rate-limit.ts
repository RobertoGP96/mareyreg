import { db } from "@/lib/db";

/**
 * Límites por defecto de la API pública de la tienda en línea, en requests
 * por ventana de 1 minuto. Configurables aquí sin tocar los endpoints.
 */
export const WEBSTORE_RATE_LIMITS = {
  /** Por API key, endpoint de creación de órdenes. */
  ordersPerApiKey: 30,
  /** Por API key, endpoint de catálogo (lectura, más permisivo). */
  productsPerApiKey: 120,
  /**
   * Por IP, aplicado ANTES de resolver la API key. Protege resolveApiKey
   * (bcrypt.compare en loop) de fuerza bruta con keys inválidas.
   */
  authAttemptsPerIp: 20,
} as const;

const WINDOW_MS = 60_000;

/** Probabilidad de disparar la limpieza perezosa de ventanas viejas en cada request. */
const CLEANUP_PROBABILITY = 0.02;
/** Ventanas con más de este margen se consideran vencidas y se pueden purgar. */
const CLEANUP_RETENTION_MS = 5 * 60_000;

function truncateToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / WINDOW_MS) * WINDOW_MS);
}

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos hasta que la ventana actual expire, para el header Retry-After. */
  retryAfterSeconds: number;
}

/**
 * Incrementa atómicamente el contador de una ventana fija de 1 minuto para
 * `bucketKey` y evalúa si excede `limit`. El upsert con `increment` es
 * atómico a nivel de fila en Postgres, por lo que es seguro bajo concurrencia
 * multi-instancia sin necesidad de locks explícitos.
 */
export async function checkRateLimit(bucketKey: string, limit: number): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = truncateToMinute(now);

  const row = await db.webstoreRateLimit.upsert({
    where: { bucketKey_windowStart: { bucketKey, windowStart } },
    create: { bucketKey, windowStart, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });

  const retryAfterSeconds = Math.ceil((windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000);

  if (Math.random() < CLEANUP_PROBABILITY) {
    void cleanupOldWindows();
  }

  return {
    allowed: row.requestCount <= limit,
    retryAfterSeconds: Math.max(retryAfterSeconds, 1),
  };
}

/**
 * Borra ventanas vencidas para no acumular filas indefinidamente. Se llama
 * de forma perezosa y "fire and forget"; nunca debe bloquear ni fallar el
 * request que la disparó.
 */
async function cleanupOldWindows(): Promise<void> {
  try {
    const threshold = new Date(Date.now() - CLEANUP_RETENTION_MS);
    await db.webstoreRateLimit.deleteMany({ where: { windowStart: { lt: threshold } } });
  } catch (error) {
    console.error("[webstore/rate-limit] error limpiando ventanas viejas:", error);
  }
}

/** Extrae la IP del cliente considerando proxies (Vercel agrega x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Respuesta 429 estándar con header Retry-After, para reusar en ambos
 * endpoints públicos.
 */
export function rateLimitExceededResponseInit(retryAfterSeconds: number): ResponseInit {
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  };
}
