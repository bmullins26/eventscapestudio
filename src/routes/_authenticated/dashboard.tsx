import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays, ClipboardCheck, Map, DollarSign, Heart, Users, Megaphone, MessageSquare, Store, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function useDashboardData(userId: string | undefined) {
  return useSuspenseQuery({
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      const [{ data: org }, { data: events }, { data: apps }, { data: pays }, { data: booths }, { data: sponsors }] = await Promise.all([
        supabase.from("organizations").select("id, name").limit(1).maybeSingle(),
        supabase.from("events").select("id, name, starts_at, status").order("starts_at", { ascending: true }).limit(5),
        supabase.from("applications").select("id, status"),
        supabase.from("payments").select("amount, status"),
        supabase.from("event_booths").select("id, status"),
        supabase.from("sponsors").select("id"),
      ]);
      return {
        org, events: events ?? [], applications: apps ?? [],
        payments: pays ?? [], booths: booths ?? [], sponsors: sponsors ?? [],
      };
    },
  });
}

function Dashboard() {
  const { user, primaryRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && primaryRole === "vendor") navigate({ to: "/vendor/dashboard" });
    if (!loading && primaryRole === "super_admin") navigate({ to: "/admin" });
  }, [primaryRole, loading, navigate]);

  const { data } = useDashboardData(user?.id);

  const upcoming = data.events.filter((e) => ["published", "in_progress", "draft"].includes(e.status)).length;
  const pending = data.applications.filter((a) => a.status === "pending").length;
  const approved = data.applications.filter((a) => a.status === "approved").length;
  const waitlist = data.applications.filter((a) => a.status === "waitlisted").length;
  const available = data.booths.filter((b) => b.status === "available").length;
  const paid = data.payments.filter((p) => p.status === "paid").length;
  const unpaid = data.payments.filter((p) => p.status !== "paid").length;
  const revenue = data.payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome back${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        title={data.org?.name ?? "Your Studio"}
        description="Everything you need to plan the next event — in one calm workspace."
      />

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
          <StatCard label="Upcoming Events" value={upcoming} icon={CalendarDays} tone="primary" />
          <StatCard label="Pending Applications" value={pending} icon={ClipboardCheck} tone="warning" />
          <StatCard label="Booths Available" value={available} icon={Map} tone="default" />
          <StatCard label="Approved Vendors" value={approved} icon={Store} tone="success" />
          <StatCard label="Waitlist" value={waitlist} icon={Users} tone="default" />
          <StatCard label="Sponsors" value={data.sponsors.length} icon={Heart} tone="primary" />
          <StatCard label="Paid Invoices" value={paid} icon={DollarSign} tone="success" />
          <StatCard label="Pending Payments" value={unpaid} icon={DollarSign} tone="warning" />
          <StatCard label="Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} tone="primary" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickActionCard label="Create Event" description="Start a new show" icon={Plus} to="/events" />
          <QuickActionCard label="Applications" description="Review vendors" icon={ClipboardCheck} to="/events" />
          <QuickActionCard label="Booth Map" description="Design floor plan" icon={Map} to="/events" />
          <QuickActionCard label="Add Vendor" description="Vendor directory" icon={Store} to="/vendors" />
          <QuickActionCard label="Announcement" description="Broadcast to vendors" icon={Megaphone} to="/events" />
          <QuickActionCard label="Messages" description="Reply to chats" icon={MessageSquare} to="/events" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Recent events</h2>
        {data.events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events yet"
            description="Create your first event to start collecting vendor applications and building your booth map."
          />
        ) : (
          <ul className="card-soft divide-y divide-border/60">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-foreground">{e.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{e.status.replace("_", " ")} · {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "Date TBD"}</p>
                </div>
                <span className="text-xs uppercase tracking-wide text-primary">Open →</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
