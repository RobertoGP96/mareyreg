"use client";

import { createContext, useContext } from "react";

interface ColorThemeContextType {
  colorTheme: string;
  setColorTheme: (theme: string) => void;
}

export const ColorThemeContext = createContext<ColorThemeContextType>({
  colorTheme: "default",
  setColorTheme: () => {},
});

export function useColorTheme() {
  return useContext(ColorThemeContext);
}

export function useColorThemeState() {
  return {
    colorTheme: "default",
    setColorTheme: () => {},
  };
}
