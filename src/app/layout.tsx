import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAREYreg - Registro de Viajes",
  description:
    "Sistema de registro de conductores, vehiculos, viajes y carga",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="grow w-full sm:w-full md:w-4/5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
            {children}
          </main>
          <MobileNav />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
