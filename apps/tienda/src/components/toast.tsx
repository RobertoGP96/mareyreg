"use client";

import { useStore } from "@/lib/store";

export function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  return (
    <div className="toast-pop z-50 rounded-xl bg-navy px-[18px] py-[11px] text-[13px] font-medium whitespace-nowrap text-white shadow-[0_6px_20px_rgba(10,31,63,.35)]">
      {state.toast}
    </div>
  );
}
