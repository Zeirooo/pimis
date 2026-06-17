import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/pages/Suppliers";

export const Route = createFileRoute("/_app/suppliers")({
  component: SuppliersPage,
  head: () => ({
    meta: [{ title: "Suppliers | PIMIS — RS Sejahtera" }],
  }),
});
