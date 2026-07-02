import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AuthSessionProvider } from "@/components/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-background">
          <Topbar />
          <main className="flex-1 p-4 pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+1rem)] md:p-6 md:pb-6 lg:p-8 lg:pb-8">
            {children}
          </main>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </AuthSessionProvider>
  );
}
