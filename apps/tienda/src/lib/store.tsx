"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { WebstoreCurrency } from "@/lib/erp-client";
import { DEFAULT_CURRENCY } from "@/lib/format";

const STORAGE_KEY = "tienda-store-v1";
const TOAST_MS = 1800;

export interface CartLine {
  sku: string;
  productSku: string;
  name: string;
  presentationName: string | null;
  unitPrice: number;
  qty: number;
  imageUrl: string | null;
  stockAvailable: number;
  /** true si el producto es de peso variable: el precio mostrado es estimado, el total real se ajusta al pesar el pedido. */
  isCatchWeight?: boolean;
  /** Precio por kg (catch-weight), informativo para el display. */
  pricePerKg?: number;
  /**
   * Pesajes elegidos por el cliente (catch-weight con registro de piezas):
   * el precio de la línea es la suma de `price` de cada pieza (ya redondeado
   * por el ERP) y qty === pieces.length. Ausente en líneas normales o de
   * peso estimado.
   */
  pieces?: Array<{ pieceId: number; weightKg: number; price: number }>;
}

export interface StoredProfile {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  erpCustomerId?: number;
}

export interface StoredOrder {
  no: string;
  dateIso: string;
  itemsCount: number;
  total: number;
  status: "En preparación" | "En revisión" | "Por pesar";
}

export interface StoreState {
  hydrated: boolean;
  cart: Record<string, CartLine>;
  favs: string[];
  profile: StoredProfile | null;
  orders: StoredOrder[];
  couponApplied: boolean;
  toast: string | null;
  /** Moneda del catálogo (getBaseCurrency en el ERP). DEFAULT_CURRENCY mientras carga la primera página. */
  currency: WebstoreCurrency;
}

type PersistedState = Pick<
  StoreState,
  "cart" | "favs" | "profile" | "orders" | "couponApplied" | "currency"
>;

type Action =
  | { type: "hydrate"; payload: Partial<PersistedState> }
  | { type: "addToCart"; line: CartLine; qty: number }
  | { type: "incQty"; sku: string }
  | { type: "decQty"; sku: string }
  | { type: "removeLine"; sku: string }
  | { type: "removePiece"; sku: string; pieceId: number }
  | { type: "removePieces"; pieceIds: number[] }
  | { type: "clearCart" }
  | { type: "toggleFav"; productSku: string }
  | { type: "setProfile"; profile: StoredProfile }
  | { type: "clearProfile" }
  | { type: "addOrder"; order: StoredOrder }
  | { type: "applyCoupon" }
  | { type: "setToast"; toast: string | null }
  | { type: "setCurrency"; currency: WebstoreCurrency };

const initialState: StoreState = {
  hydrated: false,
  cart: {},
  favs: [],
  profile: null,
  orders: [],
  couponApplied: false,
  toast: null,
  currency: DEFAULT_CURRENCY,
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, hydrated: true };
    case "addToCart": {
      const existing = state.cart[action.line.sku];
      let next: CartLine;
      if (action.line.pieces) {
        // Línea por piezas: merge sin duplicar pieceIds; qty SIEMPRE es el
        // número de piezas. Si la línea existente era de peso estimado, la
        // versión con piezas la reemplaza (no se mezclan tipos de pesaje).
        const existingPieces = existing?.pieces ?? [];
        const seen = new Set(existingPieces.map((p) => p.pieceId));
        const merged = [
          ...existingPieces,
          ...action.line.pieces.filter((p) => !seen.has(p.pieceId)),
        ];
        next = { ...action.line, pieces: merged, qty: merged.length };
      } else if (existing?.pieces) {
        // Versión estimada sobre línea con piezas: reemplaza (el catálogo ya
        // no ofrece piezas para este producto).
        next = { ...action.line, qty: action.qty };
      } else if (existing) {
        next = { ...existing, qty: existing.qty + action.qty };
      } else {
        next = { ...action.line, qty: action.qty };
      }
      return { ...state, cart: { ...state.cart, [action.line.sku]: next } };
    }
    case "incQty": {
      const line = state.cart[action.sku];
      if (!line || line.pieces) return state;
      return {
        ...state,
        cart: { ...state.cart, [action.sku]: { ...line, qty: line.qty + 1 } },
      };
    }
    case "decQty": {
      const line = state.cart[action.sku];
      if (!line || line.pieces) return state;
      if (line.qty <= 1) {
        const { [action.sku]: _removed, ...rest } = state.cart;
        return { ...state, cart: rest };
      }
      return {
        ...state,
        cart: { ...state.cart, [action.sku]: { ...line, qty: line.qty - 1 } },
      };
    }
    case "removeLine": {
      const { [action.sku]: _removed, ...rest } = state.cart;
      return { ...state, cart: rest };
    }
    case "removePiece": {
      const line = state.cart[action.sku];
      if (!line?.pieces) return state;
      const pieces = line.pieces.filter((p) => p.pieceId !== action.pieceId);
      if (!pieces.length) {
        const { [action.sku]: _removed, ...rest } = state.cart;
        return { ...state, cart: rest };
      }
      return {
        ...state,
        cart: { ...state.cart, [action.sku]: { ...line, pieces, qty: pieces.length } },
      };
    }
    case "removePieces": {
      // Limpieza post-409 pieces_unavailable: quita las piezas perdidas de
      // cualquier línea; una línea que queda sin piezas se elimina.
      const ids = new Set(action.pieceIds);
      const cart: Record<string, CartLine> = {};
      for (const [sku, line] of Object.entries(state.cart)) {
        if (!line.pieces) {
          cart[sku] = line;
          continue;
        }
        const pieces = line.pieces.filter((p) => !ids.has(p.pieceId));
        if (pieces.length) cart[sku] = { ...line, pieces, qty: pieces.length };
      }
      return { ...state, cart };
    }
    case "clearCart":
      return { ...state, cart: {}, couponApplied: false };
    case "toggleFav":
      return {
        ...state,
        favs: state.favs.includes(action.productSku)
          ? state.favs.filter((sku) => sku !== action.productSku)
          : [...state.favs, action.productSku],
      };
    case "setProfile":
      return { ...state, profile: action.profile };
    case "clearProfile":
      return { ...state, profile: null };
    case "addOrder":
      return { ...state, orders: [action.order, ...state.orders] };
    case "applyCoupon":
      return { ...state, couponApplied: true };
    case "setToast":
      return { ...state, toast: action.toast };
    case "setCurrency":
      return { ...state, currency: action.currency };
    default:
      return state;
  }
}

