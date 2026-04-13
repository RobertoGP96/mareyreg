import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AuthSessionProvider } from "@/components/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Topbar />
          <main className="flex-1 p-3 md:p-4">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthSessionProvider>
  );
}
