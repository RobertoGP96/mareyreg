"use client";

import { useTheme } from "next-themes";
import { Toaster as SileoToaster } from "sileo";
import "sileo/styles.css";

export function Toaster() {
  const { theme = "system" } = useTheme();

  return (
    <SileoToaster
      position="top-right"
      theme={theme as "light" | "dark" | "system"}
    />
  );
}
