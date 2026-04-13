"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DEFAULT_THEME, COLOR_PALETTES } from "@/lib/themes";

interface ColorThemeContextType {
  colorTheme: string;
  setColorTheme: (theme: string) => void;
}

export const ColorThemeContext = createContext<ColorThemeContextType>({
  colorTheme: DEFAULT_THEME,
  setColorTheme: () => {},
});

export function useColorTheme() {
  return useContext(ColorThemeContext);
}

export function useColorThemeState() {
  const [colorTheme, setColorThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    let stored = localStorage.getItem("color-theme");

    // Migrate old theme IDs
    if (stored === "neutral") {
      stored = "navy";
      localStorage.setItem("color-theme", stored);
    }

    if (stored && COLOR_PALETTES.some((t) => t.id === stored)) {
      setColorThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (stored) {
      // Old theme ID no longer exists, reset to default
      localStorage.removeItem("color-theme");
    }
  }, []);

  const setColorTheme = useCallback((theme: string) => {
    setColorThemeState(theme);
    localStorage.setItem("color-theme", theme);
    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, []);

  return { colorTheme, setColorTheme };
}
