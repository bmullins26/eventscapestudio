import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell, type NavSection } from "@/components/shared/app-shell";
import { ShieldCheck, Building2, CreditCard, BarChart3, LifeBuoy, Settings, ScrollText } from "lucide-react";

const SECTIONS: NavSection[] = [
  { items: [{ label: "Overview", to: "/admin", icon: ShieldCheck }] },
  {
    label: "Platform",
    items: [
      { label: "Organizations", to: "/admin/organizations", icon: Building2 },
      { label: "Subscriptions", to: "/admin/subscriptions", icon: CreditCard },
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Support", to: "/admin/support", icon: LifeBuoy },
      { label: "Global Settings", to: "/admin/settings", icon: Settings },
      { label: "System Logs", to: "/admin/logs", icon: ScrollText },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <AppShell variant="admin" title="Admin Console" sections={SECTIONS}>
      <Outlet />
    </AppShell>
  ),
});
