// DEVELOPMENT ONLY
// Development Only - Remove before Production
export const ENABLE_DEV_ACCESS = true;

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

export function isDevelopmentSuperAdminUser(user: { email?: string | null } | null | undefined) {
  if (!user?.email) return false;
  return DEV_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function ensureDevelopmentSession() {
  if (!isDevelopmentMode()) return null;
  return null;
}