function readPersisted(): Partial<PersistedState> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const data = parsed as Record<string, unknown>;
    const result: Partial<PersistedState> = {};
    if (typeof data.cart === "object" && data.cart !== null) {
      result.cart = data.cart as Record<string, CartLine>;
    }
    if (Array.isArray(data.favs)) {
      result.favs = data.favs.filter(
        (sku): sku is string => typeof sku === "string"
      );
    }
    if (typeof data.profile === "object" && data.profile !== null) {
      result.profile = data.profile as StoredProfile;
    }
    if (Array.isArray(data.orders)) {
      result.orders = data.orders as StoredOrder[];
    }
    if (typeof data.couponApplied === "boolean") {
      result.couponApplied = data.couponApplied;
    }
    if (
      typeof data.currency === "object" &&
      data.currency !== null &&
      typeof (data.currency as Record<string, unknown>).code === "string"
    ) {
      result.currency = data.currency as WebstoreCurrency;
    }
    return result;
  } catch {
    return {};
  }
}

export interface StoreApi {
  state: StoreState;
  addToCart: (line: CartLine, qty: number) => void;
  incQty: (sku: string) => void;
  decQty: (sku: string) => void;
  removeLine: (sku: string) => void;
  removePiece: (sku: string, pieceId: number) => void;
  removePieces: (pieceIds: number[]) => void;
  clearCart: () => void;
  toggleFav: (productSku: string) => void;
  setProfile: (profile: StoredProfile) => void;
  clearProfile: () => void;
  addOrder: (order: StoredOrder) => void;
  applyCoupon: () => void;
  showToast: (msg: string) => void;
  setCurrency: (currency: WebstoreCurrency) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch({ type: "hydrate", payload: readPersisted() });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const snapshot: PersistedState = {
      cart: state.cart,
      favs: state.favs,
      profile: state.profile,
      orders: state.orders,
      couponApplied: state.couponApplied,
      currency: state.currency,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // localStorage lleno o bloqueado: la sesión sigue funcionando en memoria
    }
  }, [
    state.hydrated,
    state.cart,
    state.favs,
    state.profile,
    state.orders,
    state.couponApplied,
    state.currency,
  ]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    dispatch({ type: "setToast", toast: msg });
    toastTimer.current = setTimeout(
      () => dispatch({ type: "setToast", toast: null }),
      TOAST_MS
    );
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      addToCart: (line, qty) => dispatch({ type: "addToCart", line, qty }),
      incQty: (sku) => dispatch({ type: "incQty", sku }),
      decQty: (sku) => dispatch({ type: "decQty", sku }),
      removeLine: (sku) => dispatch({ type: "removeLine", sku }),
      removePiece: (sku, pieceId) => dispatch({ type: "removePiece", sku, pieceId }),
      removePieces: (pieceIds) => dispatch({ type: "removePieces", pieceIds }),
      clearCart: () => dispatch({ type: "clearCart" }),
      toggleFav: (productSku) => dispatch({ type: "toggleFav", productSku }),
      setProfile: (profile) => dispatch({ type: "setProfile", profile }),
      clearProfile: () => dispatch({ type: "clearProfile" }),
      addOrder: (order) => dispatch({ type: "addOrder", order }),
      applyCoupon: () => dispatch({ type: "applyCoupon" }),
      showToast,
      setCurrency: (currency) => dispatch({ type: "setCurrency", currency }),
    }),
    [state, showToast]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore debe usarse dentro de <StoreProvider>");
  }
  return ctx;
}

/**
 * Sincroniza al store la moneda que trae el catálogo de esta carga de
 * página (cada page server-side hace su propio getCatalog()). Se llama una
 * vez por page-client; evita enhebrar `currency` como prop por todo el
 * árbol — los componentes de precio simplemente leen `state.currency`.
 */
export function useSyncCurrency(currency: WebstoreCurrency): void {
  const { state, setCurrency } = useStore();
  useEffect(() => {
    if (
      state.currency.code !== currency.code ||
      state.currency.symbol !== currency.symbol ||
      state.currency.decimalPlaces !== currency.decimalPlaces
    ) {
      setCurrency(currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-sincroniza cuando cambia la currency recibida, no en cada render del store
  }, [currency.code, currency.symbol, currency.decimalPlaces]);
}

export function cartLines(state: StoreState): CartLine[] {
  return Object.values(state.cart);
}

export function cartCount(state: StoreState): number {
  return cartLines(state).reduce((sum, line) => sum + line.qty, 0);
}
