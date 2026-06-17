import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppOutlet,
});

function AppOutlet() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!user) {
    return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  }

  return <Outlet />;
}
