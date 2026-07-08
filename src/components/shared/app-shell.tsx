import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, CalendarDays, Users, ClipboardCheck, Map, DollarSign,
  Heart, Megaphone, MessageSquare, Settings, ShieldCheck, LogOut, UserCog,
  Store,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: ["organizer", "staff"] },
  { label: "Events", to: "/events", icon: CalendarDays, roles: ["organizer", "staff"] },
  { label: "Vendors", to: "/vendors", icon: Store, roles: ["organizer", "staff"] },
  { label: "Staff", to: "/staff", icon: UserCog, roles: ["organizer"] },
  { label: "Settings", to: "/settings", icon: Settings, roles: ["organizer", "staff"] },
  { label: "My Portal", to: "/vendor/dashboard", icon: LayoutDashboard, roles: ["vendor"] },
  { label: "Browse Events", to: "/vendor/events", icon: CalendarDays, roles: ["vendor"] },
  { label: "My Applications", to: "/vendor/applications", icon: ClipboardCheck, roles: ["vendor"] },
  { label: "Vendor Profile", to: "/vendor/profile", icon: Store, roles: ["vendor"] },
  { label: "Platform", to: "/admin", icon: ShieldCheck, roles: ["super_admin"] },
  { label: "Organizations", to: "/admin/organizations", icon: Users, roles: ["super_admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, primaryRole, hasAnyRole, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => hasAnyRole(n.roles) || (primaryRole && n.roles.includes(primaryRole)));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6 lg:flex">
        <Brand size="sm" />
        <nav className="mt-8 flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-primary-soft text-primary-deep font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border/60 pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {(user?.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs capitalize text-muted-foreground">{primaryRole?.replace("_", " ") ?? "member"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <Brand size="sm" />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
