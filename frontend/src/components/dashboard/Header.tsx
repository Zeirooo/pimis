import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Building2, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProfileSettings } from "@/lib/profile-settings-context";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Inventory", to: "/inventory" },
  { label: "POs", to: "/purchase-orders" },
  { label: "Suppliers", to: "/suppliers" },
  { label: "Reports", to: "/reports" },
  { label: "Settings", to: "/settings" },
] as const;

type HeaderProps = {};

const notifications = [
  {
    title: "2 draft POs need review",
    description: "Purchase Orders",
    href: "/purchase-orders",
  },
  {
    title: "Low stock alerts updated",
    description: "4 medicines are below safety stock",
    href: "/inventory",
  },
  {
    title: "Notification preferences",
    description: "Open settings to adjust alert delivery",
    href: "/settings",
  },
];

const PAGE_HEADER_CONTENT: Record<string, { title: string; description: string }> = {
  "/inventory": {
    title: "Inventory",
    description: "Track SKUs, safety stock, and replenishment from the live pharmacy database.",
  },
  "/purchase-orders": {
    title: "Purchase Orders",
    description: "Review draft POs, supplier choices, and replenishment flow.",
  },
  "/suppliers": {
    title: "Suppliers",
    description: "Monitor supplier coverage and fulfillment readiness.",
  },
  "/reports": {
    title: "Reports",
    description: "Review stock trends, alerts, and operational summaries.",
  },
  "/settings": {
    title: "Settings",
    description: "Manage alerts, preferences, and profile details.",
  },
};

export function Header(_: HeaderProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { profile } = useProfileSettings();
  const isDashboard = pathname === "/";
  const pageHeader = PAGE_HEADER_CONTENT[pathname] ?? {
    title: "Section",
    description: "",
  };

  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="space-y-4 border-b border-border/70 pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          {isDashboard ? (
            <div className="space-y-1">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live stock, alerts, and purchase-order pressure in one place.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {pageHeader.title}
                </h1>
              </div>
              {pageHeader.description ? (
                <p className="max-w-2xl text-sm text-muted-foreground">{pageHeader.description}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative bg-surface shadow-sm"
                aria-label="Open notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-critical" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span>Notifications</span>
                <span className="text-xs font-normal text-muted-foreground">3 new</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem key={notification.title} asChild className="cursor-pointer">
                  <Link to={notification.href} className="flex flex-col items-start gap-0.5">
                    <span className="font-medium text-foreground">{notification.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {notification.description}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/settings" className="font-medium text-primary">
                  Open notification settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-3 border-l border-border pl-3">
            <Avatar className="h-9 w-9 border border-border shadow-sm">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials || "DA"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight text-foreground">
                {profile.fullName}
              </div>
              <div className="text-xs text-muted-foreground">{profile.role}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(`${item.to}/`);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {isActive ? <Sparkles className="h-3.5 w-3.5" /> : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
