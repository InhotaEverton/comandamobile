import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/garcom/")({
  beforeLoad: () => {
    throw redirect({ to: "/pedidos" });
  },
});
