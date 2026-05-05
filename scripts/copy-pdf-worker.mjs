// Copia el worker de pdfjs-dist a /public/pdfjs/ para que el visor de PDF
// pueda cargarlo desde el mismo origen (sin depender de CDNs externos).
// Se corre en postinstall para mantenerlo sincronizado con la versión instalada.

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const root = join(__dirname, "..");
const publicDir = join(root, "public", "pdfjs");
mkdirSync(publicDir, { recursive: true });

const candidates = [
  "pdfjs-dist/build/pdf.worker.min.mjs",
  "pdfjs-dist/build/pdf.worker.mjs",
];

let source = null;
for (const c of candidates) {
  try {
    source = require.resolve(c);
    if (existsSync(source)) break;
  } catch {
    // sigue probando
  }
}

if (!source) {
  console.warn("[copy-pdf-worker] No se pudo localizar el worker de pdfjs-dist.");
  process.exit(0);
}

const dest = join(publicDir, "pdf.worker.min.mjs");
copyFileSync(source, dest);
console.log(`[copy-pdf-worker] ${source} -> ${dest}`);
