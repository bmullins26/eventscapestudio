import { supabase } from "@/integrations/supabase/client";

export type SupabaseOAuthProvider = "google" | "apple" | "microsoft";

export async function signInWithSupabaseOAuth(provider: SupabaseOAuthProvider, redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
}
