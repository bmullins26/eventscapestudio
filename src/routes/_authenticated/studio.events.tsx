import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, MoreHorizontal, Copy, BookmarkPlus, Archive, ArchiveRestore, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cloneEvent } from "@/lib/events.functions";
import { createEventFromTemplate } from "@/lib/studio.functions";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();
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
            <Button>
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
              onOpen={(r) => navigate({ to: "/studio/events" })}
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
        <div key={r.id} className="flex items-center gap-4 px-5 py-4">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(r)}>Open</DropdownMenuItem>
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
      ))}
    </div>
  );
}
