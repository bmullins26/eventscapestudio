import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, MoreHorizontal, Copy, BookmarkPlus, Archive, ArchiveRestore, LayoutTemplate, Pencil, Trash2, Map } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cloneEvent } from "@/lib/events.functions";
import { createEventFromTemplate, updateEvent, deleteEvent } from "@/lib/studio.functions";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/studio/events")({
  head: () => ({
    meta: [
      { title: "Event Library · EventScape Studio" },
      { name: "description", content: "All events, drafts, archives, and templates for your organization." },
    ],
  }),
  component: EventLibraryPage,
});

type EventRow = {
  id: string;
  name: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  is_template: boolean;
  venue_id: string | null;
};

const ACTIVE_STATUSES = ["published", "in_progress"];
const ARCHIVED_STATUSES = ["completed", "cancelled", "archived"];

function fmtRange(start: string | null, end: string | null) {
  if (!start && !end) return "No dates set";
  const s = start ? new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "?";
  const e = end ? new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
  return e && e !== s ? `${s} – ${e}` : s;
}

function EventLibraryPage() {
  const { activeOrg } = useAuth();
  const [editTarget, setEditTarget] = useState<EventRow | null>(null);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "drafts" | "archived" | "templates">("active");
  const [cloneTarget, setCloneTarget] = useState<EventRow | null>(null);
  const [cloneAsTemplate, setCloneAsTemplate] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState<{ venueId: string; templateId: string; name: string; startsAt: string; endsAt: string }>({ venueId: "", templateId: "", name: "", startsAt: "", endsAt: "" });
  const createFromTpl = useServerFn(createEventFromTemplate);

  const { data: venues = [] } = useQuery({
    queryKey: ["events-venues-select", activeOrg?.organizationId],
    enabled: !!activeOrg?.organizationId,
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("id, name").eq("organization_id", activeOrg!.organizationId).is("archived_at", null).order("name");
      return data ?? [];
    },
  });

  const { data: templatesForVenue = [] } = useQuery({
    queryKey: ["events-templates-select", newEvent.venueId],
    enabled: !!newEvent.venueId,
    queryFn: async () => {
      const { data } = await supabase.from("layout_templates").select("id, name").eq("venue_id", newEvent.venueId).order("name");
      return data ?? [];
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["studio-events", activeOrg?.organizationId],
    enabled: !!activeOrg?.organizationId,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, status, starts_at, ends_at, is_template, venue_id")
        .eq("organization_id", activeOrg!.organizationId)
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const partitioned = useMemo(() => {
    const templates = events.filter((e) => e.is_template);
    const nonT = events.filter((e) => !e.is_template);
    return {
      active: nonT.filter((e) => ACTIVE_STATUSES.includes(e.status)),
      drafts: nonT.filter((e) => e.status === "draft"),
      archived: nonT.filter((e) => ARCHIVED_STATUSES.includes(e.status)),
      templates,
    };
  }, [events]);

  const openClone = (row: EventRow, asTemplate: boolean) => {
    setCloneTarget(row);
    setCloneAsTemplate(asTemplate);
    setCloneName(asTemplate ? `${row.name} (Template)` : `${row.name} (Copy)`);
  };

  const runClone = async () => {
    if (!cloneTarget) return;
    setBusy(true);
    try {
      await cloneEvent({
        data: {
          sourceEventId: cloneTarget.id,
          newName: cloneName.trim() || `${cloneTarget.name} (Copy)`,
          asTemplate: cloneAsTemplate,
        },
      });
      toast.success(cloneAsTemplate ? "Template saved" : "Event cloned");
      setCloneTarget(null);
      qc.invalidateQueries({ queryKey: ["studio-events", activeOrg?.organizationId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (row: EventRow, status: "draft" | "archived") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["studio-events", activeOrg?.organizationId] });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Event Library"
        description="Every event you've run, draft, archived, or templated — all in one place."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTab("templates")}>
              <LayoutTemplate className="mr-2 h-4 w-4" /> From template
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" /> New event
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="active">Active <span className="ml-2 text-xs text-muted-foreground">{partitioned.active.length}</span></TabsTrigger>
          <TabsTrigger value="drafts">Drafts <span className="ml-2 text-xs text-muted-foreground">{partitioned.drafts.length}</span></TabsTrigger>
          <TabsTrigger value="archived">Archived <span className="ml-2 text-xs text-muted-foreground">{partitioned.archived.length}</span></TabsTrigger>
          <TabsTrigger value="templates">Templates <span className="ml-2 text-xs text-muted-foreground">{partitioned.templates.length}</span></TabsTrigger>
        </TabsList>

        {(["active", "drafts", "archived", "templates"] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-6">
            <EventList
              rows={partitioned[key]}
              loading={isLoading}
              bucket={key}
              onClone={(r) => openClone(r, false)}
              onSaveTemplate={(r) => openClone(r, true)}
              onArchive={(r) => setStatus(r, "archived")}
              onRestore={(r) => setStatus(r, "draft")}
              onOpen={(r) => setEditTarget(r)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!cloneTarget} onOpenChange={(o) => !o && setCloneTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cloneAsTemplate ? "Save as template" : "Clone event"}</DialogTitle>
            <DialogDescription>
              {cloneAsTemplate
                ? "Templates are reusable starting points — booth layouts and setup carry over, applications and payments do not."
                : "This creates a new draft event with the same booth layout. Applications, payments, and messages are not copied."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clone-name">Name</Label>
            <Input id="clone-name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={runClone} disabled={busy}>
              {cloneAsTemplate ? "Save template" : "Clone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>Select a venue and layout template. The event will start as a draft with its own copy of the booth layout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Venue</Label>
              <Select value={newEvent.venueId} onValueChange={(v) => setNewEvent({ ...newEvent, venueId: v, templateId: "" })}>
                <SelectTrigger><SelectValue placeholder="Choose venue" /></SelectTrigger>
                <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Layout template</Label>
              <Select value={newEvent.templateId} onValueChange={(v) => setNewEvent({ ...newEvent, templateId: v })} disabled={!newEvent.venueId}>
                <SelectTrigger><SelectValue placeholder={newEvent.venueId ? "Choose template" : "Pick a venue first"} /></SelectTrigger>
                <SelectContent>{templatesForVenue.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {newEvent.venueId && templatesForVenue.length === 0 && <p className="text-xs text-muted-foreground">This venue has no layout templates yet. Create one from Venue detail → Layouts.</p>}
            </div>
            <div className="space-y-1"><Label>Event name</Label><Input value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="Spring Market 2026" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Starts</Label><Input type="date" value={newEvent.startsAt} onChange={(e) => setNewEvent({ ...newEvent, startsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" value={newEvent.endsAt} onChange={(e) => setNewEvent({ ...newEvent, endsAt: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button disabled={busy || !newEvent.venueId || !newEvent.templateId || !newEvent.name.trim()} onClick={async () => {
              if (!activeOrg) return;
              setBusy(true);
              try {
                await createFromTpl({ data: {
                  organizationId: activeOrg.organizationId,
                  venueId: newEvent.venueId,
                  layoutTemplateId: newEvent.templateId,
                  name: newEvent.name.trim(),
                  startsAt: newEvent.startsAt || null,
                  endsAt: newEvent.endsAt || null,
                }});
                toast.success("Event created");
                setCreating(false);
                setNewEvent({ venueId: "", templateId: "", name: "", startsAt: "", endsAt: "" });
                qc.invalidateQueries({ queryKey: ["studio-events", activeOrg.organizationId] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to create event");
              } finally { setBusy(false); }
            }}>Create event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditEventSheet
        target={editTarget}
        venues={venues}
        onClose={() => setEditTarget(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["studio-events", activeOrg?.organizationId] }); setEditTarget(null); }}
      />
    </div>
  );
}

function EventList({
  rows, loading, bucket, onClone, onSaveTemplate, onArchive, onRestore, onOpen,
}: {
  rows: EventRow[];
  loading: boolean;
  bucket: "active" | "drafts" | "archived" | "templates";
  onClone: (r: EventRow) => void;
  onSaveTemplate: (r: EventRow) => void;
  onArchive: (r: EventRow) => void;
  onRestore: (r: EventRow) => void;
  onOpen: (r: EventRow) => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (rows.length === 0) {
    const messages: Record<typeof bucket, { title: string; desc: string }> = {
      active: { title: "No active events", desc: "Publish a draft or create a new event to see it here." },
      drafts: { title: "No drafts", desc: "Draft events you're still assembling will appear here." },
      archived: { title: "Nothing archived", desc: "Completed and archived events are kept here for reporting and cloning." },
      templates: { title: "No templates yet", desc: "Save any event as a template to reuse its layout and setup next season." },
    };
    return <EmptyState icon={CalendarDays} title={messages[bucket].title} description={messages[bucket].desc} />;
  }
  return (
    <div className="card-soft divide-y divide-border/60">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => onOpen(r)}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep">
            {r.is_template ? <LayoutTemplate className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{r.name}</p>
              {!r.is_template && <StatusBadge status={r.status} />}
              {r.is_template && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Template</span>}
            </div>
            <p className="text-xs text-muted-foreground">{r.is_template ? "Reusable template" : fmtRange(r.starts_at, r.ends_at)}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(r)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              {!r.is_template && r.venue_id ? (
                <DropdownMenuItem asChild>
                  <Link to="/studio/events/$eventId/venue" params={{ eventId: r.id }}>
                    <Map className="mr-2 h-4 w-4" /> Venue map
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onClone(r)}>
                <Copy className="mr-2 h-4 w-4" /> Clone
              </DropdownMenuItem>
              {!r.is_template && (
                <DropdownMenuItem onClick={() => onSaveTemplate(r)}>
                  <BookmarkPlus className="mr-2 h-4 w-4" /> Save as template
                </DropdownMenuItem>
              )}
              {bucket !== "archived" && !r.is_template && (
                <DropdownMenuItem onClick={() => onArchive(r)}>
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
              )}
              {bucket === "archived" && (
                <DropdownMenuItem onClick={() => onRestore(r)}>
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore to drafts
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditEventSheet({ target, venues, onClose, onSaved }: {
  target: EventRow | null;
  venues: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updateEvent);
  const deleteFn = useServerFn(deleteEvent);
  const [form, setForm] = useState<{
    name: string; description: string; status: string;
    starts_at: string; ends_at: string; venue_id: string;
    applications_open: boolean; is_public: boolean; slug: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!target) { setForm(null); return; }
    let cancelled = false;
    void supabase.from("events").select("name, description, status, starts_at, ends_at, venue_id, applications_open, is_public, slug").eq("id", target.id).maybeSingle().then(({ data }) => {
      if (cancelled || !data) return;
      setForm({
        name: data.name ?? "",
        description: data.description ?? "",
        status: data.status ?? "draft",
        starts_at: data.starts_at ? data.starts_at.slice(0, 10) : "",
        ends_at: data.ends_at ? data.ends_at.slice(0, 10) : "",
        venue_id: data.venue_id ?? "",
        applications_open: !!data.applications_open,
        is_public: !!data.is_public,
        slug: data.slug ?? "",
      });
    });
    return () => { cancelled = true; };
  }, [target]);

  const open = !!target;
  const save = async () => {
    if (!target || !form) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (form.is_public && !/^[a-z0-9-]+$/.test(form.slug)) { toast.error("Slug must be lowercase letters, numbers, or dashes"); return; }
    setBusy(true);
    try {
      await updateFn({ data: {
        eventId: target.id,
        patch: {
          name: form.name.trim(),
          description: form.description || null,
          status: form.status as "draft" | "published" | "in_progress" | "completed" | "cancelled" | "archived",
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          venue_id: form.venue_id || null,
          applications_open: form.applications_open,
          is_public: form.is_public,
          slug: form.slug || undefined,
        },
      }});
      toast.success("Event updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await deleteFn({ data: { eventId: target.id } });
      toast.success("Event deleted");
      setConfirmDelete(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit event</SheetTitle>
          <SheetDescription>Update details, dates, venue, and public application settings.</SheetDescription>
        </SheetHeader>
        {!form ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Starts</Label><Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Venue</Label>
              <Select value={form.venue_id || "__none"} onValueChange={(v) => setForm({ ...form, venue_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="No venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No venue</SelectItem>
                  {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Accept applications</p>
                <p className="text-xs text-muted-foreground">Vendors can submit applications for this event.</p>
              </div>
              <Switch checked={form.applications_open} onCheckedChange={(v) => setForm({ ...form, applications_open: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Public application page</p>
                <p className="text-xs text-muted-foreground">Share <code className="text-[11px]">/apply/{form.slug || "…"}</code> with vendors.</p>
              </div>
              <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
            </div>
            {form.is_public && (
              <div className="space-y-1">
                <Label>Public URL slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="spring-market-2026" />
              </div>
            )}
          </div>
        )}
        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy || !form}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form}>Save changes</Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the event and its booth layout. Events with applications or payments cannot be deleted — archive them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
