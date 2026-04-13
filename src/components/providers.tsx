"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ColorThemeContext, useColorThemeState } from "@/hooks/use-color-theme";

function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const state = useColorThemeState();
  return (
    <ColorThemeContext.Provider value={state}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ColorThemeProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </ColorThemeProvider>
    </ThemeProvider>
  );
}
