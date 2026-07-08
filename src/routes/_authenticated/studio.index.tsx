import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays, ClipboardCheck, Map, DollarSign, Heart, Store, Megaphone, Plus, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/")({
  component: StudioDashboard,
});

function useStudioData(orgId: string | undefined) {
  return useSuspenseQuery({
    queryKey: ["studio-dashboard", orgId],
    queryFn: async () => {
      if (!orgId) return { events: [], applications: [], payments: [], booths: [], sponsors: [], vendorLinks: [] };
      const [ev, ap, pa, bo, sp, ov] = await Promise.all([
        supabase.from("events").select("id, name, starts_at, status").eq("organization_id", orgId).order("starts_at", { ascending: true }).limit(5),
        supabase.from("applications").select("id, status").eq("organization_id", orgId),
        supabase.from("payments").select("amount, status").eq("organization_id", orgId),
        supabase.from("event_booths").select("id, status, event_id"),
        supabase.from("sponsors").select("id").eq("organization_id", orgId),
        supabase.from("organization_vendors").select("id").eq("organization_id", orgId),
      ]);
      return {
        events: ev.data ?? [], applications: ap.data ?? [], payments: pa.data ?? [],
        booths: bo.data ?? [], sponsors: sp.data ?? [], vendorLinks: ov.data ?? [],
      };
    },
  });
}

function StudioDashboard() {
  const { user, activeOrg } = useAuth();
  const { data } = useStudioData(activeOrg?.organizationId);

  const upcoming = data.events.filter((e) => ["published", "in_progress", "draft"].includes(e.status)).length;
  const pending = data.applications.filter((a) => a.status === "pending").length;
  const approved = data.applications.filter((a) => a.status === "approved").length;
  const available = data.booths.filter((b) => b.status === "available").length;
  const paid = data.payments.filter((p) => p.status === "paid").length;
  const unpaid = data.payments.filter((p) => p.status !== "paid").length;
  const revenue = data.payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome back${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        title={activeOrg?.organizationName ?? "Your Studio"}
        description="Everything you need to plan the next event — in one calm workspace."
      />

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          <StatCard label="Upcoming Events" value={upcoming} icon={CalendarDays} tone="primary" />
          <StatCard label="Pending Applications" value={pending} icon={ClipboardCheck} tone="warning" />
          <StatCard label="Approved Vendors" value={approved} icon={Store} tone="success" />
          <StatCard label="Booths Available" value={available} icon={Map} tone="default" />
          <StatCard label="Directory" value={data.vendorLinks.length} icon={Users} tone="default" />
          <StatCard label="Sponsors" value={data.sponsors.length} icon={Heart} tone="primary" />
          <StatCard label="Paid Invoices" value={paid} icon={DollarSign} tone="success" />
          <StatCard label="Pending Payments" value={unpaid} icon={DollarSign} tone="warning" />
          <StatCard label="Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} tone="primary" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickActionCard label="Create Event" description="Start a new show" icon={Plus} to="/studio/events" />
          <QuickActionCard label="Add Venue" description="Register a location" icon={MapPin} to="/studio/venues" />
          <QuickActionCard label="Invite Vendor" description="Grow directory" icon={Store} to="/studio/vendors" />
          <QuickActionCard label="Review Apps" description="Approve vendors" icon={ClipboardCheck} to="/studio/applications" />
          <QuickActionCard label="Booth Map" description="Design floor" icon={Map} to="/studio/booths" />
          <QuickActionCard label="Announce" description="Broadcast" icon={Megaphone} to="/studio/messaging" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Recent events</h2>
        {data.events.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No events yet" description="Create your first event to start collecting vendor applications and building your booth map." />
        ) : (
          <ul className="card-soft divide-y divide-border/60">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-foreground">{e.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{e.status.replace("_", " ")} · {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "Date TBD"}</p>
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
