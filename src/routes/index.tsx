import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { loading, session, roles } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;
  if (roles.includes("admin")) return <Navigate to="/admin" />;
  if (roles.includes("cozinha")) return <Navigate to="/pedidos" />;
  if (roles.includes("caixa")) return <Navigate to="/admin" />;
  return <Navigate to="/pedidos" />;
}
