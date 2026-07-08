import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Grid3x3, Undo2, Redo2, Copy, Trash2, ZoomIn, ZoomOut, Map, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

const SearchSchema = z.object({
  template: z.string().uuid().optional(),
  venue: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/studio/booths")({
  validateSearch: zodValidator(SearchSchema),
  head: () => ({ meta: [{ title: "Booth Layout Builder · EventScape Studio" }] }),
  component: BoothsPage,
});

type Booth = {
  id: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  category: string | null;
  size_label: string | null;
  price: number | null;
  is_electric: boolean;
  is_premium: boolean;
  is_reserved: boolean;
  notes: string | null;
  _new?: boolean;
  _deleted?: boolean;
};

const GRID = 20;

function BoothsPage() {
  const { activeOrg } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const orgId = activeOrg?.organizationId;

  // Venue + template selectors
  const { data: venues = [] } = useQuery({
    queryKey: ["venues-select", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("id, name").eq("organization_id", orgId!).is("archived_at", null).order("name");
      return data ?? [];
    },
  });

  const venueId = search.venue ?? venues[0]?.id;

  const { data: templates = [] } = useQuery({
    queryKey: ["layout-templates", venueId],
    enabled: !!venueId,
    queryFn: async () => {
      const { data } = await supabase.from("layout_templates").select("id, name").eq("venue_id", venueId!).order("name");
      return data ?? [];
    },
  });

  const templateId = search.template ?? templates[0]?.id;

  const { data: dbBooths = [], isLoading } = useQuery({
    queryKey: ["template-booths", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data } = await supabase.from("layout_template_booths").select("*").eq("layout_template_id", templateId!).order("code");
      return (data ?? []) as Booth[];
    },
  });

  const { data: refLayers = [] } = useQuery({
    queryKey: ["template-refs", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data } = await supabase.from("venue_map_references").select("*").eq("layout_template_id", templateId!).order("sort_order");
      return data ?? [];
    },
  });

  // Canvas state
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<Booth[][]>([]);
  const [future, setFuture] = useState<Booth[][]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setBooths(dbBooths.map((b) => ({ ...b, price: b.price != null ? Number(b.price) : null })));
    setSelectedId(null);
    setDirty(false);
    setHistory([]); setFuture([]);
  }, [dbBooths]);

  const pushHistory = useCallback((prev: Booth[]) => {
    setHistory((h) => [...h.slice(-30), prev]);
    setFuture([]);
  }, []);

  const mutate = useCallback((updater: (list: Booth[]) => Booth[]) => {
    setBooths((prev) => {
      pushHistory(prev);
      setDirty(true);
      return updater(prev);
    });
  }, [pushHistory]);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [booths, ...f]);
      setBooths(prev);
      setDirty(true);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, booths]);
      setBooths(next);
      setDirty(true);
      return f.slice(1);
    });
  };

  const selected = booths.find((b) => b.id === selectedId && !b._deleted) ?? null;

  const addBooth = () => {
    const nextNum = booths.filter((b) => !b._deleted).length + 1;
    const nid = `new-${crypto.randomUUID()}`;
    mutate((list) => [...list, {
      id: nid, code: String(nextNum), x: 40, y: 40, width: 80, height: 80, rotation: 0,
      category: null, size_label: "10x10", price: null, is_electric: false, is_premium: false, is_reserved: false, notes: null, _new: true,
    }]);
    setSelectedId(nid);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const nid = `new-${crypto.randomUUID()}`;
    mutate((list) => [...list, { ...selected, id: nid, x: selected.x + 20, y: selected.y + 20, code: selected.code + "'", _new: true, _deleted: false }]);
    setSelectedId(nid);
  };

  const deleteSelected = () => {
    if (!selected) return;
    mutate((list) => list.map((b) => b.id === selected.id ? { ...b, _deleted: true } : b));
    setSelectedId(null);
  };

  const updateSelected = (patch: Partial<Booth>) => {
    if (!selected) return;
    mutate((list) => list.map((b) => b.id === selected.id ? { ...b, ...patch } : b));
  };

  // Drag
  const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onBoothMouseDown = (e: React.MouseEvent, b: Booth) => {
    e.stopPropagation();
    setSelectedId(b.id);
    dragState.current = { id: b.id, startX: e.clientX, startY: e.clientY, origX: b.x, origY: b.y };
    pushHistory(booths);
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const d = dragState.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    let nx = d.origX + dx;
    let ny = d.origY + dy;
    if (snap) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; }
    setBooths((prev) => prev.map((b) => b.id === d.id ? { ...b, x: nx, y: ny } : b));
    setDirty(true);
  };
  const onCanvasMouseUp = () => { dragState.current = null; };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "d") { e.preventDefault(); duplicateSelected(); }
      else if (e.key === "Delete" || e.key === "Backspace") { deleteSelected(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const saveAll = async () => {
    if (!templateId) return;
    const toDelete = booths.filter((b) => b._deleted && !b._new).map((b) => b.id);
    const toInsert = booths.filter((b) => b._new && !b._deleted).map((b) => ({
      layout_template_id: templateId, code: b.code, x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation,
      category: b.category, size_label: b.size_label, price: b.price, is_electric: b.is_electric, is_premium: b.is_premium, is_reserved: b.is_reserved, notes: b.notes,
    }));
    const toUpdate = booths.filter((b) => !b._new && !b._deleted);

    if (toDelete.length) {
      const { error } = await supabase.from("layout_template_booths").delete().in("id", toDelete);
      if (error) { toast.error(error.message); return; }
    }
    if (toInsert.length) {
      const { error } = await supabase.from("layout_template_booths").insert(toInsert);
      if (error) { toast.error(error.message); return; }
    }
    for (const b of toUpdate) {
      const { error } = await supabase.from("layout_template_booths").update({
        code: b.code, x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation,
        category: b.category, size_label: b.size_label, price: b.price, is_electric: b.is_electric, is_premium: b.is_premium, is_reserved: b.is_reserved, notes: b.notes,
      }).eq("id", b.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Layout saved");
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["template-booths", templateId] });
  };

  const uploadReference = async (file: File) => {
    if (!templateId || !orgId) return;
    const key = `${orgId}/refs/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("venue-assets").upload(key, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("venue-assets").createSignedUrl(key, 60 * 60 * 24 * 365);
    if (!signed) { toast.error("Failed to sign URL"); return; }
    const { error } = await supabase.from("venue_map_references").insert({
      layout_template_id: templateId,
      image_url: signed.signedUrl,
      original_filename: file.name,
    });
    if (error) toast.error(error.message);
    else { toast.success("Reference imported"); qc.invalidateQueries({ queryKey: ["template-refs", templateId] }); }
  };

  const updateRef = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("venue_map_references").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["template-refs", templateId] });
  };

  const deleteRef = async (id: string) => {
    if (!confirm("Delete this reference layer?")) return;
    const { error } = await supabase.from("venue_map_references").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["template-refs", templateId] });
  };

  const activeBooths = booths.filter((b) => !b._deleted);
  const canvasW = 1200, canvasH = 800;

  if (!orgId) return null;

  if (venues.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Studio" title="Booth Layout Builder" description="Design reusable booth layouts on top of imported venue maps." />
        <EmptyState icon={Map} title="Add a venue first" description="Layout templates belong to a venue. Create one from Venues, then come back." />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Studio"
          title="Booth Layout Builder"
          actions={
            <Select value={venueId} onValueChange={(v) => navigate({ search: { venue: v, template: undefined } })}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          }
        />
        <EmptyState
          icon={LayoutTemplate}
          title="No layout templates for this venue"
          description="Create a template from the Venue detail page, then design its booth layout here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Studio"
        title="Booth Layout Builder"
        description="Design once, reuse for every event. Import a venue drawing as a reference layer and trace over it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={venueId} onValueChange={(v) => navigate({ search: { venue: v, template: undefined } })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={templateId} onValueChange={(v) => navigate({ search: { ...search, template: v } })}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={saveAll} disabled={!dirty}>
              <Save className="mr-2 h-4 w-4" /> {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Canvas */}
        <div className="card-soft p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={addBooth}><Plus className="mr-1 h-4 w-4" /> Booth</Button>
            <Button size="sm" variant="outline" onClick={duplicateSelected} disabled={!selected}><Copy className="mr-1 h-4 w-4" /> Duplicate</Button>
            <Button size="sm" variant="outline" onClick={deleteSelected} disabled={!selected}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
            <Separator orientation="vertical" className="h-6" />
            <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0}><Undo2 className="mr-1 h-4 w-4" /> Undo</Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={future.length === 0}><Redo2 className="mr-1 h-4 w-4" /> Redo</Button>
            <Separator orientation="vertical" className="h-6" />
            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
            <div className="flex items-center gap-2 pl-2">
              <Grid3x3 className="h-4 w-4" />
              <Switch checked={snap} onCheckedChange={setSnap} />
              <span className="text-xs">Snap</span>
            </div>
            <label className="ml-auto text-xs">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadReference(e.target.files[0])} id="ref-upload" />
              <Button size="sm" variant="outline" asChild><label htmlFor="ref-upload"><Map className="mr-1 h-4 w-4" /> Import venue map</label></Button>
            </label>
          </div>

          <div className="overflow-auto rounded-md border border-border/60 bg-muted/30" style={{ height: 560 }}>
            <svg
              ref={svgRef}
              width={canvasW * zoom}
              height={canvasH * zoom}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
              onClick={() => setSelectedId(null)}
              style={{ background: "white" }}
            >
              {/* Layer 1: grid */}
              <defs>
                <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#grid)" />

              {/* Layer 2: reference images */}
              {refLayers.filter((r) => r.visible).map((r) => (
                <g key={r.id} transform={`translate(${r.offset_x} ${r.offset_y}) rotate(${r.rotation}) scale(${r.scale})`} opacity={r.opacity}>
                  <image href={r.image_url} x={0} y={0} width={800} height={600} preserveAspectRatio="xMidYMid meet" />
                </g>
              ))}

              {/* Layer 4: booths */}
              {activeBooths.map((b) => {
                const sel = b.id === selectedId;
                const fill = b.is_reserved ? "#fee2e2" : b.is_premium ? "#fef3c7" : "#dbeafe";
                const stroke = sel ? "#2563eb" : "#64748b";
                return (
                  <g key={b.id} transform={`translate(${b.x} ${b.y}) rotate(${b.rotation} ${b.width / 2} ${b.height / 2})`}
                    onMouseDown={(e) => onBoothMouseDown(e, b)}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                    style={{ cursor: "move" }}>
                    <rect width={b.width} height={b.height} fill={fill} stroke={stroke} strokeWidth={sel ? 2 : 1} rx={4} />
                    <text x={b.width / 2} y={b.height / 2} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#1e293b" fontWeight={600}>
                      {b.code}
                    </text>
                    {b.is_electric && <circle cx={b.width - 8} cy={8} r={4} fill="#f59e0b" />}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          {selected ? (
            <div className="card-soft p-4 space-y-3">
              <p className="font-display text-sm font-semibold">Booth {selected.code}</p>
              <FieldRow label="Booth #"><Input value={selected.code} onChange={(e) => updateSelected({ code: e.target.value })} /></FieldRow>
              <FieldRow label="Size"><Input placeholder="10x10" value={selected.size_label ?? ""} onChange={(e) => updateSelected({ size_label: e.target.value })} /></FieldRow>
              <FieldRow label="Price ($)"><Input type="number" value={selected.price ?? ""} onChange={(e) => updateSelected({ price: e.target.value === "" ? null : Number(e.target.value) })} /></FieldRow>
              <FieldRow label="Category"><Input value={selected.category ?? ""} onChange={(e) => updateSelected({ category: e.target.value })} placeholder="Food, Craft, Service…" /></FieldRow>
              <div className="grid grid-cols-2 gap-2">
                <FieldRow label="Width"><Input type="number" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></FieldRow>
                <FieldRow label="Height"><Input type="number" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></FieldRow>
                <FieldRow label="Rotation"><Input type="number" value={selected.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /></FieldRow>
              </div>
              <div className="space-y-2">
                <Toggle label="Electric" checked={selected.is_electric} onChange={(v) => updateSelected({ is_electric: v })} />
                <Toggle label="Premium" checked={selected.is_premium} onChange={(v) => updateSelected({ is_premium: v })} />
                <Toggle label="Reserved" checked={selected.is_reserved} onChange={(v) => updateSelected({ is_reserved: v })} />
              </div>
            </div>
          ) : (
            <div className="card-soft p-4 text-sm text-muted-foreground">
              Select a booth to edit its properties, or click <strong>Booth</strong> to add one.
            </div>
          )}

          {/* Reference layer manager */}
          <div className="card-soft p-4 space-y-3">
            <p className="font-display text-sm font-semibold">Reference layer</p>
            {refLayers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Import a sketch, PDF, or blueprint above to trace over.</p>
            ) : refLayers.map((r) => (
              <div key={r.id} className="rounded-md border border-border/60 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium">{r.original_filename ?? "Reference"}</span>
                  <Button size="icon" variant="ghost" onClick={() => deleteRef(r.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <label className="flex items-center justify-between text-xs">Visible <Switch checked={r.visible} onCheckedChange={(v) => updateRef(r.id, { visible: v })} /></label>
                <label className="flex items-center justify-between text-xs">Locked <Switch checked={r.locked} onCheckedChange={(v) => updateRef(r.id, { locked: v })} /></label>
                <div><Label className="text-xs">Opacity</Label><Slider value={[Number(r.opacity) * 100]} max={100} step={5} onValueChange={([v]) => updateRef(r.id, { opacity: v / 100 })} /></div>
                <div><Label className="text-xs">Scale</Label><Slider value={[Number(r.scale) * 100]} min={20} max={300} step={5} onValueChange={([v]) => updateRef(r.id, { scale: v / 100 })} /></div>
                <div><Label className="text-xs">Rotation</Label><Slider value={[Number(r.rotation)]} min={-180} max={180} step={5} onValueChange={([v]) => updateRef(r.id, { rotation: v })} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading layout…</p>}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    </label>
  );
}
