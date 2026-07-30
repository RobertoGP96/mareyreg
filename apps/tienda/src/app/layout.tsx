import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { BottomNav } from "@/components/bottom-nav";
import { TopNav } from "@/components/top-nav";
import { Toast } from "@/components/toast";
import { STORE_NAME } from "@/lib/config";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

// Manrope es variable (200–800): sin `weight` next/font sirve el eje completo
// y `font-medium`/`font-bold` no cargan un archivo extra.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
      className={`${instrumentSerif.variable} ${manrope.variable}`}
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
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
              <BottomNav />
            </div>
            <Toast />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
