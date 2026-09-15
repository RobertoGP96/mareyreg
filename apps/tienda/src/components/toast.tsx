"use client";

import { useStore } from "@/lib/store";

export function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  return (
    <div
      role="status"
      className="toast-pop z-50 max-w-[calc(100vw-40px)] truncate rounded-full bg-navy-900 px-5 py-3 text-[13px] font-medium whitespace-nowrap text-canvas shadow-float"
    >
      {state.toast}
    </div>
  );
}
