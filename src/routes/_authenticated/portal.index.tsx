import { createFileRoute } from "@tanstack/react-router";
import { Home, CalendarDays, ClipboardCheck, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/portal/")({
  component: PortalHome,
});

function PortalHome() {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Hi${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        title="Welcome to your portal"
        description="Everything you need for the events you're part of — in one calm place."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Upcoming Events" value={0} icon={CalendarDays} tone="primary" />
        <StatCard label="Applications" value={0} icon={ClipboardCheck} tone="default" />
        <StatCard label="Unread Messages" value={0} icon={MessageSquare} tone="warning" />
        <StatCard label="Announcements" value={0} icon={Home} tone="default" />
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickActionCard label="Browse Events" description="Find upcoming shows" icon={CalendarDays} to="/portal/events" />
          <QuickActionCard label="My Applications" description="Track your status" icon={ClipboardCheck} to="/portal/applications" />
          <QuickActionCard label="Messages" description="Chat with organizers" icon={MessageSquare} to="/portal/messages" />
          <QuickActionCard label="My Booth" description="See your placement" icon={Home} to="/portal/booth" />
        </div>
      </section>

      <EmptyState icon={CalendarDays} title="Nothing here yet" description="Once you're invited to an event and approved, you'll see it here." />
    </div>
  );
}
