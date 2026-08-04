import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Search, MoreHorizontal, Check, X, Clock, Printer, Copy, Archive, Send, DollarSign, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { scanApplicationImage } from "@/lib/studio.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/studio/applications")({
  head: () => ({ meta: [{ title: "Applications · EventScape Studio" }] }),
  component: ApplicationsPage,
});

type App = {
  id: string;
  event_id: string;
  organization_id: string;
  status: string;
  entry_method: string;
  business_name: string | null;
  contact_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  products_sold: string | null;
  size_requested: string | null;
  requested_location: string | null;
  needs_electricity: boolean;
  special_requests: string | null;
  payment_amount: number | null;
  notes: string | null;
  internal_notes: string | null;
  assigned_booth_id: string | null;
  vendor_profile_id: string;
  applied_at: string;
  ai_extraction: unknown;
};

type FormState = {
  business_name: string; contact_name: string; email: string; phone: string;
  products_sold: string; size_requested: string; needs_electricity: boolean;
  special_requests: string; payment_amount: string; notes: string;
  entry_method: "manual" | "ai_scan"; ai_extraction: unknown;
};

const emptyForm = (): FormState => ({
  business_name: "", contact_name: "", email: "", phone: "",
  products_sold: "", size_requested: "", needs_electricity: false,
  special_requests: "", payment_amount: "", notes: "",
  entry_method: "manual", ai_extraction: null,
});

