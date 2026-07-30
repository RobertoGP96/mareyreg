"use client";

import { Minus, Plus } from "lucide-react";

interface QtyStepperProps {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "lg";
}

export function QtyStepper({ qty, onInc, onDec, size = "sm" }: QtyStepperProps) {
  const isLg = size === "lg";
  const btnClass = `flex flex-none items-center justify-center text-slate-400 transition-colors duration-150 hover:text-navy-900 ${
    isLg ? "h-10 w-10" : "h-8 w-8"
  }`;
  return (
    <div className="inline-flex items-center border border-line">
      <button
        type="button"
        onClick={onDec}
        aria-label="Disminuir cantidad"
        className={btnClass}
      >
        <Minus className="h-4 w-4" strokeWidth={1.6} />
      </button>
      <div
        className={`tabular text-center font-semibold text-navy-900 ${
          isLg ? "min-w-[34px] text-[15px]" : "min-w-[26px] text-[13px]"
        }`}
      >
        {qty}
      </div>
      <button
        type="button"
        onClick={onInc}
        aria-label="Aumentar cantidad"
        className={btnClass}
      >
        <Plus className="h-4 w-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}
