import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/pages/Reports";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [{ title: "Reports | PIMIS — RS Sejahtera" }],
  }),
});