function ApplicationsPage() {
  const { activeOrg, activeEventId, setActiveEventId } = useAuth();
  const qc = useQueryClient();
  const orgId = activeOrg?.organizationId;
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entryFilter, setEntryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<FormState | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scan = useServerFn(scanApplicationImage);

  const { data: events = [] } = useQuery({
    queryKey: ["events-for-apps", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, applications_open, is_public, slug").eq("organization_id", orgId!).eq("is_template", false).neq("status", "archived").order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const resolvedEventId = activeEventId && events.some((e) => e.id === activeEventId)
    ? activeEventId
    : (events[0]?.id ?? null);
  const eventId = resolvedEventId;
  const activeEvent = events.find((e) => e.id === eventId) ?? null;

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<App[]> => {
      const { data, error } = await supabase.from("applications").select("*").eq("event_id", eventId!).order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as App[];
    },
  });

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (entryFilter !== "all" && a.entry_method !== entryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return [a.business_name, a.contact_name, a.applicant_email, a.products_sold].filter(Boolean).some((f) => f!.toLowerCase().includes(s));
      }
      return true;
    });
  }, [apps, statusFilter, entryFilter, search]);

  const togglePublic = async () => {
    if (!activeEvent) return;
    const next = !activeEvent.applications_open;
    const { error } = await supabase.from("events").update({ applications_open: next, is_public: next || activeEvent.is_public }).eq("id", activeEvent.id);
    if (error) toast.error(error.message);
    else { toast.success(next ? "Public applications enabled" : "Public applications closed"); qc.invalidateQueries({ queryKey: ["events-for-apps", orgId] }); }
  };

  const copyPublicLink = async () => {
    if (!activeEvent) return;
    const link = `${window.location.origin}/apply/${activeEvent.slug}`;
    await navigator.clipboard.writeText(link);
    toast.success("Public link copied");
  };

  const saveNew = async () => {
    if (!creating || !orgId || !eventId) return;
    if (!creating.business_name.trim()) { toast.error("Business name required"); return; }
    // Find or create vendor_profile
    const { data: vp, error: vpErr } = await supabase.from("vendor_profiles").insert({
      business_name: creating.business_name.trim(),
      contact_name: creating.contact_name || null,
      email: creating.email || null,
      phone: creating.phone || null,
    }).select("id").single();
    if (vpErr) { toast.error(vpErr.message); return; }

    // Ensure org_vendor link
    await supabase.from("organization_vendors").insert({ organization_id: orgId, vendor_profile_id: vp.id, account_status: "no_account" });

    const { error } = await supabase.from("applications").insert({
      organization_id: orgId,
      event_id: eventId,
      vendor_profile_id: vp.id,
      status: "pending",
      entry_method: creating.entry_method,
      business_name: creating.business_name.trim(),
      contact_name: creating.contact_name || null,
      applicant_email: creating.email || null,
      applicant_phone: creating.phone || null,
      products_sold: creating.products_sold || null,
      size_requested: creating.size_requested || null,
      needs_electricity: creating.needs_electricity,
      special_requests: creating.special_requests || null,
      payment_amount: creating.payment_amount ? Number(creating.payment_amount) : null,
      notes: creating.notes || null,
      ai_extraction: (creating.ai_extraction ?? null) as never,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Application saved");
    setCreating(null);
    qc.invalidateQueries({ queryKey: ["applications", eventId] });
  };

  const startAiScan = async (file: File) => {
    if (!orgId) return;
    setScanning(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      // Upload original for record
      const key = `${orgId}/apps/${crypto.randomUUID()}-${file.name}`;
      await supabase.storage.from("application-uploads").upload(key, file);

      const extraction = await scan({ data: { fileDataUrl: dataUrl } });
      setCreating({
        business_name: extraction.business_name ?? "",
        contact_name: extraction.contact_name ?? "",
        email: extraction.email ?? "",
        phone: extraction.phone ?? "",
        products_sold: extraction.products_sold ?? "",
        size_requested: extraction.size_requested ?? "",
        needs_electricity: extraction.needs_electricity ?? false,
        special_requests: extraction.special_requests ?? "",
        payment_amount: extraction.payment_amount != null ? String(extraction.payment_amount) : "",
        notes: extraction.notes ?? "",
        entry_method: "ai_scan",
        ai_extraction: extraction,
      });
      toast.success("Review the extracted information and save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Applications"
        description="The center of your event workflow. Every entry method — manual, AI scan, public form, vendor portal — flows through the same review."
        actions={
          <div className="flex items-center gap-2">
            {events.length > 1 && (
              <Select value={eventId} onValueChange={(v) => setActiveEventId(v)}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Choose event" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!activeEvent}>
                  <Plus className="mr-2 h-4 w-4" /> Add application
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreating(emptyForm())}><UserPlus className="mr-2 h-4 w-4" /> Manual entry</DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileRef.current?.click()}><Sparkles className="mr-2 h-4 w-4" /> Scan with AI</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && startAiScan(e.target.files[0])} />
          </div>
        }
      />

      {activeEvent && (
        <div className="card-soft flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">Public applications</span>
            <Switch checked={activeEvent.applications_open} onCheckedChange={togglePublic} />
          </div>
          {activeEvent.applications_open && <Button size="sm" variant="outline" onClick={copyPublicLink}><Copy className="mr-2 h-3 w-3" /> Copy public link</Button>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applications…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="awaiting_payment">Awaiting payment</SelectItem>
            <SelectItem value="booth_assigned">Booth assigned</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entryFilter} onValueChange={setEntryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entry methods</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="ai_scan">AI Scan</SelectItem>
            <SelectItem value="public_form">Public form</SelectItem>
            <SelectItem value="vendor_portal">Vendor portal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!eventId ? (
        <EmptyState icon={ClipboardCheck} title="No active event" description="Create an event first, or switch to one from the Event Library." />
      ) : isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={apps.length === 0 ? "No applications yet" : "No matches"}
          description={apps.length === 0 ? "Add applications manually, scan paper ones with AI, or enable public applications for this event." : "Adjust filters or clear search."}
        />
      ) : (
        <div className="card-soft divide-y divide-border/60">
          {filtered.map((a) => (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-secondary/30">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep"><ClipboardCheck className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate font-medium">{a.business_name ?? "Unnamed applicant"}</p>
                  <StatusBadge status={a.status} />
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{a.entry_method.replace("_", " ")}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[a.contact_name, a.applicant_email, a.size_requested].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {a.payment_amount && <span className="text-sm font-medium">${Number(a.payment_amount).toFixed(2)}</span>}
            </button>
          ))}
        </div>
      )}

      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card-soft flex items-center gap-3 px-6 py-4"><Sparkles className="h-5 w-5 animate-pulse" /> Reading application…</div>
        </div>
      )}

      <NewApplicationDialog state={creating} setState={setCreating} onSave={saveNew} />
      <ApplicationWorkspace appId={openId} onClose={() => setOpenId(null)} events={events} />
    </div>
  );
}

function NewApplicationDialog({ state, setState, onSave }: { state: FormState | null; setState: (s: FormState | null) => void; onSave: () => void }) {
  if (!state) return <Dialog open={false} onOpenChange={() => {}}><DialogContent /></Dialog>;
  const set = (k: keyof FormState, v: unknown) => setState({ ...state, [k]: v });
  return (
    <Dialog open onOpenChange={(o) => !o && setState(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{state.entry_method === "ai_scan" ? "Review AI extraction" : "New application"}</DialogTitle>
          <DialogDescription>{state.entry_method === "ai_scan" ? "Confirm the AI's extraction before saving. Edit anything that looks off." : "Enter application details manually — perfect for paper apps, phone calls, walk-ins."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
          <FieldRow label="Business name *"><Input value={state.business_name} onChange={(e) => set("business_name", e.target.value)} /></FieldRow>
          <FieldRow label="Contact name"><Input value={state.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></FieldRow>
          <FieldRow label="Email"><Input type="email" value={state.email} onChange={(e) => set("email", e.target.value)} /></FieldRow>
          <FieldRow label="Phone"><Input value={state.phone} onChange={(e) => set("phone", e.target.value)} /></FieldRow>
          <FieldRow label="Products sold" className="sm:col-span-2"><Textarea rows={2} value={state.products_sold} onChange={(e) => set("products_sold", e.target.value)} /></FieldRow>
          <FieldRow label="Requested booth size"><Input placeholder="10x10" value={state.size_requested} onChange={(e) => set("size_requested", e.target.value)} /></FieldRow>
          <FieldRow label="Payment amount"><Input type="number" value={state.payment_amount} onChange={(e) => set("payment_amount", e.target.value)} /></FieldRow>
          <FieldRow label="Special requests" className="sm:col-span-2"><Textarea rows={2} value={state.special_requests} onChange={(e) => set("special_requests", e.target.value)} /></FieldRow>
          <FieldRow label="Notes" className="sm:col-span-2"><Textarea rows={2} value={state.notes} onChange={(e) => set("notes", e.target.value)} /></FieldRow>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={state.needs_electricity} onCheckedChange={(v) => set("needs_electricity", !!v)} /> Needs electricity</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setState(null)}>Cancel</Button>
          <Button onClick={onSave}>Save application</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function ApplicationWorkspace({ appId, onClose, events }: { appId: string | null; onClose: () => void; events: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const { data: app } = useQuery({
    queryKey: ["application", appId],
    enabled: !!appId,
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*, vendor_profiles(business_name, contact_name, email, phone)").eq("id", appId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["event-booths", app?.event_id],
    enabled: !!app?.event_id,
    queryFn: async () => {
      const { data } = await supabase.from("event_booths").select("id, code, size_label, status, price, assigned_application_id").eq("event_id", app!.event_id).order("code");
      return data ?? [];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["app-activity", appId],
    enabled: !!appId,
    queryFn: async () => {
      const { data } = await supabase.from("application_activity").select("*").eq("application_id", appId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["vendor-history", app?.vendor_profile_id],
    enabled: !!app?.vendor_profile_id,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("id, event_id, status, applied_at, payment_amount, events(name)").eq("vendor_profile_id", app!.vendor_profile_id).order("applied_at", { ascending: false });
      return (data ?? []).filter((r) => r.id !== appId);
    },
  });

  if (!appId) return <Sheet open={false} onOpenChange={() => {}}><SheetContent /></Sheet>;

  type AppStatus = "approved" | "archived" | "awaiting_payment" | "booth_assigned" | "checked_in" | "completed" | "draft" | "pending" | "rejected" | "waitlisted" | "withdrawn";
  const setStatus = async (status: AppStatus) => {
    if (!app) return;
    const { error } = await supabase.from("applications").update({ status, decided_at: new Date().toISOString() }).eq("id", app.id);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${status.replace("_", " ")}`); qc.invalidateQueries({ queryKey: ["application", appId] }); qc.invalidateQueries({ queryKey: ["applications", app.event_id] }); qc.invalidateQueries({ queryKey: ["app-activity", appId] }); }
  };

  const assignBooth = async (boothId: string) => {
    if (!app) return;
    // Free previous booth
    if (app.assigned_booth_id) {
      await supabase.from("event_booths").update({ status: "available", assigned_application_id: null }).eq("id", app.assigned_booth_id);
    }
    const { error: bErr } = await supabase.from("event_booths").update({ status: "assigned", assigned_application_id: app.id }).eq("id", boothId);
    if (bErr) { toast.error(bErr.message); return; }
    const { error } = await supabase.from("applications").update({ assigned_booth_id: boothId, status: app.status === "approved" ? "booth_assigned" : app.status }).eq("id", app.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("application_activity").insert({ application_id: app.id, event_type: "booth_assigned", to_value: boothId });
    toast.success("Booth assigned");
    qc.invalidateQueries({ queryKey: ["application", appId] });
    qc.invalidateQueries({ queryKey: ["event-booths", app.event_id] });
    qc.invalidateQueries({ queryKey: ["applications", app.event_id] });
  };

  const readOnly = app?.status === "completed" || app?.status === "archived";

  return (
    <Sheet open={!!appId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{app?.business_name ?? "Application"}</SheetTitle>
        </SheetHeader>
        {app && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={app.status} />
              <Badge variant="outline" className="text-[10px] uppercase">{app.entry_method?.replace("_", " ")}</Badge>
              <span className="text-xs text-muted-foreground">Event: {events.find((e) => e.id === app.event_id)?.name ?? "—"}</span>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setStatus("approved")}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("waitlisted")}><Clock className="mr-1 h-4 w-4" /> Waitlist</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("rejected")}><X className="mr-1 h-4 w-4" /> Reject</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("awaiting_payment")}><DollarSign className="mr-1 h-4 w-4" /> Awaiting payment</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("checked_in")}>Check in</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("completed")}>Complete</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("archived")}><Archive className="mr-1 h-4 w-4" /> Archive</Button>
                <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Print</Button>
              </div>
            )}

            <Tabs defaultValue="details">
              <TabsList className="flex-wrap">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="booth">Booth</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="history">History ({history.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-2 pt-4">
                <Row label="Business">{app.business_name || "—"}</Row>
                <Row label="Contact">{app.contact_name || "—"}</Row>
                <Row label="Email">{app.applicant_email || "—"}</Row>
                <Row label="Phone">{app.applicant_phone || "—"}</Row>
                <Row label="Products">{app.products_sold || "—"}</Row>
                <Row label="Requested size">{app.size_requested || "—"}</Row>
                <Row label="Requested location">{app.requested_location || "—"}</Row>
                <Row label="Electric">{app.needs_electricity ? "Yes" : "No"}</Row>
                <Row label="Special requests">{app.special_requests || "—"}</Row>
                <Row label="Payment">{app.payment_amount != null ? `$${Number(app.payment_amount).toFixed(2)}` : "—"}</Row>
              </TabsContent>

              <TabsContent value="booth" className="space-y-2 pt-4">
                <p className="text-sm text-muted-foreground">Current: {app.assigned_booth_id ? booths.find((b) => b.id === app.assigned_booth_id)?.code ?? "—" : "None"}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {booths.map((b) => {
                    const taken = b.assigned_application_id && b.assigned_application_id !== app.id;
                    return (
                      <button key={b.id} disabled={!!taken || readOnly} onClick={() => assignBooth(b.id)}
                        className={`rounded-md border px-2 py-3 text-sm ${b.assigned_application_id === app.id ? "border-primary bg-primary-soft" : taken ? "opacity-40" : "hover:border-primary"}`}>
                        <div className="font-medium">{b.code}</div>
                        <div className="text-xs text-muted-foreground">{b.size_label ?? "—"}</div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 pt-4">
                <FieldRow label="Applicant notes"><Textarea rows={3} defaultValue={app.notes ?? ""} readOnly={readOnly} onBlur={async (e) => { if (readOnly) return; await supabase.from("applications").update({ notes: e.target.value }).eq("id", app.id); qc.invalidateQueries({ queryKey: ["application", appId] }); }} /></FieldRow>
                <FieldRow label="Internal notes"><Textarea rows={3} defaultValue={app.internal_notes ?? ""} readOnly={readOnly} onBlur={async (e) => { if (readOnly) return; await supabase.from("applications").update({ internal_notes: e.target.value }).eq("id", app.id); qc.invalidateQueries({ queryKey: ["application", appId] }); }} /></FieldRow>
              </TabsContent>

              <TabsContent value="history" className="space-y-2 pt-4">
                {history.length === 0 ? <p className="text-sm text-muted-foreground">No prior applications for this vendor.</p> :
                  history.map((h) => (
                    <div key={h.id} className="card-soft flex items-center gap-3 px-4 py-2">
                      <StatusBadge status={h.status} />
                      <div className="flex-1"><p className="text-sm">{(h.events as unknown as { name: string } | null)?.name ?? "Event"}</p><p className="text-xs text-muted-foreground">{new Date(h.applied_at).toLocaleDateString()}</p></div>
                      {h.payment_amount && <span className="text-sm">${Number(h.payment_amount).toFixed(2)}</span>}
                    </div>
                  ))
                }
              </TabsContent>

              <TabsContent value="activity" className="space-y-2 pt-4">
                {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> :
                  activity.map((e) => (
                    <div key={e.id} className="card-soft px-4 py-2 text-sm">
                      <p><span className="font-medium capitalize">{e.event_type.replace("_", " ")}</span> {e.from_value && `· ${e.from_value} → ${e.to_value}`}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                  ))
                }
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="card-soft px-4 py-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm whitespace-pre-wrap">{children}</p></div>;
}
