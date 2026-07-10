import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Search, MoreHorizontal, Archive, ArchiveRestore, Trash2, Pencil, Image as ImageIcon, FileText, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/studio/venues/")({
  head: () => ({ meta: [{ title: "Venue Directory · EventScape Studio" }] }),
  component: VenuesPage,
});

type Venue = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  parking_info: string | null;
  utilities_info: string | null;
  notes: string | null;
  archived_at: string | null;
};

function VenuesPage() {
  const { activeOrg } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Partial<Venue> | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const orgId = activeOrg?.organizationId;
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues", orgId, showArchived],
    enabled: !!orgId,
    queryFn: async (): Promise<Venue[]> => {
      const q = supabase.from("venues").select("id, name, address_line1, city, state, postal_code, parking_info, utilities_info, notes, archived_at").eq("organization_id", orgId!).order("name");
      const { data, error } = showArchived ? await q : await q.is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Venue[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return venues;
    return venues.filter((v) => [v.name, v.city, v.state, v.address_line1].filter(Boolean).some((f) => f!.toLowerCase().includes(s)));
  }, [venues, search]);

  const save = async () => {
    if (!editing || !orgId) return;
    if (!editing.name?.trim()) { toast.error("Name is required"); return; }
    const payload = {
      organization_id: orgId,
      name: editing.name.trim(),
      address_line1: editing.address_line1 || null,
      city: editing.city || null,
      state: editing.state || null,
      postal_code: editing.postal_code || null,
      parking_info: editing.parking_info || null,
      utilities_info: editing.utilities_info || null,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await supabase.from("venues").update(payload).eq("id", editing.id)
      : await supabase.from("venues").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Venue updated" : "Venue created");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["venues", orgId] });
  };

  const archive = async (v: Venue, restore = false) => {
    const { error } = await supabase.from("venues").update({ archived_at: restore ? null : new Date().toISOString() }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success(restore ? "Restored" : "Archived"); qc.invalidateQueries({ queryKey: ["venues", orgId] }); }
  };

  const remove = async (v: Venue) => {
    if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("venues").delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["venues", orgId] }); }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Venue Directory"
        description="Permanent venue records with reusable maps, layout templates, and site information. Events reference venues — they never modify them."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="mr-2 h-4 w-4" /> Add venue
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search venues…" className="pl-9" />
        </div>
        <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Show active" : "Show archived"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={search ? "No matches" : "No venues yet"}
          description={search ? "Try a different search term." : "Add your first venue so every future event can reference the same location, maps, and layout templates."}
          action={!search ? <Button onClick={() => setEditing({})}><Plus className="mr-2 h-4 w-4" /> Add venue</Button> : undefined}
        />
      ) : (
        <div className="card-soft divide-y divide-border/60">
          {filtered.map((v) => (
            <div key={v.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep">
                <MapPin className="h-5 w-5" />
              </div>
              <button className="min-w-0 flex-1 text-left" onClick={() => setDetailId(v.id)}>
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{v.name}</p>
                  {v.archived_at && <Badge variant="outline" className="text-xs">Archived</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[v.address_line1, v.city, v.state].filter(Boolean).join(", ") || "No address on file"}
                </p>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/studio/venues/$venueId/designer" params={{ venueId: v.id }}>
                      <LayoutTemplate className="mr-2 h-4 w-4" /> Open Designer
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDetailId(v.id)}>Details</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditing(v)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                  {v.archived_at ? (
                    <DropdownMenuItem onClick={() => archive(v, true)}><ArchiveRestore className="mr-2 h-4 w-4" /> Restore</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => archive(v)}><Archive className="mr-2 h-4 w-4" /> Archive</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => remove(v)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit venue" : "New venue"}</DialogTitle>
            <DialogDescription>Basic information. You can add maps, documents, and layouts after saving.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Name *"><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></Field>
              <Field label="Address"><Input value={editing.address_line1 ?? ""} onChange={(e) => setEditing({ ...editing, address_line1: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="City"><Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
                <Field label="State"><Input value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })} /></Field>
                <Field label="ZIP"><Input value={editing.postal_code ?? ""} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} /></Field>
              </div>
              <Field label="Parking notes"><Textarea rows={2} value={editing.parking_info ?? ""} onChange={(e) => setEditing({ ...editing, parking_info: e.target.value })} /></Field>
              <Field label="Utilities notes"><Textarea rows={2} value={editing.utilities_info ?? ""} onChange={(e) => setEditing({ ...editing, utilities_info: e.target.value })} /></Field>
              <Field label="Internal notes"><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VenueDetailSheet venueId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function VenueDetailSheet({ venueId, onClose }: { venueId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: venue } = useQuery({
    queryKey: ["venue", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").eq("id", venueId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: maps = [] } = useQuery({
    queryKey: ["venue-maps", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data, error } = await supabase.from("venue_maps").select("*").eq("venue_id", venueId!).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["venue-layouts", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data, error } = await supabase.from("layout_templates").select("id, name, description, is_default").eq("venue_id", venueId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["venue-docs", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data, error } = await supabase.from("venue_documents").select("*").eq("venue_id", venueId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMap = async () => {
    const name = prompt("Map name (e.g. Main Hall, Parking):");
    if (!name || !venueId) return;
    const { error } = await supabase.from("venue_maps").insert({ venue_id: venueId, name });
    if (error) toast.error(error.message);
    else { toast.success("Map added"); qc.invalidateQueries({ queryKey: ["venue-maps", venueId] }); }
  };

  const addTemplate = async () => {
    const name = prompt("Template name (e.g. Holiday Layout):");
    if (!name || !venueId) return;
    const { error } = await supabase.from("layout_templates").insert({ venue_id: venueId, name });
    if (error) toast.error(error.message);
    else { toast.success("Template created — open the Booth Builder to design it"); qc.invalidateQueries({ queryKey: ["venue-layouts", venueId] }); }
  };

  return (
    <Sheet open={!!venueId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{venue?.name ?? "Venue"}</SheetTitle>
        </SheetHeader>
        {venue && (
          <div className="mt-6">
            <Tabs defaultValue="info">
              <TabsList className="flex-wrap">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="maps">Maps ({maps.length})</TabsTrigger>
                <TabsTrigger value="layouts">Layouts ({templates.length})</TabsTrigger>
                <TabsTrigger value="docs">Documents ({docs.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 pt-4">
                <InfoRow label="Address" value={[venue.address_line1, venue.city, venue.state, venue.postal_code].filter(Boolean).join(", ") || "—"} />
                <InfoRow label="Parking" value={venue.parking_info || "—"} />
                <InfoRow label="Utilities" value={venue.utilities_info || "—"} />
                <InfoRow label="Notes" value={venue.notes || "—"} />
              </TabsContent>

              <TabsContent value="maps" className="space-y-2 pt-4">
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addMap}><Plus className="mr-2 h-3 w-3" /> Add map</Button></div>
                {maps.length === 0 ? <EmptyState icon={ImageIcon} title="No maps yet" description="Add reusable site maps: Main Hall, Parking, Food Court, Outdoor Grounds…" /> :
                  maps.map((m) => (
                    <div key={m.id} className="card-soft flex items-center gap-3 px-4 py-3">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1"><p className="font-medium">{m.name}</p>{m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}</div>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="layouts" className="space-y-2 pt-4">
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addTemplate}><Plus className="mr-2 h-3 w-3" /> New template</Button></div>
                {templates.length === 0 ? <EmptyState icon={LayoutTemplate} title="No layout templates" description="Save reusable booth layouts here. Every event picks a template as its starting point." /> :
                  templates.map((t) => (
                    <div key={t.id} className="card-soft flex items-center gap-3 px-4 py-3">
                      <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1"><p className="font-medium">{t.name}</p>{t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}</div>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="docs" className="space-y-2 pt-4">
                {docs.length === 0 ? <EmptyState icon={FileText} title="No documents" description="Insurance, permits, contracts, and reference PDFs can live here." /> :
                  docs.map((d) => (
                    <div key={d.id} className="card-soft flex items-center gap-3 px-4 py-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1"><p className="font-medium">{d.name}</p></div>
                    </div>
                  ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}
