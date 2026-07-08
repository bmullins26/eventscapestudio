import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/components/shared/brand";

export const Route = createFileRoute("/_authenticated/app")({
  component: RoleRouter,
});

function RoleRouter() {
  const { loading, primarySurface, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (primarySurface === "admin") navigate({ to: "/admin", replace: true });
    else if (primarySurface === "portal") navigate({ to: "/portal", replace: true });
    else if (primarySurface === "studio") navigate({ to: "/studio", replace: true });
  }, [loading, primarySurface, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Brand size="md" />
        <p className="mt-6 text-sm text-muted-foreground">
          {loading ? "Loading your workspace…" : roles.length === 0 ? "Setting up your account…" : "Redirecting…"}
        </p>
      </div>
    </div>
  );
}
