export type ShareGroup = {
  classification: string;
  categories: { name: string; available: number }[];
};

export type ShareOptions = {
  date: Date;
  title?: string;
  cta?: string;
  includeDate?: boolean;
  includeTotal?: boolean;
};

export const DEFAULT_SHARE_TITLE = "PACAS DISPONIBLES";

export function toShareGroups<
  T extends {
    classification: string;
    categories: { name: string; available: number }[];
  },
>(data: T[]): ShareGroup[] {
  return data
    .map((g) => ({
      classification: g.classification,
      categories: g.categories
        .filter((c) => c.available > 0)
        .map((c) => ({ name: c.name, available: c.available })),
    }))
    .filter((g) => g.categories.length > 0);
}

export function formatShareDate(date: Date): string {
  return date
    .toLocaleDateString("es-DO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\.$/, "");
}

export function totalAvailable(groups: ShareGroup[]): number {
  return groups.reduce(
    (sum, g) => sum + g.categories.reduce((s, c) => s + c.available, 0),
    0
  );
}

export function formatAvailabilityText(
  data: ShareGroup[],
  opts: ShareOptions
): string {
  const groups = toShareGroups(data);
  const title = (opts.title ?? DEFAULT_SHARE_TITLE).trim() || DEFAULT_SHARE_TITLE;
  const includeDate = opts.includeDate ?? true;
  const includeTotal = opts.includeTotal ?? true;
  const cta = (opts.cta ?? "").trim();

  const lines: string[] = [];
  const header = includeDate
    ? `${title} — ${formatShareDate(opts.date)}`
    : title;
  lines.push(header);
  lines.push("");

  for (const group of groups) {
    lines.push(group.classification.toUpperCase());
    for (const cat of group.categories) {
      lines.push(`• ${cat.name} — ${cat.available}`);
    }
    lines.push("");
  }

  if (includeTotal) {
    lines.push(`Total disponible: ${totalAvailable(groups)}`);
  }

  if (cta) {
    if (includeTotal) lines.push("");
    lines.push(cta);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
