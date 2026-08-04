// DEVELOPMENT ONLY
// Development Only - Remove before Production
import { supabase } from "@/integrations/supabase/client";

export const DEV_ACCESS_SIGNED_OUT_KEY = "eventscape.devAccess.signedOut";

function isEnabled(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const VITE_ENABLE_DEV_ACCESS = isEnabled(
  (import.meta.env.VITE_ENABLE_DEV_ACCESS ?? process.env.VITE_ENABLE_DEV_ACCESS ?? "").toString(),
);

export const ENABLE_DEV_ACCESS = VITE_ENABLE_DEV_ACCESS;

const rawAppMode = (import.meta.env.VITE_APP_MODE ?? import.meta.env.MODE ?? process.env.APP_MODE ?? "production").toString();
export const APP_MODE = rawAppMode.toLowerCase();
export const DEV_SUPER_ADMIN_EMAILS = ["bmullins26@gmail.com", "dev@eventscape.local"];
export const DEVELOPMENT_IDENTITY_EMAIL = import.meta.env.VITE_DEV_AUTH_EMAIL ?? "dev@eventscape.local";
export const DEVELOPMENT_IDENTITY_PASSWORD = import.meta.env.VITE_DEV_AUTH_PASSWORD ?? "DevAccess123!";

function isLocalDevelopmentHost(hostname: string | undefined) {
  if (!hostname) return false;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
}

export function isDevelopmentMode() {
  if (typeof window !== "undefined") {
    if (isLocalDevelopmentHost(window.location.hostname)) return true;
  }

  return APP_MODE === "development" || APP_MODE === "dev" || import.meta.env.DEV;
}

export function isDevelopmentAccessEnabled() {
  if (typeof window !== "undefined") {
    const wasExplicitlySignedOut = window.localStorage.getItem(DEV_ACCESS_SIGNED_OUT_KEY) === "1";
    if (wasExplicitlySignedOut) return false;
  }

  if (typeof window !== "undefined" && isLocalDevelopmentHost(window.location.hostname)) {
    return true;
  }

  if (ENABLE_DEV_ACCESS) {
    return true;
  }

  return APP_MODE === "development" || APP_MODE === "dev" || import.meta.env.DEV;
}

export function isDevelopmentSuperAdminUser(user: { email?: string | null } | null | undefined) {
  if (!user?.email) return false;
  return DEV_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function ensureDevelopmentSession() {
  if (!isDevelopmentAccessEnabled()) return null;

  const { data: currentSession } = await supabase.auth.getSession();
  if (currentSession.session?.access_token) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEV_ACCESS_SIGNED_OUT_KEY);
    }
    return currentSession.session;
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email: DEVELOPMENT_IDENTITY_EMAIL,
    password: DEVELOPMENT_IDENTITY_PASSWORD,
  });
  if (signInResult.data.session?.access_token) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEV_ACCESS_SIGNED_OUT_KEY);
    }
    return signInResult.data.session;
  }

  const signUpResult = await supabase.auth.signUp({
    email: DEVELOPMENT_IDENTITY_EMAIL,
    password: DEVELOPMENT_IDENTITY_PASSWORD,
    options: {
      data: {
        full_name: "Development Workspace",
        is_development_identity: true,
      },
    },
  });
  if (signUpResult.data.session?.access_token) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEV_ACCESS_SIGNED_OUT_KEY);
    }
    return signUpResult.data.session;
  }

  await new Promise((resolve) => setTimeout(resolve, 2200));
  const retryResult = await supabase.auth.signInWithPassword({
    email: DEVELOPMENT_IDENTITY_EMAIL,
    password: DEVELOPMENT_IDENTITY_PASSWORD,
  });
  if (retryResult.data.session?.access_token) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEV_ACCESS_SIGNED_OUT_KEY);
    }
    return retryResult.data.session;
  }

  throw new Error("Unable to bootstrap development session");
}
