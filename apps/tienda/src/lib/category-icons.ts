import {
  Hammer,
  Package,
  Shirt,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  alimentos: UtensilsCrossed,
  construccion: Hammer,
  ropa: Shirt,
  embalaje: Package,
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

function normalize(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

export function categoryIcon(name: string): LucideIcon {
  return ICONS[normalize(name)] ?? Package;
}
