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
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          navigate({ to: "/auth", replace: true });
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userError) throw userError;

        if (userData.user) {
          navigate({ to: "/app", replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
      } catch (error) {
        console.error("Auth callback failed", error);
        if (!cancelled) {
          navigate({ to: "/auth", replace: true });
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
