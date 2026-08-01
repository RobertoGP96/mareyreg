import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { BottomNav } from "@/components/bottom-nav";
import { TopNav } from "@/components/top-nav";
import { SiteFooter } from "@/components/site-footer";
import { Toast } from "@/components/toast";
import { STORE_NAME } from "@/lib/config";

// Geist es variable (100–900) y cubre display y UI con una sola familia: sin
// `weight` next/font sirve el eje completo, así que `font-medium`/`font-bold` y
// los titulares a 600 no cargan ningún archivo extra.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
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
      className={geist.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-ui text-ink antialiased">
        <ThemeProvider>
          <StoreProvider>
            <div className="flex min-h-dvh flex-col">
              <TopNav />
              {/* El hueco para la BottomNav fija lo reserva el footer, que va
                  siempre al final del documento. */}
              <main className="flex-1">{children}</main>
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
