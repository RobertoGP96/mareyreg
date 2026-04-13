import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// SVG template for generating icons at different sizes
function createSvg(size) {
  const rx = Math.round(size * 0.19);
  const strokeWidth = size <= 32 ? 3.5 : 2.5;
  const padding = Math.round(size * 0.2);
  const innerSize = size - padding * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#001e40"/>
  <svg x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" viewBox="0 0 22 20">
    <path d="M1 18V2L11 12L21 2V18" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>
</svg>`;
}

// Generate PNG from SVG at a specific size
async function generatePng(size) {
  const svg = createSvg(size);
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

// Create ICO file from PNG buffers (simplified ICO format)
function createIco(pngBuffers, sizes) {
  // ICO header: 6 bytes
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
      offset: offset,
      data: pngData,
    });
    offset += pngData.length;
  }

  const totalSize = offset;
  const buffer = Buffer.alloc(totalSize);

  // ICO header
  buffer.writeUInt16LE(0, 0); // Reserved
  buffer.writeUInt16LE(1, 2); // Type: ICO
  buffer.writeUInt16LE(numImages, 4); // Number of images

  // Directory entries
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const pos = headerSize + i * dirEntrySize;
    buffer.writeUInt8(e.width, pos); // Width
    buffer.writeUInt8(e.height, pos + 1); // Height
    buffer.writeUInt8(0, pos + 2); // Color palette
    buffer.writeUInt8(0, pos + 3); // Reserved
    buffer.writeUInt16LE(1, pos + 4); // Color planes
    buffer.writeUInt16LE(32, pos + 6); // Bits per pixel
    buffer.writeUInt32LE(e.dataSize, pos + 8); // Data size
    buffer.writeUInt32LE(e.offset, pos + 12); // Data offset
  }

  // Image data
  for (const e of entries) {
    e.data.copy(buffer, e.offset);
  }

  return buffer;
}

async function main() {
  console.log("Generating favicons...");

  // Generate PNGs at different sizes
  const png16 = await generatePng(16);
  const png32 = await generatePng(32);
  const png192 = await generatePng(192);
  const png512 = await generatePng(512);

  // Create favicon.ico (16x16 + 32x32)
  const ico = createIco([png16, png32], [16, 32]);
  writeFileSync(join(projectRoot, "src/app/favicon.ico"), ico);
  console.log("  Created src/app/favicon.ico");

  // Create manifest icons
  writeFileSync(join(projectRoot, "public/icon-192.png"), png192);
  console.log("  Created public/icon-192.png");

  writeFileSync(join(projectRoot, "public/icon-512.png"), png512);
  console.log("  Created public/icon-512.png");

  console.log("Done!");
}

main().catch(console.error);
