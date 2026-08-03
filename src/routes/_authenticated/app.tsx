import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/components/shared/brand";

export const Route = createFileRoute("/_authenticated/app")({
  component: RoleRouter,
});

function RoleRouter() {
  const { loading, primarySurface, roles, refresh, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (primarySurface === "admin") navigate({ to: "/admin", replace: true });
    else if (primarySurface === "portal") navigate({ to: "/portal", replace: true });
    else if (primarySurface === "studio") navigate({ to: "/studio", replace: true });
  }, [loading, primarySurface, navigate]);

  // If authenticated but roles haven't landed yet (race after SIGNED_IN), retry a couple of times.
  useEffect(() => {
    if (loading || !isAuthenticated || roles.length > 0) return;
    const t = setTimeout(() => { void refresh(); }, 600);
    return () => clearTimeout(t);
  }, [loading, isAuthenticated, roles.length, refresh]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Brand size="md" />
        <p className="mt-6 text-sm text-muted-foreground">
          {loading ? "Loading your workspace…" : roles.length === 0 ? "Setting up your account…" : "Redirecting…"}
        </p>
        {!loading && roles.length === 0 && isAuthenticated && (
          <p className="mt-2 text-xs text-muted-foreground">If this takes too long, refresh the page and sign in again.</p>
        )}
      </div>
    </div>
  );
}
