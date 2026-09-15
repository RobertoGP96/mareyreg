import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { BottomNav } from "@/components/bottom-nav";
import { TopNav } from "@/components/top-nav";
import { SiteFooter } from "@/components/site-footer";
import { Toast } from "@/components/toast";
import { STORE_NAME } from "@/lib/config";

// Poppins no es variable: se cargan solo los cuatro pesos que usa el sistema
// (cuerpo 400/500, rótulos 600, titulares 700).
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: STORE_NAME,
  description: "Tienda en línea. Todo lo que necesitas, en un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={poppins.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page font-ui text-ink antialiased">
        <ThemeProvider>
          <StoreProvider>
            <div className="flex min-h-dvh flex-col">
              <TopNav />
              {/* El hueco para la BottomNav flotante lo reserva el propio
                  componente con un espaciador al final del documento. */}
              <main className="flex flex-1 flex-col">{children}</main>
              <SiteFooter />
              <BottomNav />
            </div>
            <Toast />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
