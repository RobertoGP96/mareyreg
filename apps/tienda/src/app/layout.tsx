import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tienda Mareyway",
  description: "Tienda en línea de Mareyway",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
