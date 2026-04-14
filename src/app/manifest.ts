import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MAREYway - Sistema de Gestion",
    short_name: "MAREYway",
    description:
      "Sistema de gestion de conductores, vehiculos, viajes, pacas e inventario",
    start_url: "/",
    display: "standalone",
    background_color: "#f4faff",
    theme_color: "#001e40",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
