import {
  createRootRoute,
  Link,
  Navigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      { title: "PIMIS | RS Sejahtera" },
      {
        name: "description",
        content: "Pharmacy inventory, smart restocking, and analytics for RS Sejahtera.",
      },
      { name: "author", content: "RS Sejahtera" },
      { property: "og:title", content: "PIMIS | RS Sejahtera" },
      {
        property: "og:description",
        content: "Pharmacy inventory, smart restocking, and analytics for RS Sejahtera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@RSSejahtera" },
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
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { user, isBootstrapping } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({
    select: (state) => (state.location.search as { redirect?: string } | undefined) ?? {},
  });
  const redirectPath = search.redirect;

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
    return <Navigate to={redirectPath ?? "/"} replace />;
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
      role: "Manager Instalasi",
      email: "andi.wijaya@rs-sejahtera.go.id",
      phone: "+62 812 3456 7890",
    });

    toast.success("Welcome back", {
      description: "Manager workspace is ready.",
    });
  }

  return (
    <div className="login-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <div className="login-bg-orb login-bg-orb--a" />
      <div className="login-bg-orb login-bg-orb--b" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <Card className="login-panel grid w-full overflow-hidden border border-border/60 bg-surface/95 shadow-[0_28px_90px_oklch(0.19_0.018_235/16%)] backdrop-blur-sm lg:grid-cols-[1fr_1.35fr]">
          <section className="login-enter border-b border-border/70 p-8 sm:p-12 lg:border-b-0 lg:border-r">
            <div className="mb-12 flex items-center justify-between">
              <div className="text-xl font-semibold tracking-tight text-foreground">
                PIMIS <span className="text-primary">RS Sejahtera</span>
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                ID
              </span>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">Welcome</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Sign in with your manager account to access inventory control and purchase order
                review.
              </p>
            </div>

            <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
              <Input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                className="h-11 rounded-xl border-border/70 bg-muted/40"
                disabled={isSigningIn}
              />
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-11 rounded-xl border-border/70 bg-muted/40"
                disabled={isSigningIn}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-[0_10px_30px_oklch(0.44_0.12_165/30%)] hover:bg-primary/90"
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

            <div className="mt-10 space-y-1 text-center text-xs text-muted-foreground lg:text-left">
              <p>
                Account management is handled by administrators. Registration is disabled in this
                demo.
              </p>
              <p>
                Need help? Contact{" "}
                <span className="font-medium text-primary">it@rs-sejahtera.go.id</span>
              </p>
            </div>
          </section>

          <section
            className="relative hidden min-h-[540px] overflow-hidden bg-[linear-gradient(180deg,oklch(0.95_0.03_170),oklch(0.9_0.03_190))] lg:block"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(236, 253, 245, 0.28), rgba(236, 253, 245, 0.12)), url('/7c57e1fcccd1_RS%20JIH%20Yogyakarta%20Gedung.jpg.avif')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(0.58_0.13_165/18%),transparent_40%),radial-gradient(circle_at_20%_80%,oklch(0.62_0.09_80/18%),transparent_44%)]" />
            <div className="absolute inset-0 bg-white/22 backdrop-blur-[1px]" />
            <div className="relative flex h-full items-center justify-center p-10">
              <div className="login-card-glass w-full max-w-md rounded-3xl border border-white/45 bg-white/42 p-8 text-foreground shadow-[0_22px_56px_rgba(15,23,42,0.2)] backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="buffering-ring h-5 w-5 border-foreground/25 border-t-foreground" />
                  Real-time operations
                </div>
                <h2 className="text-3xl font-semibold leading-tight text-foreground">
                  Manager dashboard for medicine stock and restocking decisions.
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">
                  Monitor inventory health, approve AI draft purchase orders, and keep pharmacy
                  supplies aligned with demand.
                </p>
              </div>
            </div>
          </section>
        </Card>
      </div>
      {isSigningIn ? (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-background/40 backdrop-blur-[2px]">
          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-surface/95 px-5 py-3 text-sm font-medium text-foreground shadow-lg">
            <span className="buffering-ring h-5 w-5 border-primary/35 border-t-primary" />
            Loading manager workspace
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
