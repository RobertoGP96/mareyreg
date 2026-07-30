"use client";

import { useStore } from "@/lib/store";

export function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  return (
    <div className="toast-pop nav-label z-50 bg-navy-900 px-5 py-3 whitespace-nowrap text-canvas">
      {state.toast}
    </div>
  );
}
