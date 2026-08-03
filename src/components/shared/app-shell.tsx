import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

interface AppShellProps {
  variant: "studio" | "portal" | "admin";
  title: string;
  sections: NavSection[];
  children: ReactNode;
}

const VARIANT_ACCENT: Record<AppShellProps["variant"], string> = {
  studio: "text-primary-deep",
  portal: "text-sage-deep",
  admin: "text-charcoal",
};

export function AppShell({ variant, title, sections, children }: AppShellProps) {
  const { user, primaryRole, organizations, activeOrg, setActiveOrgId, hasPermission, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.permission || hasPermission(i.permission)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6 lg:flex">
        <Brand size="sm" app={variant} />
        {title && title.toLowerCase() !== (variant === "portal" ? "vendor portal" : variant) && (
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("text-[10px] font-semibold uppercase tracking-[0.24em]", VARIANT_ACCENT[variant])}>
              {title}
            </span>
          </div>
        )}
        {activeOrg && variant === "studio" && (
          <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Organization</p>
            {organizations.length > 1 ? (
              <Select value={activeOrg.organizationId} onValueChange={setActiveOrgId}>
                <SelectTrigger className="mt-1 h-7 w-full border-0 bg-transparent px-0 text-xs font-medium shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.organizationId} value={organization.organizationId}>
                      {organization.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate font-medium text-foreground">{activeOrg.organizationName}</p>
            )}
          </div>
        )}

        <nav className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto">
          {visibleSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
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
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 border-t border-border/60 pt-4">
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
          <Brand size="sm" app={variant} />
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
