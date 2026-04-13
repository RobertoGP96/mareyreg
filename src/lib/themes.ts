export interface ColorPalette {
  id: string;
  label: string;
  previewColors: [string, string, string]; // [sidebar, primary, accent]
}

export const COLOR_PALETTES: ColorPalette[] = [
  { id: "navy", label: "Navy", previewColors: ["#001e40", "#003366", "#ff7010"] },
  { id: "ocean", label: "Ocean", previewColors: ["#0c4a5e", "#0891b2", "#06b6d4"] },
  { id: "sunset", label: "Sunset", previewColors: ["#451a03", "#d97706", "#eab308"] },
  { id: "royal", label: "Royal", previewColors: ["#2e1065", "#7c3aed", "#818cf8"] },
];

export const COLOR_THEMES = COLOR_PALETTES.map((p) => ({
  id: p.id,
  label: p.label,
  color: p.previewColors[1],
}));

export const DEFAULT_THEME = "navy";
