"use client";

import { sileo } from "sileo";
import type { ReactNode } from "react";

interface ToastOptions {
  description?: ReactNode;
  duration?: number | null;
}

// Adaptador sobre Sileo con la firma estilo Sonner usada en todo el proyecto:
// toast.success("Título", { description: "..." }). Cambios de librería de
// toasts se hacen solo aquí, sin tocar los call-sites.
export const toast = {
  success: (title: string, options?: ToastOptions): string =>
    sileo.success({ title, ...options }),
  error: (title: string, options?: ToastOptions): string =>
    sileo.error({ title, ...options }),
  warning: (title: string, options?: ToastOptions): string =>
    sileo.warning({ title, ...options }),
  info: (title: string, options?: ToastOptions): string =>
    sileo.info({ title, ...options }),
};