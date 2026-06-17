import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
  head: () => ({
    meta: [{ title: "Login | PIMIS — RS Sejahtera" }],
  }),
});

function LoginRoute() {
  // Login UI is rendered by the root auth gate. This route exists to provide a stable URL.
  return null;
}
