import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell, type NavSection } from "@/components/shared/app-shell";
import {
  LayoutDashboard, CalendarDays, MapPin, Store, Heart, ClipboardCheck,
  Map, DollarSign, MessageSquare, BarChart3, UserCog, Settings,
} from "lucide-react";

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", to: "/studio", icon: LayoutDashboard },
    ],
  },
  {
    label: "Plan",
    items: [
      { label: "Event Library", to: "/studio/events", icon: CalendarDays, permission: "events.read" },
      { label: "Venues", to: "/studio/venues", icon: MapPin, permission: "venues.manage" },
      { label: "Vendor Directory", to: "/studio/vendors", icon: Store, permission: "vendors.read" },
      { label: "Sponsors", to: "/studio/sponsors", icon: Heart, permission: "sponsors.manage" },
    ],
  },
  {
    label: "Operate",
    items: [
      { label: "Applications", to: "/studio/applications", icon: ClipboardCheck, permission: "applications.review" },
      { label: "Booths", to: "/studio/booths", icon: Map, permission: "booths.manage" },
      { label: "Payments", to: "/studio/payments", icon: DollarSign, permission: "payments.manage" },
      { label: "Messaging", to: "/studio/messaging", icon: MessageSquare, permission: "messages.send" },
      { label: "Reports", to: "/studio/reports", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Staff", to: "/studio/staff", icon: UserCog, permission: "staff.manage" },
      { label: "Settings", to: "/studio/settings", icon: Settings, permission: "settings.manage" },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/studio")({
  component: () => (
    <AppShell variant="studio" title="EventScape Studio" sections={SECTIONS}>
      <Outlet />
    </AppShell>
  ),
});
