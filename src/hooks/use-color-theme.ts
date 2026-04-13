"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DEFAULT_THEME, COLOR_THEMES } from "@/lib/themes";

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
    const stored = localStorage.getItem("color-theme");
    if (stored && COLOR_THEMES.some((t) => t.id === stored)) {
      setColorThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
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
