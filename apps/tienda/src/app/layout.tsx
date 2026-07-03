import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/bottom-nav";
import { Toast } from "@/components/toast";
import { STORE_NAME } from "@/lib/config";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: STORE_NAME,
  description: "Tienda en línea. Todo lo que necesitas, en un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${spaceGrotesk.className} min-h-dvh bg-page text-ink antialiased`}
      >
        <StoreProvider>
          <div className="flex min-h-dvh justify-center">
            <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-app shadow-[0_0_40px_rgba(10,31,63,.18)]">
              {children}
              <BottomNav />
            </div>
          </div>
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
