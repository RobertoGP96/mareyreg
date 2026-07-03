"use client";

interface QtyStepperProps {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "lg";
}

export function QtyStepper({ qty, onInc, onDec, size = "sm" }: QtyStepperProps) {
  const isLg = size === "lg";
  return (
    <div
      className={`flex items-center bg-app ${
        isLg
          ? "gap-3.5 rounded-xl px-3.5 py-2"
          : "gap-2.5 rounded-[10px] px-2.5 py-[5px]"
      }`}
    >
      <button
        type="button"
        onClick={onDec}
        aria-label="Disminuir cantidad"
        className={`font-bold text-brand-mid ${isLg ? "w-5 text-[17px]" : "text-[15px]"}`}
      >
        −
      </button>
      <div
        className={`text-center font-semibold text-navy ${
          isLg ? "min-w-[22px] text-[15px]" : "min-w-4 text-[13.5px]"
        }`}
      >
        {qty}
      </div>
      <button
        type="button"
        onClick={onInc}
        aria-label="Aumentar cantidad"
        className={`font-bold text-brand-mid ${isLg ? "w-5 text-[17px]" : "text-[15px]"}`}
      >
        +
      </button>
    </div>
  );
}
