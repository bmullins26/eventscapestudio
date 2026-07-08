import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Save, Grid3x3, Undo2, Redo2, Copy, Trash2, ZoomIn, ZoomOut, Map, LayoutTemplate,
  Download, FileText, Image as ImageIcon, Loader2, Search, PencilRuler, Eye, Settings2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadPdf, renderPdfPageToBlob, loadImageNaturalSize } from "@/lib/pdf-render";
import { PdfPagePicker } from "@/components/booth-builder/pdf-page-picker";
import { useDeviceClass } from "@/components/booth-builder/use-device-class";
import { useAppMode } from "@/components/booth-builder/use-app-mode";
import { useCanvasInput } from "@/components/booth-builder/use-canvas-input";
import { cn } from "@/lib/utils";

const SearchSchema = z.object({
  template: z.string().uuid().optional(),
  venue: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/studio/booths")({
  validateSearch: (search: Record<string, unknown>) => SearchSchema.parse(search),
  head: () => ({ meta: [{ title: "Venue Designer · EventScape Studio" }] }),
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

  const device = useDeviceClass();
  const [mode, setMode] = useAppMode(device);
  const isTouch = device !== "desktop";
  const isPhone = device === "phone";

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
  const [propOpen, setPropOpen] = useState(false); // phone drawer / tablet sheet
  const [search_, setSearch_] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const duplicateBooth = (b: Booth) => {
    const nid = `new-${crypto.randomUUID()}`;
    mutate((list) => [...list, { ...b, id: nid, x: b.x + 20, y: b.y + 20, code: b.code + "'", _new: true, _deleted: false }]);
    setSelectedId(nid);
  };
  const duplicateSelected = () => selected && duplicateBooth(selected);

  const deleteBooth = (b: Booth) => {
    mutate((list) => list.map((x) => x.id === b.id ? { ...x, _deleted: true } : x));
    if (selectedId === b.id) setSelectedId(null);
  };
  const deleteSelected = () => selected && deleteBooth(selected);

  const toggleBoothField = (b: Booth, field: "is_reserved" | "is_electric" | "is_premium") => {
    mutate((list) => list.map((x) => x.id === b.id ? { ...x, [field]: !x[field] } : x));
  };

  const updateSelected = (patch: Partial<Booth>) => {
    if (!selected) return;
    mutate((list) => list.map((b) => b.id === selected.id ? { ...b, ...patch } : b));
  };

  // Per-booth drag using Pointer Events (mouse / touch / pen unified).
  // Palm rejection: ignore `touch` while a pen is/was active recently.
  const lastPenAt = useRef(0);
  const dragState = useRef<{ id: string; pointerId: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const onBoothPointerDown = (e: React.PointerEvent, b: Booth) => {
    if (mode === "field") { setSelectedId(b.id); if (isPhone) setPropOpen(true); return; }
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    if (e.pointerType === "touch" && Date.now() - lastPenAt.current < 300) return; // palm
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
    setSelectedId(b.id);
    dragState.current = { id: b.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: b.x, origY: b.y, moved: false };
    pushHistory(booths);
  };
  const onBoothPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (!d.moved && Math.hypot(dx, dy) < (e.pointerType === "pen" ? 2 : 4)) return;
    d.moved = true;
    let nx = d.origX + dx;
    let ny = d.origY + dy;
    const snapPx = e.pointerType === "pen" ? 4 : GRID;
    if (snap) { nx = Math.round(nx / snapPx) * snapPx; ny = Math.round(ny / snapPx) * snapPx; }
    setBooths((prev) => prev.map((b) => b.id === d.id ? { ...b, x: nx, y: ny } : b));
    setDirty(true);
  };
  const onBoothPointerUp = (e: React.PointerEvent) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  };

  // Canvas-level input: pinch-zoom, two-finger pan, wheel-zoom.
  const canvasInput = useCanvasInput({
    onPan: (dx, dy) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
    },
    onZoom: (factor) => {
      setZoom((z) => Math.max(0.3, Math.min(3, z * factor)));
    },
  });

  // Keyboard shortcuts (desktop primarily)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
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

  // Reference upload (unchanged)
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  const insertReferenceRow = async (row: {
    image_url: string; original_filename: string; source_file_url: string | null;
    source_mime_type: string; source_page: number | null; natural_width: number; natural_height: number;
  }) => {
    if (!templateId) return;
    const { error } = await supabase.from("venue_map_references").insert({ layout_template_id: templateId, ...row });
    if (error) toast.error(error.message);
    else { toast.success("Reference imported"); qc.invalidateQueries({ queryKey: ["template-refs", templateId] }); }
  };

  const uploadReference = async (file: File) => {
    if (!templateId || !orgId) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) { setPendingPdf(file); return; }
    setUploadingRef(true);
    try {
      const size = await loadImageNaturalSize(file).catch(() => ({ width: 1200, height: 900 }));
      const key = `${orgId}/refs/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("venue-assets").upload(key, file);
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("venue-assets").createSignedUrl(key, 60 * 60 * 24 * 365);
      if (!signed) { toast.error("Failed to sign URL"); return; }
      await insertReferenceRow({
        image_url: signed.signedUrl, original_filename: file.name, source_file_url: signed.signedUrl,
        source_mime_type: file.type || "image/*", source_page: null, natural_width: size.width, natural_height: size.height,
      });
    } finally { setUploadingRef(false); }
  };

  const handlePdfPageChosen = async (pageNumber: number) => {
    if (!pendingPdf || !templateId || !orgId) return;
    const file = pendingPdf;
    setPendingPdf(null);
    setUploadingRef(true);
    const toastId = toast.loading("Rendering PDF page…");
    try {
      const pdf = await loadPdf(file);
      const { blob, width, height } = await renderPdfPageToBlob(pdf, pageNumber, 2);
      const uid = crypto.randomUUID();
      const baseName = file.name.replace(/\.pdf$/i, "");
      const pngKey = `${orgId}/refs/${uid}-${baseName}-p${pageNumber}.png`;
      const pdfKey = `${orgId}/refs/${uid}-${file.name}`;
      const [{ error: pngErr }, { error: pdfErr }] = await Promise.all([
        supabase.storage.from("venue-assets").upload(pngKey, blob, { contentType: "image/png" }),
        supabase.storage.from("venue-assets").upload(pdfKey, file, { contentType: "application/pdf" }),
      ]);
      if (pngErr || pdfErr) { toast.error((pngErr ?? pdfErr)!.message, { id: toastId }); return; }
      const [pngSigned, pdfSigned] = await Promise.all([
        supabase.storage.from("venue-assets").createSignedUrl(pngKey, 60 * 60 * 24 * 365),
        supabase.storage.from("venue-assets").createSignedUrl(pdfKey, 60 * 60 * 24 * 365),
      ]);
      if (!pngSigned.data || !pdfSigned.data) { toast.error("Failed to sign URLs", { id: toastId }); return; }
      await insertReferenceRow({
        image_url: pngSigned.data.signedUrl, original_filename: file.name, source_file_url: pdfSigned.data.signedUrl,
        source_mime_type: "application/pdf", source_page: pageNumber, natural_width: width, natural_height: height,
      });
      toast.dismiss(toastId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF render failed", { id: toastId });
    } finally { setUploadingRef(false); }
  };

  const updateRef = async (id: string, patch: Partial<{ visible: boolean; locked: boolean; opacity: number; scale: number; rotation: number; offset_x: number; offset_y: number; sort_order: number }>) => {
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
  const filteredBooths = useMemo(() => {
    const q = search_.trim().toLowerCase();
    if (!q) return activeBooths;
    return activeBooths.filter((b) =>
      b.code.toLowerCase().includes(q) ||
      (b.category ?? "").toLowerCase().includes(q) ||
      (b.notes ?? "").toLowerCase().includes(q),
    );
  }, [activeBooths, search_]);

  const canvasW = 1200, canvasH = 800;

  // Open property panel automatically on phone/tablet when a booth is selected
  useEffect(() => {
    if (selectedId && isTouch) setPropOpen(true);
  }, [selectedId, isTouch]);

  const focusBooth = (b: Booth) => {
    setSelectedId(b.id);
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({
        left: b.x * zoom - el.clientWidth / 2 + (b.width * zoom) / 2,
        top: b.y * zoom - el.clientHeight / 2 + (b.height * zoom) / 2,
        behavior: "smooth",
      });
    }
  };

  if (!orgId) return null;

  if (venues.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Studio" title="Venue Designer" description="Design reusable booth layouts on top of imported venue maps." />
        <EmptyState icon={Map} title="Add a venue first" description="Layout templates belong to a venue. Create one from Venues, then come back." />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Studio"
          title="Venue Designer"
          actions={
            <Select value={venueId} onValueChange={(v) => navigate({ search: { venue: v, template: undefined } })}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          }
        />
        <EmptyState icon={LayoutTemplate} title="No layout templates for this venue" description="Create a template from the Venue detail page, then design its booth layout here." />
      </div>
    );
  }

  const touchBtnCls = isTouch ? "min-h-11 min-w-11" : "";

  const propertyPanelBody = (
    <PropertyPanelBody
      selected={selected}
      updateSelected={updateSelected}
      refLayers={refLayers}
      updateRef={updateRef}
      deleteRef={deleteRef}
      mode={mode}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Studio"
        title="Venue Designer"
        description="Design once, reuse for every event. Same data across desktop, tablet, and phone."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "edit" | "field")} className="rounded-md border border-border/60 p-0.5">
              <ToggleGroupItem value="edit" className={cn("h-9 gap-1 px-3 text-xs", isTouch && "h-11")} aria-label="Edit mode">
                <PencilRuler className="h-3.5 w-3.5" /> Edit
              </ToggleGroupItem>
              <ToggleGroupItem value="field" className={cn("h-9 gap-1 px-3 text-xs", isTouch && "h-11")} aria-label="Field mode">
                <Eye className="h-3.5 w-3.5" /> Field
              </ToggleGroupItem>
            </ToggleGroup>
            <Select value={venueId} onValueChange={(v) => navigate({ search: { venue: v, template: undefined } })}>
              <SelectTrigger className={cn("w-40", isTouch && "h-11")}><SelectValue /></SelectTrigger>
              <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={templateId} onValueChange={(v) => navigate({ search: { ...search, template: v } })}>
              <SelectTrigger className={cn("w-52", isTouch && "h-11")}><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={saveAll} disabled={!dirty} className={touchBtnCls}>
              <Save className="mr-2 h-4 w-4" /> {dirty ? "Save" : "Saved"}
            </Button>
          </div>
        }
      />

      <div className={cn("grid gap-4", !isTouch && "lg:grid-cols-[1fr_320px]")}>
        {/* Canvas */}
        <div className="card-soft p-3">
          {/* Toolbar — wraps on all sizes, larger targets on touch */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {mode === "edit" && (
              <>
                <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={addBooth} className={touchBtnCls} aria-label="Add booth">
                  <Plus className="mr-1 h-4 w-4" /> Booth
                </Button>
                <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={duplicateSelected} disabled={!selected} className={touchBtnCls} aria-label="Duplicate selected">
                  <Copy className="mr-1 h-4 w-4" /> Duplicate
                </Button>
                <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={deleteSelected} disabled={!selected} className={touchBtnCls} aria-label="Delete selected">
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={undo} disabled={history.length === 0} className={touchBtnCls} aria-label="Undo">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={redo} disabled={future.length === 0} className={touchBtnCls} aria-label="Redo">
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
              </>
            )}
            <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className={touchBtnCls} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size={isTouch ? "default" : "sm"} variant="outline" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className={touchBtnCls} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            {mode === "edit" && (
              <div className="flex items-center gap-2 pl-2">
                <Grid3x3 className="h-4 w-4" />
                <Switch checked={snap} onCheckedChange={setSnap} aria-label="Snap to grid" />
                <span className="text-xs">Snap</span>
              </div>
            )}

            {/* Search booth — always visible */}
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search booth #"
                value={search_}
                onChange={(e) => setSearch_(e.target.value)}
                className={cn("w-40 pl-7", isTouch && "h-11")}
              />
              {search_ && filteredBooths.length > 0 && (
                <div className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                  {filteredBooths.slice(0, 20).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { focusBooth(b); setSearch_(""); }}
                      className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium">{b.code}</span>
                      <span className="truncate text-xs text-muted-foreground">{b.category ?? b.size_label ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode === "edit" && (
              <label className="text-xs">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReference(f); e.target.value = ""; }}
                  id="ref-upload"
                  disabled={uploadingRef}
                />
                <Button size={isTouch ? "default" : "sm"} variant="outline" asChild disabled={uploadingRef} className={touchBtnCls}>
                  <label htmlFor="ref-upload" className="cursor-pointer">
                    {uploadingRef ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Map className="mr-1 h-4 w-4" />}
                    Import map
                  </label>
                </Button>
              </label>
            )}

            {/* Touch property panel triggers */}
            {isTouch && (
              isPhone ? (
                <Drawer open={propOpen} onOpenChange={setPropOpen}>
                  <DrawerTrigger asChild>
                    <Button size="default" variant="secondary" className={touchBtnCls} aria-label="Open properties">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85vh]">
                    <DrawerHeader><DrawerTitle>{selected ? `Booth ${selected.code}` : "Properties"}</DrawerTitle></DrawerHeader>
                    <div className="overflow-auto px-4 pb-8">{propertyPanelBody}</div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Sheet open={propOpen} onOpenChange={setPropOpen}>
                  <SheetTrigger asChild>
                    <Button size="default" variant="secondary" className={touchBtnCls} aria-label="Open properties">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[360px] overflow-y-auto">
                    <SheetHeader><SheetTitle>{selected ? `Booth ${selected.code}` : "Properties"}</SheetTitle></SheetHeader>
                    <div className="mt-4">{propertyPanelBody}</div>
                  </SheetContent>
                </Sheet>
              )
            )}
          </div>

          <div
            ref={scrollRef}
            className="overflow-auto rounded-md border border-border/60 bg-muted/30"
            style={{ height: isPhone ? 420 : 560, touchAction: "none", overscrollBehavior: "contain" }}
          >
            <svg
              ref={svgRef}
              width={canvasW * zoom}
              height={canvasH * zoom}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              onPointerDown={canvasInput.onPointerDown}
              onPointerMove={canvasInput.onPointerMove}
              onPointerUp={canvasInput.onPointerUp}
              onPointerCancel={canvasInput.onPointerCancel}
              onWheel={canvasInput.onWheel}
              onClick={() => setSelectedId(null)}
              style={{ background: "white", touchAction: "none" }}
            >
              <defs>
                <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#grid)" />

              {refLayers.filter((r) => r.visible).map((r) => {
                const w = Number(r.natural_width) || 800;
                const h = Number(r.natural_height) || 600;
                return (
                  <g key={r.id} transform={`translate(${r.offset_x} ${r.offset_y}) rotate(${r.rotation}) scale(${r.scale})`} opacity={r.opacity} pointerEvents="none">
                    <image href={r.image_url} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
                  </g>
                );
              })}

              {activeBooths.map((b) => {
                const sel = b.id === selectedId;
                const fill = b.is_reserved ? "#fee2e2" : b.is_premium ? "#fef3c7" : "#dbeafe";
                const stroke = sel ? "#2563eb" : "#64748b";
                const handleR = isTouch ? 10 : 5;
                return (
                  <ContextMenu key={b.id}>
                    <ContextMenuTrigger asChild>
                      <g
                        transform={`translate(${b.x} ${b.y}) rotate(${b.rotation} ${b.width / 2} ${b.height / 2})`}
                        onPointerDown={(e) => onBoothPointerDown(e, b)}
                        onPointerMove={onBoothPointerMove}
                        onPointerUp={onBoothPointerUp}
                        onPointerCancel={onBoothPointerUp}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                        style={{ cursor: mode === "edit" ? "move" : "pointer", touchAction: "none" }}
                      >
                        <rect width={b.width} height={b.height} fill={fill} stroke={stroke} strokeWidth={sel ? 2 : 1} rx={4} />
                        <text x={b.width / 2} y={b.height / 2} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#1e293b" fontWeight={600}>
                          {b.code}
                        </text>
                        {b.is_electric && <circle cx={b.width - 8} cy={8} r={4} fill="#f59e0b" />}
                        {sel && mode === "edit" && (
                          <>
                            {/* Larger touch-friendly resize/rotation indicators */}
                            <circle cx={b.width} cy={b.height} r={handleR} fill="#2563eb" opacity={0.85} />
                            <circle cx={b.width / 2} cy={-16} r={handleR} fill="#0ea5e9" opacity={0.85} />
                          </>
                        )}
                      </g>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="min-w-[180px]">
                      <ContextMenuItem onSelect={() => setSelectedId(b.id)}>Select</ContextMenuItem>
                      <ContextMenuItem onSelect={() => focusBooth(b)}>Zoom to booth</ContextMenuItem>
                      {mode === "edit" && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => duplicateBooth(b)}>Duplicate</ContextMenuItem>
                          <ContextMenuItem onSelect={() => toggleBoothField(b, "is_electric")}>Toggle electric</ContextMenuItem>
                          <ContextMenuItem onSelect={() => toggleBoothField(b, "is_premium")}>Toggle premium</ContextMenuItem>
                          <ContextMenuItem onSelect={() => toggleBoothField(b, "is_reserved")}>Toggle reserved</ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => deleteBooth(b)} className="text-destructive">Delete</ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </svg>
          </div>

          {mode === "field" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Field Mode · tap a booth to view, drag with two fingers to pan, pinch to zoom. Switch to Edit Mode to modify the layout.
            </p>
          )}
          {mode === "edit" && isTouch && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tap a booth to select · drag with one finger to move · two fingers to pan / pinch to zoom · long-press for menu.
            </p>
          )}
        </div>

        {/* Desktop docked panel */}
        {!isTouch && (
          <div className="space-y-3">{propertyPanelBody}</div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading layout…</p>}

      <PdfPagePicker
        file={pendingPdf}
        open={!!pendingPdf}
        onClose={() => setPendingPdf(null)}
        onPick={handlePdfPageChosen}
      />
    </div>
  );
}

type RefLayer = {
  id: string;
  original_filename: string | null;
  source_mime_type: string | null;
  source_page: number | null;
  source_file_url: string | null;
  natural_width: number | null;
  natural_height: number | null;
  visible: boolean;
  locked: boolean;
  opacity: number;
  scale: number;
  rotation: number;
};

function PropertyPanelBody({
  selected, updateSelected, refLayers, updateRef, deleteRef, mode,
}: {
  selected: Booth | null;
  updateSelected: (patch: Partial<Booth>) => void;
  refLayers: RefLayer[];
  updateRef: (id: string, patch: Partial<RefLayer>) => void;
  deleteRef: (id: string) => void;
  mode: "edit" | "field";
}) {
  return (
    <div className="space-y-3">
      {selected ? (
        <div className="card-soft space-y-3 p-4">
          <p className="font-display text-sm font-semibold">Booth {selected.code}</p>
          <FieldRow label="Booth #"><Input value={selected.code} onChange={(e) => updateSelected({ code: e.target.value })} /></FieldRow>
          <FieldRow label="Size"><Input placeholder="10x10" value={selected.size_label ?? ""} onChange={(e) => updateSelected({ size_label: e.target.value })} /></FieldRow>
          <FieldRow label="Price ($)"><Input type="number" inputMode="decimal" value={selected.price ?? ""} onChange={(e) => updateSelected({ price: e.target.value === "" ? null : Number(e.target.value) })} /></FieldRow>
          <FieldRow label="Category"><Input value={selected.category ?? ""} onChange={(e) => updateSelected({ category: e.target.value })} placeholder="Food, Craft, Service…" /></FieldRow>
          {mode === "edit" && (
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Width"><Input type="number" inputMode="numeric" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></FieldRow>
              <FieldRow label="Height"><Input type="number" inputMode="numeric" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></FieldRow>
              <FieldRow label="Rotation"><Input type="number" inputMode="numeric" value={selected.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /></FieldRow>
            </div>
          )}
          <div className="space-y-2">
            <Toggle label="Electric" checked={selected.is_electric} onChange={(v) => updateSelected({ is_electric: v })} />
            <Toggle label="Premium" checked={selected.is_premium} onChange={(v) => updateSelected({ is_premium: v })} />
            <Toggle label="Reserved" checked={selected.is_reserved} onChange={(v) => updateSelected({ is_reserved: v })} />
          </div>
          <FieldRow label="Notes"><Input value={selected.notes ?? ""} onChange={(e) => updateSelected({ notes: e.target.value })} placeholder="Anything crew should know" /></FieldRow>
        </div>
      ) : (
        <div className="card-soft p-4 text-sm text-muted-foreground">
          {mode === "edit"
            ? <>Select a booth to edit, or tap <strong>Booth</strong> in the toolbar to add one.</>
            : "Select a booth to view its details."}
        </div>
      )}

      {mode === "edit" && (
        <div className="card-soft space-y-3 p-4">
          <p className="font-display text-sm font-semibold">Reference layer</p>
          {refLayers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Import a sketch, PDF, or blueprint to trace over.</p>
          ) : refLayers.map((r) => {
            const isPdf = r.source_mime_type === "application/pdf";
            return (
              <div key={r.id} className="space-y-2 rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {isPdf ? <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="truncate text-xs font-medium">{r.original_filename ?? "Reference"}</span>
                    {isPdf && r.source_page && <Badge variant="outline" className="shrink-0 text-[10px]">p{r.source_page}</Badge>}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {r.source_file_url && (
                      <Button size="icon" variant="ghost" asChild aria-label="Download original">
                        <a href={r.source_file_url} target="_blank" rel="noreferrer"><Download className="h-3 w-3" /></a>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => deleteRef(r.id)} aria-label="Delete layer"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {r.natural_width && r.natural_height && (
                  <p className="text-[10px] text-muted-foreground">{r.natural_width} × {r.natural_height}px</p>
                )}
                <label className="flex items-center justify-between text-xs">Visible <Switch checked={r.visible} onCheckedChange={(v) => updateRef(r.id, { visible: v })} /></label>
                <label className="flex items-center justify-between text-xs">Locked <Switch checked={r.locked} onCheckedChange={(v) => updateRef(r.id, { locked: v })} /></label>
                <div><Label className="text-xs">Opacity</Label><Slider value={[Number(r.opacity) * 100]} max={100} step={5} onValueChange={([v]) => updateRef(r.id, { opacity: v / 100 })} /></div>
                <div><Label className="text-xs">Scale</Label><Slider value={[Number(r.scale) * 100]} min={10} max={300} step={5} onValueChange={([v]) => updateRef(r.id, { scale: v / 100 })} /></div>
                <div><Label className="text-xs">Rotation</Label><Slider value={[Number(r.rotation)]} min={-180} max={180} step={5} onValueChange={([v]) => updateRef(r.id, { rotation: v })} /></div>
              </div>
            );
          })}
        </div>
      )}
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
