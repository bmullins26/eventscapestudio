import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const completeAuth = async () => {
      const { error } = await supabase.auth.getSession();

      if (!cancelled) {
        if (error) {
          navigate({ to: "/auth", replace: true });
          return;
        }

        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          if (data.user) {
            navigate({ to: "/app", replace: true });
          } else {
            navigate({ to: "/auth", replace: true });
          }
        }
      }
    };

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
