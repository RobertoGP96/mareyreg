import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GrayRegistration · Sistema de Gestión",
    short_name: "GrayRegistration",
    description:
      "Plataforma operativa de logística, pacas, inventario y ventas — integrados en un solo sistema.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e40af",
    icons: [
      {
        src: "/manifest-icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/manifest-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
