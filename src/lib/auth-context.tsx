import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "organizer" | "staff" | "vendor";
export type AppSurface = "studio" | "portal" | "admin";

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  isOwner: boolean;
  permissions: string[];
}

export interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  organizations: OrgMembership[];
  activeOrg: OrgMembership | null;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  primaryRole: AppRole | null;
  primarySurface: AppSurface | null;
  setActiveOrgId: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = ["super_admin", "organizer", "staff", "vendor"];

function roleToSurface(role: AppRole | null): AppSurface | null {
  if (role === "super_admin") return "admin";
  if (role === "organizer" || role === "staff") return "studio";
  if (role === "vendor") return "portal";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [organizations, setOrganizations] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setOrganizations([]);
      setActiveOrgId(null);
      return;
    }
    const [rolesRes, ownedRes, memberRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("organizations").select("id, name").eq("owner_id", userId),
      supabase.from("organization_members").select("organization_id, organizations(id, name), member_permissions(permission_key)").eq("user_id", userId),
    ]);
    setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));

    const owned: OrgMembership[] = (ownedRes.data ?? []).map((o) => ({
      organizationId: o.id, organizationName: o.name, isOwner: true, permissions: ["*"],
    }));
    const memberships: OrgMembership[] = (memberRes.data ?? []).flatMap((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      if (!org) return [];
      const perms = (m.member_permissions ?? []).map((p) => (p as { permission_key: string }).permission_key);
      return [{ organizationId: org.id, organizationName: org.name, isOwner: false, permissions: perms }];
    });
    const merged = [...owned, ...memberships.filter((m) => !owned.some((o) => o.organizationId === m.organizationId))];
    setOrganizations(merged);
    setActiveOrgId((current) => current && merged.some((o) => o.organizationId === current) ? current : merged[0]?.organizationId ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadContext(data.session?.user.id);
    setLoading(false);
  }, [loadContext]);

  useEffect(() => {
    if (typeof window === "undefined") { setLoading(false); return; }
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSession(s);
        void loadContext(s?.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, loadContext]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null); setRoles([]); setOrganizations([]); setActiveOrgId(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const activeOrg = organizations.find((o) => o.organizationId === activeOrgId) ?? null;
    const hasRole = (role: AppRole) => roles.includes(role);
    const primaryRole = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
    const hasPermission = (permission: string) => {
      if (roles.includes("super_admin")) return true;
      if (!activeOrg) return false;
      if (activeOrg.isOwner) return true;
      return activeOrg.permissions.includes(permission);
    };
    return {
      loading,
      user: session?.user ?? null,
      session,
      roles,
      organizations,
      activeOrg,
      isAuthenticated: !!session,
      hasRole,
      hasAnyRole: (list) => list.some((r) => roles.includes(r)),
      hasPermission,
      primaryRole,
      primarySurface: roleToSurface(primaryRole),
      setActiveOrgId,
      refresh,
      signOut,
    };
  }, [session, roles, organizations, activeOrgId, loading, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
