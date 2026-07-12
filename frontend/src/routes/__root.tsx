import {
  createRootRoute,
  Link,
  Navigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, DEV_LOGIN_CREDENTIALS, useAuth } from "@/lib/auth";
import { writeProfileSettings, DEFAULT_PROFILE_SETTINGS } from "@/lib/profile-settings";
import { toast } from "sonner";
import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, retryDelay: 1000 },
    mutations: { retry: 0 },
  },
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PIMIS" },
      {
        name: "description",
        content: "Pharmacy inventory, smart restocking, and analytics for pharmacies.",
      },
      { name: "author", content: "PIMIS" },
      { property: "og:title", content: "PIMIS" },
      {
        property: "og:description",
        content: "Pharmacy inventory, smart restocking, and analytics for pharmacies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@pimis" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </MotionConfig>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { user, isBootstrapping } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (isBootstrapping) {
    return <LoadingScreen title="Preparing PIMIS" description="Loading pharmacy workspace" />;
  }

  if (!user) {
    if (pathname !== "/login") {
      return <Navigate to="/login" search={{ redirect: pathname }} replace />;
    }

    return <LoginScreen />;
  }

  if (pathname === "/login") {
    return <Navigate to="/" replace />;
  }

  return <Layout />;
}

function LoginScreen() {
  const { login, isSigningIn } = useAuth();
  const [username, setUsername] = useState<string>(DEV_LOGIN_CREDENTIALS.username);
  const [password, setPassword] = useState<string>(DEV_LOGIN_CREDENTIALS.password);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await login(username, password);
    if (!result.ok) {
      toast.error("Sign in failed", { description: result.message });
      return;
    }

    writeProfileSettings({
      ...DEFAULT_PROFILE_SETTINGS,
      fullName: "Dr. Andi Wijaya",
      role: "Pharmacy Manager",
      email: "andi.wijaya@pharmacy.go.id",
      phone: "+62 812 3456 7890",
    });

    toast.success("Welcome back", {
      description: "Pharmacy manager workspace is ready.",
    });
  }

  return (
    <div className="login-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <div className="login-bg-orb login-bg-orb--a" />
      <div className="login-bg-orb login-bg-orb--b" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[30rem] items-center justify-center">
        <Card className="login-panel w-full overflow-hidden border border-border/60 bg-surface/96 px-6 py-8 shadow-[0_28px_90px_oklch(0.19_0.018_235/16%)] backdrop-blur-sm sm:px-8 sm:py-10">
          <div className="mx-auto mb-6 flex w-full max-w-[260px] justify-center">
            <div className="flex h-18 w-18 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-semibold tracking-[0.22em] text-primary">
              PIMIS
            </div>
          </div>

          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Pharmacy Inventory Management Information System
            </p>
          </div>

          <form
            className="login-enter mx-auto mt-8 w-full max-w-sm space-y-3.5"
            onSubmit={handleSubmit}
          >
            <Input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="h-12 rounded-2xl border-border/70 bg-muted/40 px-4"
              disabled={isSigningIn}
            />
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="h-12 rounded-2xl border-border/70 bg-muted/40 px-4"
              disabled={isSigningIn}
            />

            <div className="flex justify-center pt-1">
              <Button
                type="submit"
                className="h-11 w-full max-w-52 rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_oklch(0.44_0.12_165/30%)] transition-transform duration-200 hover:bg-primary/90 hover:-translate-y-0.5"
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="buffering-ring h-4 w-4 border-primary-foreground/40 border-t-primary-foreground" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Need help? Contact <span className="font-medium text-primary">it@pimis.go.id</span>
          </div>
        </Card>
      </div>
      {isSigningIn ? (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-background/40 backdrop-blur-[2px]">
          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-surface/95 px-5 py-3 text-sm font-medium text-foreground shadow-lg">
            <span className="buffering-ring h-5 w-5 border-primary/35 border-t-primary" />
            Loading...
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LoadingScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="buffering-ring h-10 w-10 border-primary/30 border-t-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
