import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Sin esto, el file tracing de Next en el monorepo pnpm sobre Windows
  // falla con ENOENT en *.nft.json al recolectar traces.
  outputFileTracingRoot: path.join(appDir, "../../"),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
