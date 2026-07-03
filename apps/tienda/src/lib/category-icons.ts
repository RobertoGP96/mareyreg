const ICONS: Record<string, string> = {
  alimentos: "◍",
  construccion: "⌂",
  ropa: "◘",
  embalaje: "▣",
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

function normalize(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

export function categoryIcon(name: string): string {
  return ICONS[normalize(name)] ?? "▣";
}
