import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CalendarDays, ClipboardCheck, Map, DollarSign, Heart, Store, Megaphone, Plus, MapPin, Users, AlertTriangle, Mail, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/")({
  component: StudioDashboard,
});

function StudioDashboard() {
  const { user, activeOrg, activeEventId, setActiveEventId } = useAuth();
  const orgId = activeOrg?.organizationId;

  const { data: events = [] } = useQuery({
    queryKey: ["dash-events", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, starts_at, status").eq("organization_id", orgId!).eq("is_template", false).neq("status", "archived").order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const eventId = activeEventId ?? events[0]?.id ?? null;
  const activeEvent = events.find((e) => e.id === eventId);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-dashboard", orgId, eventId],
    enabled: !!orgId,
    queryFn: async () => {
      const [ap, pa, bo, sp, ov, invites] = await Promise.all([
        eventId
          ? supabase.from("applications").select("id, status, payment_amount, entry_method").eq("event_id", eventId)
          : supabase.from("applications").select("id, status, payment_amount, entry_method").eq("organization_id", orgId!),
        eventId
          ? supabase.from("payments").select("amount, status").eq("event_id", eventId)
          : supabase.from("payments").select("amount, status").eq("organization_id", orgId!),
        eventId
          ? supabase.from("event_booths").select("id, status, assigned_application_id").eq("event_id", eventId)
          : Promise.resolve({ data: [] as { id: string; status: string; assigned_application_id: string | null }[] }),
        supabase.from("sponsors").select("id").eq("organization_id", orgId!),
        supabase.from("organization_vendors").select("id, account_status").eq("organization_id", orgId!),
        supabase.from("vendor_invitations").select("id").eq("organization_id", orgId!).eq("status", "pending"),
      ]);
      return {
        apps: ap.data ?? [],
        payments: pa.data ?? [],
        booths: bo.data ?? [],
        sponsors: sp.data ?? [],
        vendors: ov.data ?? [],
        pendingInvites: invites.data ?? [],
      };
    },
  });

  const pending = (data?.apps ?? []).filter((a) => a.status === "pending").length;
  const approvedNeedsBooth = (data?.apps ?? []).filter((a) => a.status === "approved").length;
  const waitlisted = (data?.apps ?? []).filter((a) => a.status === "waitlisted").length;
  const awaitingPayment = (data?.apps ?? []).filter((a) => a.status === "awaiting_payment").length;
  const checkedIn = (data?.apps ?? []).filter((a) => a.status === "checked_in").length;
  const boothsSold = (data?.booths ?? []).filter((b) => b.status === "assigned" || b.status === "occupied").length;
  const boothsAvailable = (data?.booths ?? []).filter((b) => b.status === "available").length;
  const revenue = (data?.payments ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const unpaid = (data?.payments ?? []).filter((p) => p.status !== "paid").length;
  const vendorsNoAccount = (data?.vendors ?? []).filter((v) => v.account_status === "no_account").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome back${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        title={activeOrg?.organizationName ?? "Your Studio"}
        description="Everything you need to plan the next event — in one calm workspace."
        actions={
          events.length > 0 ? (
            <Select value={eventId ?? undefined} onValueChange={(v) => setActiveEventId(v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose active event" /></SelectTrigger>
              <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : null
        }
      />

      {activeEvent && <p className="text-sm text-muted-foreground">Viewing stats for <strong className="text-foreground">{activeEvent.name}</strong></p>}

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Upcoming Events" value={events.length} icon={CalendarDays} tone="primary" />
          <StatCard label="Booths Sold" value={boothsSold} icon={Map} tone="success" />
          <StatCard label="Booths Available" value={boothsAvailable} icon={Map} tone="default" />
          <StatCard label="Sponsors" value={data?.sponsors.length ?? 0} icon={Heart} tone="primary" />
          <StatCard label="Directory" value={data?.vendors.length ?? 0} icon={Users} tone="default" />
          <StatCard label="Pending Payments" value={unpaid} icon={DollarSign} tone="warning" />
          <StatCard label="Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} tone="primary" />
          <StatCard label="Checked In" value={checkedIn} icon={ClipboardCheck} tone="success" />
        </div>
      </section>

      {/* Organizer Inbox */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">📥 Organizer Inbox</h2>
        <div className="card-soft divide-y divide-border/60">
          <InboxRow icon={ClipboardCheck} label="Applications Pending Review" count={pending} to="/studio/applications" />
          <InboxRow icon={Map} label="Vendors Need Booth Assignments" count={approvedNeedsBooth} to="/studio/applications" />
          <InboxRow icon={DollarSign} label="Payments Awaiting Confirmation" count={awaitingPayment} to="/studio/applications" />
          <InboxRow icon={AlertTriangle} label="Waitlisted Applications" count={waitlisted} to="/studio/applications" />
          <InboxRow icon={Mail} label="Vendors Waiting for Invitation" count={vendorsNoAccount} to="/studio/vendors" />
          <InboxRow icon={Sparkles} label="Pending Invitations Sent" count={data?.pendingInvites.length ?? 0} to="/studio/vendors" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <QuickActionCard label="New Event" description="Start a new show" icon={Plus} to="/studio/events" />
          <QuickActionCard label="Add Venue" description="Register a location" icon={MapPin} to="/studio/venues" />
          <QuickActionCard label="Add Vendor" description="Grow directory" icon={Store} to="/studio/vendors" />
          <QuickActionCard label="Review Apps" description="Approve vendors" icon={ClipboardCheck} to="/studio/applications" />
          <QuickActionCard label="Venues" description="Design floor" icon={Map} to="/studio/venues" />
          <QuickActionCard label="Announce" description="Broadcast" icon={Megaphone} to="/studio/messaging" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Recent events</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
         events.length === 0 ? <EmptyState icon={CalendarDays} title="No events yet" description="Create your first event to start collecting vendor applications and building your booth map." /> : (
          <ul className="card-soft divide-y divide-border/60">
            {events.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-foreground">{e.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{e.status.replace("_", " ")} · {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "Date TBD"}</p>
                </div>
                <button onClick={() => setActiveEventId(e.id)} className="text-xs uppercase tracking-wide text-primary">Set active →</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InboxRow({ icon: Icon, label, count, to }: { icon: typeof CalendarDays; label: string; count: number; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between px-5 py-3 transition hover:bg-secondary/30">
      <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground" /> <span className="text-sm">{label}</span></span>
      <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${count > 0 ? "bg-primary-soft text-primary-deep" : "bg-muted text-muted-foreground"}`}>{count}</span>
    </Link>
  );
}
