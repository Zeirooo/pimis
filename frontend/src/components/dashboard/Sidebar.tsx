import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Pill,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

const nav = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Inventory", to: "/inventory", icon: Package },
  { label: "Purchase Orders", to: "/purchase-orders", icon: ShoppingCart },
  { label: "Suppliers", to: "/suppliers", icon: Truck },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

// Hoisted so framer-motion always sees the same object identity across
// renders instead of a fresh literal per nav item per render.
const ACTIVE_PILL_TRANSITION = { duration: 0.28, ease: EASE_OUT };
const NAV_LABEL_TRANSITION = { duration: 0.15, ease: EASE_OUT };
const NAV_HOVER_SHIFT = { x: 3 };
const NAV_HOVER_STATIC = { x: 0 };

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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-black/20">
                <Pill className="h-5 w-5 text-primary-foreground" />
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
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-2xl bg-sidebar-active shadow-md shadow-black/10"
                    transition={ACTIVE_PILL_TRANSITION}
                  />
                ) : null}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 z-10 w-1 rounded-r-full bg-gold" />
                )}
                <motion.span
                  whileHover={isActive ? NAV_HOVER_STATIC : NAV_HOVER_SHIFT}
                  transition={NAV_LABEL_TRANSITION}
                  className={cn(
                    "relative z-10 flex items-center gap-3",
                    isActive
                      ? "text-sidebar-active-foreground"
                      : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </motion.span>
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
