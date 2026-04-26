import {
  toShareGroups,
  formatShareDate,
  totalAvailable,
  DEFAULT_SHARE_TITLE,
  type ShareGroup,
  type ShareOptions,
} from "./format-availability-share";

const W = 1080;
const H = 1350;

const COLORS = {
  bgTop: "#EFF4FF",
  bgBottom: "#FFFFFF",
  glow: "rgba(37, 99, 235, 0.18)",
  glowSoft: "rgba(96, 165, 250, 0.10)",
  brandDark: "#1E3A8A",
  brand: "#2563EB",
  brandLight: "#60A5FA",
  brandSoft: "rgba(37, 99, 235, 0.08)",
  brandRing: "rgba(37, 99, 235, 0.22)",
  text: "#0F172A",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  divider: "#E2E8F0",
  pillBg: "rgba(16, 185, 129, 0.12)",
  pillText: "#047857",
  ctaBg: "#0F172A",
  ctaText: "#FFFFFF",
  cardBg: "rgba(255, 255, 255, 0.7)",
  cardBorder: "rgba(15, 23, 42, 0.06)",
} as const;

const FONT_STACK = `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;

type RenderOpts = ShareOptions & {
  brandName?: string;
  subtitle?: string;
};

export async function renderAvailabilityPng<
  T extends {
    classification: string;
    categories: { name: string; available: number }[];
  },
>(data: T[], opts: RenderOpts): Promise<Blob> {
  const groups = toShareGroups(data);
  const total = totalAvailable(groups);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  drawBackground(ctx);
  drawCornerGlows(ctx);
  drawHeader(ctx, opts, groups.length, total);

  const bodyTop = 360;
  const bodyBottom = H - 220;
  drawBody(ctx, groups, bodyTop, bodyBottom);

  drawFooter(ctx, opts, total);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png"
    );
  });
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLORS.bgTop);
  grad.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawCornerGlows(ctx: CanvasRenderingContext2D) {
  const tr = ctx.createRadialGradient(W - 80, 80, 0, W - 80, 80, 360);
  tr.addColorStop(0, COLORS.glow);
  tr.addColorStop(1, "rgba(37, 99, 235, 0)");
  ctx.fillStyle = tr;
  ctx.fillRect(0, 0, W, 600);

  const bl = ctx.createRadialGradient(120, H - 120, 0, 120, H - 120, 320);
  bl.addColorStop(0, COLORS.glowSoft);
  bl.addColorStop(1, "rgba(96, 165, 250, 0)");
  ctx.fillStyle = bl;
  ctx.fillRect(0, H - 600, W, 600);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  groupCount: number,
  total: number
) {
  const padX = 72;

  const monoSize = 84;
  const monoX = padX;
  const monoY = 80;

  const monoGrad = ctx.createLinearGradient(
    monoX,
    monoY,
    monoX + monoSize,
    monoY + monoSize
  );
  monoGrad.addColorStop(0, COLORS.brandDark);
  monoGrad.addColorStop(0.5, COLORS.brand);
  monoGrad.addColorStop(1, COLORS.brandLight);

  ctx.fillStyle = monoGrad;
  roundedRect(ctx, monoX, monoY, monoSize, monoSize, 22);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 44px ${FONT_STACK}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("GR", monoX + monoSize / 2, monoY + monoSize / 2 + 2);
  ctx.textAlign = "start";

  const textX = monoX + monoSize + 22;
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 40px ${FONT_STACK}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.brandName ?? "GR Technology", textX, monoY + 36);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `500 20px ${FONT_STACK}`;
  ctx.fillText(opts.subtitle ?? "Disponibilidad de pacas", textX, monoY + 68);

  const titleY = 230;
  const title =
    (opts.title?.trim() || DEFAULT_SHARE_TITLE).toUpperCase();

  ctx.fillStyle = COLORS.text;
  ctx.font = `900 56px ${FONT_STACK}`;
  ctx.fillText(title, padX, titleY);

  const includeDate = opts.includeDate ?? true;
  if (includeDate) {
    drawPill(
      ctx,
      padX,
      titleY + 28,
      `Actualizado al ${formatShareDate(opts.date)}`,
      {
        bg: COLORS.brandSoft,
        text: COLORS.brand,
        ring: COLORS.brandRing,
        font: `600 18px ${FONT_STACK}`,
        padX: 14,
        h: 34,
      }
    );
  }

  const summaryX = padX;
  const summaryY = includeDate ? titleY + 74 : titleY + 36;
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `500 18px ${FONT_STACK}`;
  ctx.fillText(
    `${groupCount} ${groupCount === 1 ? "clasificación" : "clasificaciones"} · ${total} ${total === 1 ? "paca lista" : "pacas listas"}`,
    summaryX,
    summaryY
  );
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  groups: ShareGroup[],
  top: number,
  bottom: number
) {
  const padX = 72;
  const groupGap = 28;
  const rowH = 46;
  const groupHeaderH = 54;

  let y = top;
  let truncatedCount = 0;
  let drewSomething = false;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const remaining = bottom - y;

    if (remaining < groupHeaderH + rowH) {
      truncatedCount += groups
        .slice(gi)
        .reduce((s, g) => s + g.categories.length, 0);
      break;
    }

    const groupAvailable = group.categories.reduce((s, c) => s + c.available, 0);
    const headerY = y;

    ctx.fillStyle = COLORS.brand;
    roundedRect(ctx, padX, headerY + 8, 6, 32, 3);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.font = `800 26px ${FONT_STACK}`;
    ctx.textBaseline = "middle";
    ctx.fillText(group.classification.toUpperCase(), padX + 22, headerY + 24);

    drawPill(
      ctx,
      W - padX,
      headerY + 24,
      `${groupAvailable}`,
      {
        bg: COLORS.pillBg,
        text: COLORS.pillText,
        ring: "rgba(16, 185, 129, 0.25)",
        font: `800 20px ${FONT_STACK}`,
        padX: 16,
        h: 36,
        anchor: "right",
        center: true,
      }
    );

    y += groupHeaderH;
    drewSomething = true;

    for (let ci = 0; ci < group.categories.length; ci++) {
      const cat = group.categories[ci];
      if (y + rowH > bottom) {
        truncatedCount +=
          group.categories.length - ci +
          groups
            .slice(gi + 1)
            .reduce((s, g) => s + g.categories.length, 0);
        finishBody(ctx, padX, bottom, truncatedCount);
        return;
      }

      if (ci % 2 === 0) {
        ctx.fillStyle = COLORS.cardBg;
        roundedRect(ctx, padX + 12, y + 4, W - padX * 2 - 12, rowH - 6, 12);
        ctx.fill();
        ctx.strokeStyle = COLORS.cardBorder;
        ctx.lineWidth = 1;
        roundedRect(ctx, padX + 12, y + 4, W - padX * 2 - 12, rowH - 6, 12);
        ctx.stroke();
      }

      ctx.fillStyle = COLORS.text;
      ctx.font = `500 24px ${FONT_STACK}`;
      ctx.textBaseline = "middle";
      ctx.fillText(cat.name, padX + 28, y + rowH / 2);

      ctx.fillStyle = COLORS.brand;
      ctx.font = `700 24px ${FONT_STACK}`;
      const valStr = `${cat.available}`;
      const valW = ctx.measureText(valStr).width;
      ctx.fillText(valStr, W - padX - 16 - valW, y + rowH / 2);

      y += rowH;
    }

    y += groupGap;
  }

  if (!drewSomething) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `500 22px ${FONT_STACK}`;
    ctx.textBaseline = "middle";
    ctx.fillText("Sin disponibilidad por ahora.", padX, top + 40);
  }

  finishBody(ctx, padX, bottom, truncatedCount);
}

function finishBody(
  ctx: CanvasRenderingContext2D,
  padX: number,
  bottom: number,
  truncatedCount: number
) {
  if (truncatedCount > 0) {
    ctx.fillStyle = COLORS.textSubtle;
    ctx.font = `600 18px ${FONT_STACK}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`+${truncatedCount} categorías más`, padX, bottom - 8);
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  total: number
) {
  const padX = 72;
  const includeTotal = opts.includeTotal ?? true;
  const cta = (opts.cta ?? "").trim();

  let y = H - 180;

  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(W - padX, y);
  ctx.stroke();

  y += 50;

  if (includeTotal) {
    const label = "Total disponible";
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `500 20px ${FONT_STACK}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, padX, y);

    ctx.fillStyle = COLORS.text;
    ctx.font = `900 48px ${FONT_STACK}`;
    const totalLabel = `${total}`;
    const tw = ctx.measureText(totalLabel).width;
    ctx.fillText(totalLabel, W - padX - tw, y + 8);
  }

  if (cta) {
    const ctaY = H - 80;
    const ctaH = 56;
    const ctaPadX = 28;
    ctx.font = `700 22px ${FONT_STACK}`;
    const ctaW = Math.min(W - padX * 2, ctx.measureText(cta).width + ctaPadX * 2);
    const ctaX = (W - ctaW) / 2;

    ctx.fillStyle = COLORS.ctaBg;
    roundedRect(ctx, ctaX, ctaY - ctaH / 2, ctaW, ctaH, 999);
    ctx.fill();

    ctx.fillStyle = COLORS.ctaText;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(cta, W / 2, ctaY + 1);
    ctx.textAlign = "start";
  }
}

type PillOpts = {
  bg: string;
  text: string;
  ring?: string;
  font: string;
  padX: number;
  h: number;
  anchor?: "left" | "right";
  center?: boolean;
};

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  opts: PillOpts
) {
  ctx.font = opts.font;
  const textW = ctx.measureText(label).width;
  const w = textW + opts.padX * 2;
  const h = opts.h;
  const rectX = opts.anchor === "right" ? x - w : x;
  const rectY = opts.center ? y - h / 2 : y;

  ctx.fillStyle = opts.bg;
  roundedRect(ctx, rectX, rectY, w, h, 999);
  ctx.fill();

  if (opts.ring) {
    ctx.strokeStyle = opts.ring;
    ctx.lineWidth = 1;
    roundedRect(ctx, rectX, rectY, w, h, 999);
    ctx.stroke();
  }

  ctx.fillStyle = opts.text;
  ctx.textBaseline = "middle";
  ctx.fillText(label, rectX + opts.padX, rectY + h / 2);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
