import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ProfileSettingsProvider } from "@/lib/profile-settings-context";

/**
 * Shared shell for authenticated app areas: persistent sidebar, header, and routed main content.
 */
export function Layout() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDashboard = pathname === "/";
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.8),_transparent_16rem)]" />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <button
        type="button"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        onClick={() => setSidebarOpen((current) => !current)}
        className={cn(
          "fixed top-1/2 z-40 flex h-14 w-6 -translate-y-1/2 items-center justify-center rounded-l-none rounded-r-[0.9rem] border border-border/60 border-l-0 bg-surface text-muted-foreground shadow-lg shadow-black/10 transition-[transform,background-color,color,box-shadow] duration-300 ease-out hover:bg-surface/95 hover:text-foreground hover:shadow-xl will-change-transform",
        )}
        style={{
          transform: `translate3d(${sidebarOpen ? "15.25rem" : "0.25rem"}, -50%, 0)`,
        }}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <ChevronLeft
            className={cn(
              "absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out",
              sidebarOpen ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
          <ChevronRight
            className={cn(
              "absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out",
              sidebarOpen ? "scale-75 opacity-0" : "scale-100 opacity-100",
            )}
          />
        </span>
      </button>
      <main
        className={cn(
          "relative transition-[padding] duration-300 ease-out",
          sidebarOpen ? "lg:pl-64" : "lg:pl-0",
          isDashboard ? "overflow-hidden" : "",
        )}
      >
        <ProfileSettingsProvider>
          <div
            className={cn(
              "mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6",
              isDashboard ? "overflow-hidden" : "",
            )}
          >
            <Header />
            <div
              className={cn("relative flex-1 py-6 lg:py-8", isDashboard ? "overflow-hidden" : "")}
            >
              <Outlet />
            </div>
          </div>
        </ProfileSettingsProvider>
      </main>
    </div>
  );
}
