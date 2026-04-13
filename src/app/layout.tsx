import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MAREYreg - Sistema de Gestion",
  description:
    "Sistema de gestion de conductores, vehiculos, viajes, pacas e inventario",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${manrope.variable} ${inter.variable} min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
