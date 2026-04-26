import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GR Technology · Soluciones que avanzan contigo",
    short_name: "GR Technology",
    description:
      "Plataforma operativa de logística, pacas, inventario y ventas — integrados en un solo sistema.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e40af",
    icons: [
      {
        src: "/brand/gr-technology-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/gr-technology-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/gr-technology-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
