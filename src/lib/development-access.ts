// DEVELOPMENT ONLY
// Development Only - Remove before Production
export const ENABLE_DEV_ACCESS = true;

export const DEV_SUPER_ADMIN_EMAILS = ["bmullins26@gmail.com"];

export function isDevelopmentSuperAdminUser(user: { email?: string | null } | null | undefined) {
  if (!user?.email) return false;
  return DEV_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
}
