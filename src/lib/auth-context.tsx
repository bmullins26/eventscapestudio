import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEVELOPMENT_IDENTITY_EMAIL, ENABLE_DEV_ACCESS, ensureDevelopmentSession, isDevelopmentMode, isDevelopmentSuperAdminUser } from "@/lib/development-access";

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
  contextError: string | null;
  bootstrapMessage: string | null;
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  organizations: OrgMembership[];
  activeOrg: OrgMembership | null;
  activeEventId: string | null;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  primaryRole: AppRole | null;
  primarySurface: AppSurface | null;
  setActiveOrgId: (id: string) => void;
  setActiveEventId: (id: string | null) => Promise<void>;
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
  const [activeEventId, setActiveEventIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  // DEVELOPMENT ONLY
  // Auth startup can emit multiple session refreshes; share one seed request per user.
  const developmentBootstrapRef = useRef<{ userId: string; promise: Promise<unknown> } | null>(null);

  const loadContext = useCallback(async (userId: string | undefined) => {
    if (!userId && !isDevelopmentMode()) {
      setRoles([]);
      setOrganizations([]);
      setActiveOrgId(null);
      setContextError(null);
      return;
    }

    try {
      if (isDevelopmentMode()) {
        setRoles(["super_admin", "organizer"]);
        setOrganizations([
          {
            organizationId: "development-workspace",
            organizationName: "Developer Studio",
            isOwner: true,
            permissions: ["*"],
          },
        ]);
        setActiveOrgId((current) => current && current === "development-workspace" ? current : "development-workspace");
        setContextError(null);
        return;
      }

      const [rolesRes, ownedRes, memberRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("organizations").select("id, name").eq("owner_id", userId),
        supabase.from("organization_members").select("organization_id, organizations(id, name), member_permissions(permission_key)").eq("user_id", userId),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (ownedRes.error) throw ownedRes.error;
      if (memberRes.error) throw memberRes.error;

      const nextRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      setRoles(nextRoles.length > 0 ? nextRoles : ["organizer"]);

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
      setContextError(null);
    } catch (error) {
      console.error("Failed to load auth context", error);
      setRoles([]);
      setOrganizations([]);
      setActiveOrgId(null);
      setContextError(error instanceof Error ? error.message : "Unable to load your Studio access.");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (isDevelopmentMode()) {
        const fallbackSession = {
          access_token: "development-token",
          user: {
            id: "development-user",
            email: DEVELOPMENT_IDENTITY_EMAIL,
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
            role: "authenticated",
          },
        } as Session;

        setSession(fallbackSession);
        await loadContext(fallbackSession.user.id);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      await loadContext(data.session?.user.id);
    } catch (error) {
      console.error("Failed to refresh auth state", error);
      setSession(null);
      setRoles([]);
      setOrganizations([]);
      setActiveOrgId(null);
      setContextError(error instanceof Error ? error.message : "Unable to refresh your Studio access.");
    } finally {
      setLoading(false);
    }
  }, [loadContext]);

  // Load persisted active event when active org changes
  useEffect(() => {
    if (isDevelopmentMode() || !session?.user?.id || !activeOrgId) { setActiveEventIdState(null); return; }
    void supabase
      .from("user_org_prefs")
      .select("active_event_id")
      .eq("user_id", session.user.id)
      .eq("organization_id", activeOrgId)
      .maybeSingle()
      .then(({ data }) => setActiveEventIdState(data?.active_event_id ?? null));
  }, [session?.user?.id, activeOrgId]);

  const setActiveEventId = useCallback(async (id: string | null) => {
    setActiveEventIdState(id);
    if (isDevelopmentMode() || !session?.user?.id || !activeOrgId) return;
    await supabase.from("user_org_prefs").upsert({
      user_id: session.user.id,
      organization_id: activeOrgId,
      active_event_id: id,
    }, { onConflict: "user_id,organization_id" });
  }, [session?.user?.id, activeOrgId]);

  useEffect(() => {
    if (typeof window === "undefined") { setLoading(false); return; }
    void refresh();

    if (isDevelopmentMode()) {
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSession(s);
        void loadContext(s?.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, loadContext]);

  const signOut = useCallback(async () => {
    if (!isDevelopmentMode()) {
      await supabase.auth.signOut();
    }
    setSession(null); setRoles([]); setOrganizations([]); setActiveOrgId(null); setActiveEventIdState(null); setContextError(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const activeOrg = organizations.find((o) => o.organizationId === activeOrgId) ?? null;
    const hasDevelopmentAccess = ENABLE_DEV_ACCESS && !!session;
    const isExplicitDeveloperSuperAdmin = hasDevelopmentAccess && isDevelopmentSuperAdminUser(session?.user ?? null);
    const bootstrapMessage = hasDevelopmentAccess ? null : contextError ? "We couldn't load your Studio access." : null;
    const effectiveContextError = hasDevelopmentAccess ? null : contextError;
    const effectiveRoles = hasDevelopmentAccess
      ? Array.from(new Set([
          ...(roles.includes("super_admin") || isExplicitDeveloperSuperAdmin ? ["super_admin" as AppRole] : []),
          ...(roles.includes("organizer") || isExplicitDeveloperSuperAdmin ? ["organizer" as AppRole] : []),
        ]))
      : roles;
    const hasRole = (role: AppRole) => hasDevelopmentAccess || effectiveRoles.includes(role);
    const primaryRole = hasDevelopmentAccess ? "super_admin" : ROLE_PRIORITY.find((r) => effectiveRoles.includes(r)) ?? null;
    const hasPermission = (permission: string) => {
      if (hasDevelopmentAccess) return true;
      if (effectiveRoles.includes("super_admin")) return true;
      if (!activeOrg) return false;
      if (activeOrg.isOwner) return true;
      return activeOrg.permissions.includes(permission);
    };
    return {
      loading,
      contextError: effectiveContextError,
      bootstrapMessage,
      user: session?.user ?? null,
      session,
      roles: effectiveRoles,
      organizations,
      activeOrg,
      activeEventId,
      isAuthenticated: !!session,
      hasRole,
      hasAnyRole: (list) => hasDevelopmentAccess || list.some((r) => effectiveRoles.includes(r)),
      hasPermission,
      primaryRole,
      primarySurface: hasDevelopmentAccess ? "studio" : roleToSurface(primaryRole),
      refresh,
      signOut,
    };
  }, [session, roles, organizations, activeOrgId, activeEventId, loading, contextError, refresh, signOut, setActiveEventId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
