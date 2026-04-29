import sharp from "sharp";
import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const SOURCE_LOGO = join(projectRoot, "public/brand/gr-technology-logo.png");

function roundedMaskSvg(size, radiusRatio) {
  const r = Math.round(size * radiusRatio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
}

async function generateRoundedPng(size, radiusRatio = 0.22) {
  const resized = await sharp(SOURCE_LOGO)
    .resize(size, size, { fit: "cover" })
    .toBuffer();

  return sharp(resized)
    .composite([
      {
        input: roundedMaskSvg(size, radiusRatio),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

async function generateSquarePng(size) {
  return sharp(SOURCE_LOGO)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
}

function createIco(pngBuffers, sizes) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  let offset = headerSize + dirSize;
  const entries = [];

  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const pngData = pngBuffers[i];
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      dataSize: pngData.length,
      offset,
      data: pngData,
    });
    offset += pngData.length;
  }

  const buffer = Buffer.alloc(offset);

  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(1, 2);
  buffer.writeUInt16LE(numImages, 4);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const pos = headerSize + i * dirEntrySize;
    buffer.writeUInt8(e.width, pos);
    buffer.writeUInt8(e.height, pos + 1);
    buffer.writeUInt8(0, pos + 2);
    buffer.writeUInt8(0, pos + 3);
    buffer.writeUInt16LE(1, pos + 4);
    buffer.writeUInt16LE(32, pos + 6);
    buffer.writeUInt32LE(e.dataSize, pos + 8);
    buffer.writeUInt32LE(e.offset, pos + 12);
  }

  for (const e of entries) {
    e.data.copy(buffer, e.offset);
  }

  return buffer;
}

async function main() {
  console.log("Generando favicons desde", SOURCE_LOGO);

  const rounded16 = await generateRoundedPng(16, 0.22);
  const rounded32 = await generateRoundedPng(32, 0.22);
  const rounded192 = await generateRoundedPng(192, 0.22);
  const rounded512 = await generateRoundedPng(512, 0.22);

  const apple180 = await generateSquarePng(180);

  const square192 = await generateSquarePng(192);
  const square512 = await generateSquarePng(512);

  const ico = createIco([rounded16, rounded32], [16, 32]);
  writeFileSync(join(projectRoot, "src/app/favicon.ico"), ico);
  console.log("  src/app/favicon.ico");

  writeFileSync(join(projectRoot, "src/app/icon.png"), rounded512);
  console.log("  src/app/icon.png (rounded 512)");

  writeFileSync(join(projectRoot, "src/app/apple-icon.png"), apple180);
  console.log("  src/app/apple-icon.png (square 180)");

  writeFileSync(join(projectRoot, "public/icon-192.png"), rounded192);
  writeFileSync(join(projectRoot, "public/icon-512.png"), rounded512);
  writeFileSync(join(projectRoot, "public/icon-maskable-192.png"), square192);
  writeFileSync(join(projectRoot, "public/icon-maskable-512.png"), square512);
  console.log("  public/icon-{192,512}.png + maskable variants");

  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
