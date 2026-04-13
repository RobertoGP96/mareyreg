export interface ColorTheme {
  id: string;
  label: string;
  color: string; // Preview color for swatch
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: "neutral", label: "Navy", color: "#1e293b" },
  { id: "blue", label: "Azul", color: "#2563eb" },
  { id: "green", label: "Verde", color: "#16a34a" },
  { id: "purple", label: "Purpura", color: "#9333ea" },
  { id: "orange", label: "Naranja", color: "#ea580c" },
  { id: "rose", label: "Rosa", color: "#e11d48" },
  { id: "teal", label: "Teal", color: "#0d9488" },
];

export const DEFAULT_THEME = "neutral";
