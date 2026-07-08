import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell, type NavSection } from "@/components/shared/app-shell";
import {
  Home, CalendarDays, ClipboardCheck, Map, DollarSign,
  MessageSquare, Megaphone, Store, FileText, HelpCircle,
} from "lucide-react";

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Home", to: "/portal", icon: Home },
    ],
  },
  {
    label: "Events",
    items: [
      { label: "My Events", to: "/portal/events", icon: CalendarDays },
      { label: "My Applications", to: "/portal/applications", icon: ClipboardCheck },
      { label: "My Booth", to: "/portal/booth", icon: Map },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Messages", to: "/portal/messages", icon: MessageSquare },
      { label: "Announcements", to: "/portal/announcements", icon: Megaphone },
    ],
  },
  {
    label: "My Business",
    items: [
      { label: "Payments", to: "/portal/payments", icon: DollarSign },
      { label: "Business Profile", to: "/portal/profile", icon: Store },
      { label: "Documents", to: "/portal/documents", icon: FileText },
      { label: "Help", to: "/portal/help", icon: HelpCircle },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/portal")({
  component: () => (
    <AppShell variant="portal" title="Vendor Portal" sections={SECTIONS}>
      <Outlet />
    </AppShell>
  ),
});
