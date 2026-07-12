import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingCart, Truck, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Inventory", to: "/inventory", icon: Package },
  { label: "Purchase Orders", to: "/purchase-orders", icon: ShoppingCart },
  { label: "Suppliers", to: "/suppliers", icon: Truck },
  { label: "Settings", to: "/settings", icon: Settings },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-[linear-gradient(180deg,_oklch(0.18_0.03_235),_oklch(0.22_0.04_235))] text-sidebar-foreground shadow-[0_0_48px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-white/8 px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 shadow-lg shadow-black/20 ring-1 ring-white/10">
                <img src="/PIMIS.png" alt="PIMIS logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-none">PIMIS</div>
                <div className="mt-1 text-xs text-sidebar-muted">Pharmacy Inventory Management</div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground lg:hidden"
              aria-label="Close sidebar"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-sidebar-muted">
            Main menu
          </div>
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  !isActive && "hover:bg-white/6",
                )}
              >
                {isActive ? (
                  <span className="absolute inset-0 rounded-2xl bg-sidebar-active shadow-md shadow-black/10" />
                ) : null}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 z-10 w-1 rounded-r-full bg-gold" />
                )}
                <span
                  className={cn(
                    "relative z-10 flex items-center gap-3",
                    isActive
                      ? "text-sidebar-active-foreground"
                      : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 backdrop-blur-sm">
            <div className="text-xs font-medium text-sidebar-foreground">Operational mode</div>
            <div className="mt-0.5 text-[11px] text-sidebar-muted">Live stock supervision</div>
          </div>
        </div>
      </aside>
    </>
  );
}
