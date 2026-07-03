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
  status: "En preparación" | "En revisión";
}

export interface StoreState {
  hydrated: boolean;
  cart: Record<string, CartLine>;
  favs: string[];
  profile: StoredProfile | null;
  orders: StoredOrder[];
  couponApplied: boolean;
  toast: string | null;
}

type PersistedState = Pick<
  StoreState,
  "cart" | "favs" | "profile" | "orders" | "couponApplied"
>;

type Action =
  | { type: "hydrate"; payload: Partial<PersistedState> }
  | { type: "addToCart"; line: CartLine; qty: number }
  | { type: "incQty"; sku: string }
  | { type: "decQty"; sku: string }
  | { type: "removeLine"; sku: string }
  | { type: "clearCart" }
  | { type: "toggleFav"; productSku: string }
  | { type: "setProfile"; profile: StoredProfile }
  | { type: "clearProfile" }
  | { type: "addOrder"; order: StoredOrder }
  | { type: "applyCoupon" }
  | { type: "setToast"; toast: string | null };

const initialState: StoreState = {
  hydrated: false,
  cart: {},
  favs: [],
  profile: null,
  orders: [],
  couponApplied: false,
  toast: null,
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, hydrated: true };
    case "addToCart": {
      const existing = state.cart[action.line.sku];
      const next: CartLine = existing
        ? { ...existing, qty: existing.qty + action.qty }
        : { ...action.line, qty: action.qty };
      return { ...state, cart: { ...state.cart, [action.line.sku]: next } };
    }
    case "incQty": {
      const line = state.cart[action.sku];
      if (!line) return state;
      return {
        ...state,
        cart: { ...state.cart, [action.sku]: { ...line, qty: line.qty + 1 } },
      };
    }
    case "decQty": {
      const line = state.cart[action.sku];
      if (!line) return state;
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
  clearCart: () => void;
  toggleFav: (productSku: string) => void;
  setProfile: (profile: StoredProfile) => void;
  clearProfile: () => void;
  addOrder: (order: StoredOrder) => void;
  applyCoupon: () => void;
  showToast: (msg: string) => void;
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
      clearCart: () => dispatch({ type: "clearCart" }),
      toggleFav: (productSku) => dispatch({ type: "toggleFav", productSku }),
      setProfile: (profile) => dispatch({ type: "setProfile", profile }),
      clearProfile: () => dispatch({ type: "clearProfile" }),
      addOrder: (order) => dispatch({ type: "addOrder", order }),
      applyCoupon: () => dispatch({ type: "applyCoupon" }),
      showToast,
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

export function cartLines(state: StoreState): CartLine[] {
  return Object.values(state.cart);
}

export function cartCount(state: StoreState): number {
  return cartLines(state).reduce((sum, line) => sum + line.qty, 0);
}
