import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MousePointer2, Hand, Square, Circle as CircleIcon, Type as TypeIcon,
  Layers, Library, LayoutTemplate, Search, ChevronLeft, Ruler, Grid3x3, Magnet,
  Eye, EyeOff, Lock, Unlock, Trash2, Plus, Store, Image as ImageIcon, Sparkles, Upload, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getVenueDesign, createVenueObject, updateVenueObject, deleteVenueObject,
  createVenueLayer, updateVenueLayer, deleteVenueLayer,
  createVenueReference, updateVenueReference, deleteVenueReference, analyzeVenueDrawing,
  listVenueTemplates, publishVenueTemplate, restoreVenueTemplate, deleteVenueTemplate,
} from "@/lib/venue-designer.functions";
import { useCanvasInput, type CanvasCoords } from "@/components/booth-builder/use-canvas-input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({ meta: [{ title: "Venue Designer · EventScape Studio" }] }),
  component: VenueDesignerPage,
});

// ---------- Object palette definition ----------

type ObjectTypeDef = {
  type: string;
  shape: "rect" | "circle" | "text";
  label: string;
  defaultLayerKind: string;
  size: { w: number; h: number };
  fill: string;
  stroke: string;
};

const OBJECT_LIBRARY: Array<{ group: string; items: ObjectTypeDef[] }> = [
  { group: "Vendor", items: [
    { type: "booth", shape: "rect", label: "Booth", defaultLayerKind: "booths", size: { w: 10, h: 10 }, fill: "hsl(var(--primary) / 0.2)", stroke: "hsl(var(--primary))" },
    { type: "sponsor_banner", shape: "rect", label: "Sponsor", defaultLayerKind: "booths", size: { w: 12, h: 4 }, fill: "#fde68a", stroke: "#b45309" },
    { type: "food_court", shape: "rect", label: "Food Court", defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#fed7aa", stroke: "#c2410c" },
    { type: "beer_garden", shape: "rect", label: "Beer Garden", defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#fef3c7", stroke: "#a16207" },
  ]},
  { group: "Structures", items: [
    { type: "building", shape: "rect", label: "Building", defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#e5e7eb", stroke: "#4b5563" },
    { type: "stage", shape: "rect", label: "Stage", defaultLayerKind: "buildings", size: { w: 30, h: 20 }, fill: "#c7d2fe", stroke: "#4338ca" },
    { type: "pavilion", shape: "rect", label: "Pavilion", defaultLayerKind: "buildings", size: { w: 30, h: 20 }, fill: "#ddd6fe", stroke: "#6d28d9" },
    { type: "restroom", shape: "rect", label: "Restroom", defaultLayerKind: "buildings", size: { w: 15, h: 12 }, fill: "#e0f2fe", stroke: "#0369a1" },
    { type: "ticket", shape: "rect", label: "Ticket Booth", defaultLayerKind: "buildings", size: { w: 10, h: 8 }, fill: "#fee2e2", stroke: "#b91c1c" },
    { type: "info", shape: "rect", label: "Info", defaultLayerKind: "buildings", size: { w: 10, h: 8 }, fill: "#dbeafe", stroke: "#1d4ed8" },
    { type: "first_aid", shape: "rect", label: "First Aid", defaultLayerKind: "buildings", size: { w: 10, h: 8 }, fill: "#fecaca", stroke: "#dc2626" },
    { type: "atm", shape: "rect", label: "ATM", defaultLayerKind: "buildings", size: { w: 6, h: 6 }, fill: "#d1fae5", stroke: "#047857" },
  ]},
  { group: "Circulation", items: [
    { type: "road", shape: "rect", label: "Road", defaultLayerKind: "roads", size: { w: 60, h: 12 }, fill: "#d1d5db", stroke: "#6b7280" },
    { type: "walkway", shape: "rect", label: "Walkway", defaultLayerKind: "roads", size: { w: 40, h: 6 }, fill: "#e5e7eb", stroke: "#9ca3af" },
    { type: "parking", shape: "rect", label: "Parking", defaultLayerKind: "roads", size: { w: 60, h: 40 }, fill: "#f3f4f6", stroke: "#6b7280" },
    { type: "fence", shape: "rect", label: "Fence", defaultLayerKind: "roads", size: { w: 40, h: 1 }, fill: "#78350f", stroke: "#78350f" },
  ]},
  { group: "Utilities", items: [
    { type: "utility", shape: "rect", label: "Utility", defaultLayerKind: "utilities", size: { w: 6, h: 6 }, fill: "#fde68a", stroke: "#a16207" },
    { type: "trash", shape: "circle", label: "Trash", defaultLayerKind: "utilities", size: { w: 4, h: 4 }, fill: "#4b5563", stroke: "#1f2937" },
    { type: "sign", shape: "rect", label: "Sign", defaultLayerKind: "labels", size: { w: 6, h: 3 }, fill: "#f9fafb", stroke: "#374151" },
  ]},
  { group: "Amenities", items: [
    { type: "table", shape: "rect", label: "Table", defaultLayerKind: "custom", size: { w: 6, h: 3 }, fill: "#fef3c7", stroke: "#a16207" },
    { type: "bench", shape: "rect", label: "Bench", defaultLayerKind: "custom", size: { w: 6, h: 2 }, fill: "#e7e5e4", stroke: "#78716c" },
    { type: "tree", shape: "circle", label: "Tree", defaultLayerKind: "custom", size: { w: 8, h: 8 }, fill: "#86efac", stroke: "#166534" },
    { type: "kids_area", shape: "rect", label: "Kids Area", defaultLayerKind: "custom", size: { w: 30, h: 20 }, fill: "#fbcfe8", stroke: "#be185d" },
    { type: "petting_zoo", shape: "rect", label: "Petting Zoo", defaultLayerKind: "custom", size: { w: 30, h: 20 }, fill: "#fed7aa", stroke: "#9a3412" },
  ]},
];

const DEF_BY_TYPE: Record<string, ObjectTypeDef> = Object.fromEntries(
  OBJECT_LIBRARY.flatMap((g) => g.items.map((i) => [i.type, i]))
);

type Tool = "select" | "pan" | "place" | "rect" | "circle" | "text";

// ---------- Component ----------

function VenueDesignerPage() {
  const { venueId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDesign = useServerFn(getVenueDesign);
  const createObj = useServerFn(createVenueObject);
  const updateObj = useServerFn(updateVenueObject);
  const deleteObj = useServerFn(deleteVenueObject);
  const createLayer = useServerFn(createVenueLayer);
  const updateLayer = useServerFn(updateVenueLayer);
  const deleteLayer = useServerFn(deleteVenueLayer);
  const createRef = useServerFn(createVenueReference);
  const updateRef = useServerFn(updateVenueReference);
  const deleteRef = useServerFn(deleteVenueReference);
  const analyzeDrawing = useServerFn(analyzeVenueDrawing);

  const queryKey = ["venue-design", venueId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDesign({ data: { venueId } }),
  });

  const [tool, setTool] = useState<Tool>("select");
  const [placingType, setPlacingType] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [cursor, setCursor] = useState<CanvasCoords>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingRefId, setAnalyzingRefId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; mode: "move" | "resize"; handle?: string } | null>(null);

  const layers: any[] = (data?.layers as any[] | undefined) ?? [];
  const objects: any[] = (data?.objects as any[] | undefined) ?? [];
  const references: any[] = ((data as any)?.references as any[] | undefined) ?? [];
  const layerById = useMemo(() => Object.fromEntries(layers.map((l: any) => [l.id, l])), [layers]);
  const selected = objects.find((o: any) => o.id === selectedId) ?? null;
  const selectedRef = references.find((r: any) => r.id === selectedRefId) ?? null;

  const onPan = useCallback((dx: number, dy: number) => {
    if (dragRef.current) return;
    setView((v) => ({ ...v, x: v.x - dx / v.zoom, y: v.y - dy / v.zoom }));
  }, []);
  const onZoom = useCallback((factor: number) => {
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.1, v.zoom * factor)) }));
  }, []);
  const input = useCanvasInput({ onPan, onZoom: (f, focal) => {
    setView((v) => {
      const nz = Math.min(8, Math.max(0.1, v.zoom * f));
      const k = nz / v.zoom;
      return { zoom: nz, x: focal.x - (focal.x - v.x) * k, y: focal.y - (focal.y - v.y) * k };
    });
  }});

  const width = data?.venue?.canvas_width ?? 2000;
  const height = data?.venue?.canvas_height ?? 1500;
  const units = data?.venue?.units ?? "feet";

  const svgToCanvas = useCallback((clientX: number, clientY: number): CanvasCoords => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: (p.x + view.x * view.zoom) / view.zoom, y: (p.y + view.y * view.zoom) / view.zoom };
  }, [view]);

  const snapVal = useCallback((v: number) => (snap ? Math.round(v) : v), [snap]);

  // ------ Mutations with optimistic cache update ------
  const patchCache = useCallback((fn: (d: any) => any) => {
    qc.setQueryData(queryKey, (prev: any) => (prev ? fn(prev) : prev));
  }, [qc, queryKey]);

  const placeMutation = useMutation({
    mutationFn: (input: any) => createObj({ data: input }),
    onSuccess: (obj: any) => {
      patchCache((d) => ({ ...d, objects: [...d.objects, obj] }));
      setSelectedId(obj.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not place object"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => updateObj({ data: { id, patch } }),
    onMutate: async ({ id, patch }) => {
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === id ? { ...o, ...patch } : o) }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteObj({ data: { id } }),
    onSuccess: (_r, id) => {
      patchCache((d) => ({ ...d, objects: d.objects.filter((o: any) => o.id !== id) }));
      if (selectedId === id) setSelectedId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const layerCreateMutation = useMutation({
    mutationFn: (input: any) => createLayer({ data: input }),
    onSuccess: (layer: any) => patchCache((d) => ({ ...d, layers: [...d.layers, layer] })),
  });
  const layerUpdateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => updateLayer({ data: { id, patch } }),
    onMutate: ({ id, patch }) => patchCache((d) => ({ ...d, layers: d.layers.map((l: any) => l.id === id ? { ...l, ...patch } : l) })),
  });
  const layerDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteLayer({ data: { id } }),
    onSuccess: (_r, id) => patchCache((d) => ({ ...d, layers: d.layers.filter((l: any) => l.id !== id) })),
    onError: (e: any) => toast.error(e?.message ?? "Delete failed (layer may have objects)"),
  });

  // ------ Reference mutations ------
  const refCreateMutation = useMutation({
    mutationFn: (input: any) => createRef({ data: input }),
    onSuccess: (ref: any) => {
      patchCache((d) => ({ ...d, references: [...(d.references ?? []), ref] }));
      setSelectedRefId(ref.id);
      toast.success("Reference uploaded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload failed"),
  });
  const refUpdateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => updateRef({ data: { id, patch } }),
    onMutate: ({ id, patch }) => patchCache((d) => ({ ...d, references: (d.references ?? []).map((r: any) => r.id === id ? { ...r, ...patch } : r) })),
  });
  const refDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteRef({ data: { id } }),
    onSuccess: (_r, id) => {
      patchCache((d) => ({ ...d, references: (d.references ?? []).filter((r: any) => r.id !== id) }));
      if (selectedRefId === id) setSelectedRefId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  // ------ Upload handler ------
  const handleFileUpload = async (file: File) => {
    if (!data?.venue) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (PDF import arrives in a later phase).");
      return;
    }
    setUploading(true);
    try {
      const orgId = (data.venue as any).organization_id;
      const ext = file.name.split(".").pop() || "png";
      const path = `${orgId}/venues/${venueId}/refs/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("venue-assets").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      // Read intrinsic size to set an initial transform
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      const canvasW = (data.venue as any).canvas_width ?? 2000;
      const canvasH = (data.venue as any).canvas_height ?? 1500;
      // Fit the image inside the canvas while preserving aspect ratio
      const scale = Math.min(canvasW / dims.w, canvasH / dims.h) * 0.9;
      const width = dims.w * scale;
      const height = dims.h * scale;
      const transform = {
        x: (canvasW - width) / 2,
        y: (canvasH - height) / 2,
        width, height, rotation: 0,
      };
      await refCreateMutation.mutateAsync({
        venueId, file_url: path, mime_type: file.type, label: file.name,
        transform, opacity: 0.5,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAiImport = async (referenceId: string) => {
    setAnalyzingRefId(referenceId);
    try {
      const r: any = await analyzeDrawing({ data: { venueId, referenceId } });
      toast.success(`AI detected ${r.count} object${r.count === 1 ? "" : "s"}`);
      // Refetch to load new layer + objects
      qc.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "AI import failed");
    } finally {
      setAnalyzingRefId(null);
    }
  };


  // ------ Keyboard shortcuts ------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteMutation.mutate(selectedId);
      }
      if (e.key === "Escape") { setSelectedId(null); setPlacingType(null); setTool("select"); }
      if (e.key === "v") setTool("select");
      if (e.key === "h") setTool("pan");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteMutation]);

  // ------ Canvas click handling ------
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== "place" || !placingType) return;
    const def = DEF_BY_TYPE[placingType];
    if (!def) return;
    const p = svgToCanvas(e.clientX, e.clientY);
    const targetLayer = layers.find((l: any) => l.kind === def.defaultLayerKind) ?? layers[0];
    const g = { x: snapVal(p.x - def.size.w / 2), y: snapVal(p.y - def.size.h / 2), w: def.size.w, h: def.size.h, rotation: 0 };
    const nextBoothName = def.type === "booth"
      ? `B${(objects.filter((o: any) => o.type === "booth").length + 1).toString().padStart(3, "0")}`
      : undefined;
    placeMutation.mutate({
      venueId,
      layer_id: targetLayer?.id ?? null,
      type: def.type,
      shape: def.shape,
      name: nextBoothName ?? def.label,
      geometry: g,
      style: { fill: def.fill, stroke: def.stroke },
      metadata: def.type === "booth" ? { price: 0, size: `${def.size.w}x${def.size.h}`, electric: false, water: false, premium: false, corner: false } : {},
    });
    if (!e.shiftKey) { setTool("select"); setPlacingType(null); }
  };

  // ------ Object drag ------
  const handleObjectPointerDown = (e: React.PointerEvent, obj: any) => {
    if (tool !== "select") return;
    if (obj.locked) return;
    const layer = layerById[obj.layer_id];
    if (layer?.locked) return;
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    setSelectedId(obj.id);
    const start = svgToCanvas(e.clientX, e.clientY);
    dragRef.current = { id: obj.id, startX: start.x, startY: start.y, origX: obj.geometry?.x ?? 0, origY: obj.geometry?.y ?? 0, mode: "move" };
  };
  const handleResizePointerDown = (e: React.PointerEvent, obj: any, handle: string) => {
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    const start = svgToCanvas(e.clientX, e.clientY);
    dragRef.current = { id: obj.id, startX: start.x, startY: start.y, origX: obj.geometry?.x ?? 0, origY: obj.geometry?.y ?? 0, mode: "resize", handle };
  };

  const handleGlobalPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    input.onPointerMove(e);
    if (svgRef.current) {
      const p = svgToCanvas(e.clientX, e.clientY);
      setCursor(p);
    }
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgToCanvas(e.clientX, e.clientY);
    const obj = objects.find((o: any) => o.id === drag.id);
    if (!obj) return;
    if (drag.mode === "move") {
      const nx = snapVal(drag.origX + (p.x - drag.startX));
      const ny = snapVal(drag.origY + (p.y - drag.startY));
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === drag.id ? { ...o, geometry: { ...o.geometry, x: nx, y: ny } } : o) }));
    } else if (drag.mode === "resize") {
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      const g = obj.geometry ?? {};
      const orig = { x: drag.origX, y: drag.origY, w: g.w, h: g.h };
      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;
      const h = drag.handle!;
      if (h.includes("e")) nw = Math.max(1, snapVal(orig.w + dx));
      if (h.includes("s")) nh = Math.max(1, snapVal(orig.h + dy));
      if (h.includes("w")) { nw = Math.max(1, snapVal(orig.w - dx)); nx = snapVal(orig.x + (orig.w - nw)); }
      if (h.includes("n")) { nh = Math.max(1, snapVal(orig.h - dy)); ny = snapVal(orig.y + (orig.h - nh)); }
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === drag.id ? { ...o, geometry: { ...o.geometry, x: nx, y: ny, w: nw, h: nh } } : o) }));
    }
  };
  const handleGlobalPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    input.onPointerUp(e);
    const drag = dragRef.current;
    if (drag) {
      const obj = objects.find((o: any) => o.id === drag.id);
      if (obj) updateMutation.mutate({ id: drag.id, patch: { geometry: obj.geometry } });
      dragRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 top-16 flex flex-col bg-background">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/studio/venues"><ChevronLeft className="mr-1 h-4 w-4" />Venues</Link>
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <div className="text-sm font-medium truncate max-w-[240px]">
          {isLoading ? <Skeleton className="h-4 w-40" /> : (data?.venue?.name ?? "Venue")}
        </div>
        <div className="mx-2 h-6 w-px bg-border" />
        <ToolButton icon={MousePointer2} label="Select (V)" active={tool === "select"} onClick={() => { setTool("select"); setPlacingType(null); }} />
        <ToolButton icon={Hand} label="Pan (H)" active={tool === "pan"} onClick={() => { setTool("pan"); setPlacingType(null); }} />
        <div className="mx-1 h-6 w-px bg-border" />
        <ToolButton icon={Store} label="Booth" active={placingType === "booth"} onClick={() => { setPlacingType("booth"); setTool("place"); }} />
        <ToolButton icon={Square} label="Rectangle" active={placingType === "building"} onClick={() => { setPlacingType("building"); setTool("place"); }} />
        <ToolButton icon={CircleIcon} label="Tree" active={placingType === "tree"} onClick={() => { setPlacingType("tree"); setTool("place"); }} />
        <ToolButton icon={TypeIcon} label="Sign" active={placingType === "sign"} onClick={() => { setPlacingType("sign"); setTool("place"); }} />
        <div className="mx-1 h-6 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-8 gap-1 px-2" title="Upload reference image">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          <span className="hidden text-xs md:inline">Import</span>
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {tool === "place" ? <>Click to place · Shift for multi · Esc to cancel</> : <>Phase 3 · references + AI import</>}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r bg-card">
          <Tabs defaultValue="objects" className="flex h-full flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="objects" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Library className="mr-1 h-3.5 w-3.5" />Objects
              </TabsTrigger>
              <TabsTrigger value="layers" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Layers className="mr-1 h-3.5 w-3.5" />Layers
              </TabsTrigger>
              <TabsTrigger value="references" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <ImageIcon className="mr-1 h-3.5 w-3.5" />Refs
              </TabsTrigger>
              <TabsTrigger value="templates" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <LayoutTemplate className="mr-1 h-3.5 w-3.5" />Versions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="objects" className="mt-0 flex-1 overflow-auto p-3">
              <ObjectPalette
                activeType={placingType}
                onPick={(t) => { setPlacingType(t); setTool("place"); }}
              />
            </TabsContent>
            <TabsContent value="layers" className="mt-0 flex-1 overflow-auto p-3">
              <LayerPanel
                layers={layers}
                onToggleVisible={(l) => layerUpdateMutation.mutate({ id: l.id, patch: { visible: !l.visible } })}
                onToggleLocked={(l) => layerUpdateMutation.mutate({ id: l.id, patch: { locked: !l.locked } })}
                onRename={(l, name) => layerUpdateMutation.mutate({ id: l.id, patch: { name } })}
                onDelete={(l) => layerDeleteMutation.mutate(l.id)}
                onAdd={() => {
                  const name = window.prompt("Layer name", "New Layer");
                  if (!name) return;
                  layerCreateMutation.mutate({ venueId, name, kind: "custom", order_index: layers.length });
                }}
              />
            </TabsContent>
            <TabsContent value="references" className="mt-0 flex-1 overflow-auto p-3">
              <ReferencePanel
                references={references}
                uploading={uploading}
                analyzingRefId={analyzingRefId}
                onUploadClick={() => fileInputRef.current?.click()}
                onSelect={(r) => { setSelectedRefId(r.id); setSelectedId(null); }}
                onToggleVisible={(r) => refUpdateMutation.mutate({ id: r.id, patch: { visible: !r.visible } })}
                onDelete={(r) => refDeleteMutation.mutate(r.id)}
                onAiImport={handleAiImport}
                selectedRefId={selectedRefId}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = "";
                }}
              />
            </TabsContent>
            <TabsContent value="templates" className="mt-0 flex-1 overflow-auto p-3">
              <EmptyState icon={LayoutTemplate} title="No published versions" description="Publish templates arrives in Phase 4 alongside event snapshots." />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden bg-muted/30">
          <svg
            ref={svgRef}
            className="h-full w-full touch-none"
            style={{ cursor: tool === "pan" ? "grab" : tool === "place" ? "crosshair" : "default" }}
            onPointerDown={(e) => {
              if (tool === "select") setSelectedId(null);
              input.onPointerDown(e);
            }}
            onPointerMove={handleGlobalPointerMove}
            onPointerUp={handleGlobalPointerUp}
            onPointerCancel={handleGlobalPointerUp}
            onWheel={input.onWheel}
            onClick={handleCanvasClick}
          >
            <defs>
              <pattern id="grid-sm" width={20} height={20} patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} />
              </pattern>
              <pattern id="grid-lg" width={100} height={100} patternUnits="userSpaceOnUse">
                <rect width={100} height={100} fill="url(#grid-sm)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="hsl(var(--border))" strokeWidth={1} />
              </pattern>
            </defs>
            <g transform={`translate(${-view.x * view.zoom}, ${-view.y * view.zoom}) scale(${view.zoom})`}>
              <rect x={0} y={0} width={width} height={height} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={2 / view.zoom} />
              {showGrid && <rect x={0} y={0} width={width} height={height} fill="url(#grid-lg)" opacity={0.5} />}

              {/* References (rendered below objects) */}
              {references.map((r: any) => {
                if (!r.visible) return null;
                if (!r.signed_url) return null;
                const t = r.transform ?? {};
                const cx = (t.x ?? 0) + (t.width ?? 0) / 2;
                const cy = (t.y ?? 0) + (t.height ?? 0) / 2;
                const rot = t.rotation ?? 0;
                const isSel = selectedRefId === r.id;
                return (
                  <g key={r.id} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
                    <image
                      href={r.signed_url}
                      x={t.x ?? 0} y={t.y ?? 0}
                      width={t.width ?? 100} height={t.height ?? 100}
                      opacity={r.opacity ?? 0.5}
                      preserveAspectRatio="none"
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedRefId(r.id); setSelectedId(null); }}
                      style={{ cursor: "pointer" }}
                    />
                    {isSel && (
                      <rect
                        x={t.x ?? 0} y={t.y ?? 0}
                        width={t.width ?? 100} height={t.height ?? 100}
                        fill="none" stroke="hsl(var(--primary))" strokeWidth={2 / view.zoom}
                        strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}


              {objects.map((o: any) => {
                const layer = layerById[o.layer_id];
                if (layer && !layer.visible) return null;
                if (o.hidden) return null;
                return (
                  <ObjectShape
                    key={o.id}
                    obj={o}
                    layerOpacity={layer?.opacity ?? 1}
                    selected={selectedId === o.id}
                    zoom={view.zoom}
                    onPointerDown={(e) => handleObjectPointerDown(e, o)}
                    onResizePointerDown={(e, h) => handleResizePointerDown(e, o, h)}
                  />
                );
              })}
            </g>
          </svg>

          {!isLoading && objects.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto max-w-md rounded-lg border bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                <div className="mb-2 text-lg font-semibold">Start building your venue</div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Pick an object from the left palette, then click the canvas to place it. Drag to move, use the handles to resize.
                </p>
                <p className="text-xs text-muted-foreground">Pinch / Ctrl+scroll to zoom · V select · H pan · Del remove</p>
              </div>
            </div>
          )}
        </div>

        {/* Right inspector */}
        <aside className="w-80 shrink-0 border-l bg-card overflow-auto">
          {selected ? (
            <Inspector
              key={selected.id}
              object={selected}
              layers={layers}
              onPatch={(patch) => updateMutation.mutate({ id: selected.id, patch })}
              onCommitPatch={(patch) => updateMutation.mutate({ id: selected.id, patch })}
              onDelete={() => deleteMutation.mutate(selected.id)}
            />
          ) : selectedRef ? (
            <ReferenceInspector
              key={selectedRef.id}
              reference={selectedRef}
              onPatch={(patch) => refUpdateMutation.mutate({ id: selectedRef.id, patch })}
              onDelete={() => refDeleteMutation.mutate(selectedRef.id)}
              onAiImport={() => handleAiImport(selectedRef.id)}
              analyzing={analyzingRefId === selectedRef.id}
            />
          ) : (
            <div className="p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</div>
              <p className="text-sm text-muted-foreground">Select an object or reference to edit its properties.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center gap-4 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <button className={cn("flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted", showGrid && "text-foreground")} onClick={() => setShowGrid((v) => !v)}>
          <Grid3x3 className="h-3.5 w-3.5" /> Grid
        </button>
        <button className={cn("flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted", snap && "text-foreground")} onClick={() => setSnap((v) => !v)}>
          <Magnet className="h-3.5 w-3.5" /> Snap
        </button>
        <div className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{units}</div>
        <div className="ml-auto flex items-center gap-4">
          <span>x {Math.round(cursor.x)}, y {Math.round(cursor.y)}</span>
          <span>{objects.length} object{objects.length === 1 ? "" : "s"}</span>
          <span>{Math.round(view.zoom * 100)}%</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onZoom(1 / 1.2)}>−</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>Reset</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onZoom(1.2)}>+</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

function ToolButton({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick} title={label} className="h-8 px-2">
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function ObjectPalette({ activeType, onPick }: { activeType: string | null; onPick: (type: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = OBJECT_LIBRARY.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase())),
  })).filter((g) => g.items.length > 0);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library..." className="h-8 pl-7 text-xs" />
      </div>
      {filtered.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.items.map((it) => (
              <button
                key={it.type}
                onClick={() => onPick(it.type)}
                className={cn(
                  "rounded border bg-background px-2 py-2.5 text-left text-xs transition hover:border-primary hover:bg-primary/5",
                  activeType === it.type && "border-primary bg-primary/10"
                )}
              >
                <div className="mb-1 h-4 w-full rounded" style={{ background: it.fill, border: `1px solid ${it.stroke}` }} />
                {it.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LayerPanel({ layers, onToggleVisible, onToggleLocked, onRename, onDelete, onAdd }: {
  layers: any[];
  onToggleVisible: (l: any) => void;
  onToggleLocked: (l: any) => void;
  onRename: (l: any, name: string) => void;
  onDelete: (l: any) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="w-full" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add layer
      </Button>
      {[...layers].sort((a, b) => (b.order_index ?? 0) - (a.order_index ?? 0)).map((l) => (
        <div key={l.id} className="flex items-center gap-1 rounded border bg-background px-2 py-1.5 text-sm">
          <button onClick={() => onToggleVisible(l)} className="text-muted-foreground hover:text-foreground" title="Toggle visibility">
            {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onToggleLocked(l)} className="text-muted-foreground hover:text-foreground" title="Toggle lock">
            {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
          <input
            defaultValue={l.name}
            onBlur={(e) => e.target.value !== l.name && onRename(l, e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={() => onDelete(l)} className="text-muted-foreground hover:text-destructive" title="Delete layer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ObjectShape({ obj, layerOpacity, selected, zoom, onPointerDown, onResizePointerDown }: {
  obj: any; layerOpacity: number; selected: boolean; zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, handle: string) => void;
}) {
  const g = obj.geometry ?? {};
  const s = obj.style ?? {};
  const x = g.x ?? 0, y = g.y ?? 0, w = g.w ?? 10, h = g.h ?? 10;
  const rot = g.rotation ?? 0;
  const fill = s.fill ?? "hsl(var(--primary) / 0.2)";
  const stroke = selected ? "hsl(var(--primary))" : (s.stroke ?? "hsl(var(--border))");
  const strokeW = selected ? 2 / zoom : 1 / zoom;
  const transform = rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined;

  const body = obj.shape === "circle" ? (
    <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeW} />
  ) : obj.shape === "text" ? (
    <text x={x} y={y + h / 2} fill={s.color ?? "hsl(var(--foreground))"} fontSize={h}>{obj.name}</text>
  ) : (
    <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeW} rx={obj.type === "tree" ? w / 2 : 0} />
  );

  const handles = ["nw","n","ne","e","se","s","sw","w"];
  const handleSize = 8 / zoom;

  return (
    <g opacity={layerOpacity} transform={transform} style={{ cursor: obj.locked ? "not-allowed" : "move" }}>
      <g onPointerDown={onPointerDown}>{body}</g>
      {obj.type === "booth" && obj.name ? (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, h) * 0.3} fill="hsl(var(--foreground))" pointerEvents="none">
          {obj.name}
        </text>
      ) : null}
      {selected && (
        <>
          {handles.map((hd) => {
            const hx = hd.includes("w") ? x : hd.includes("e") ? x + w : x + w / 2;
            const hy = hd.includes("n") ? y : hd.includes("s") ? y + h : y + h / 2;
            return (
              <rect
                key={hd}
                x={hx - handleSize / 2} y={hy - handleSize / 2}
                width={handleSize} height={handleSize}
                fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1 / zoom}
                style={{ cursor: `${hd}-resize` }}
                onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, hd); }}
              />
            );
          })}
        </>
      )}
    </g>
  );
}

function Inspector({ object, layers, onPatch, onCommitPatch, onDelete }: {
  object: any;
  layers: any[];
  onPatch: (patch: any) => void;
  onCommitPatch: (patch: any) => void;
  onDelete: () => void;
}) {
  const g = object.geometry ?? {};
  const m = object.metadata ?? {};
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</div>
        <div className="text-xs text-muted-foreground">{object.type} · {object.shape}</div>
      </div>

      <Field label="Name">
        <Input defaultValue={object.name ?? ""} onBlur={(e) => e.target.value !== object.name && onCommitPatch({ name: e.target.value })} className="h-8" />
      </Field>

      <Field label="Layer">
        <Select value={object.layer_id ?? undefined} onValueChange={(v) => onCommitPatch({ layer_id: v })}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Layer" /></SelectTrigger>
          <SelectContent>{layers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><NumInput value={g.x ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, x: v } })} /></Field>
        <Field label="Y"><NumInput value={g.y ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, y: v } })} /></Field>
        <Field label="Width"><NumInput value={g.w ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, w: v } })} /></Field>
        <Field label="Height"><NumInput value={g.h ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, h: v } })} /></Field>
        <Field label="Rotation°"><NumInput value={g.rotation ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, rotation: v } })} /></Field>
      </div>

      <div className="flex items-center justify-between rounded border p-2 text-sm">
        <Label className="text-xs">Locked</Label>
        <Switch checked={!!object.locked} onCheckedChange={(v) => onCommitPatch({ locked: v })} />
      </div>
      <div className="flex items-center justify-between rounded border p-2 text-sm">
        <Label className="text-xs">Hidden</Label>
        <Switch checked={!!object.hidden} onCheckedChange={(v) => onCommitPatch({ hidden: v })} />
      </div>

      {/* Type-specific metadata */}
      {object.type === "booth" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booth</div>
          <Field label="Price"><NumInput value={m.price ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, price: v } })} /></Field>
          <Field label="Category">
            <Input defaultValue={m.category ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, category: e.target.value } })} className="h-8" />
          </Field>
          <MetaSwitch label="Electric" value={!!m.electric} onChange={(v) => onCommitPatch({ metadata: { ...m, electric: v } })} />
          <MetaSwitch label="Water" value={!!m.water} onChange={(v) => onCommitPatch({ metadata: { ...m, water: v } })} />
          <MetaSwitch label="Premium" value={!!m.premium} onChange={(v) => onCommitPatch({ metadata: { ...m, premium: v } })} />
          <MetaSwitch label="Corner" value={!!m.corner} onChange={(v) => onCommitPatch({ metadata: { ...m, corner: v } })} />
          <MetaSwitch label="ADA" value={!!m.ada} onChange={(v) => onCommitPatch({ metadata: { ...m, ada: v } })} />
        </div>
      )}
      {object.type === "building" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Building</div>
          <Field label="Capacity"><NumInput value={m.capacity ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, capacity: v } })} /></Field>
          <MetaSwitch label="Indoor" value={!!m.indoor} onChange={(v) => onCommitPatch({ metadata: { ...m, indoor: v } })} />
          <MetaSwitch label="Electric" value={!!m.electric} onChange={(v) => onCommitPatch({ metadata: { ...m, electric: v } })} />
        </div>
      )}
      {object.type === "road" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Road</div>
          <MetaSwitch label="Emergency access" value={!!m.emergency} onChange={(v) => onCommitPatch({ metadata: { ...m, emergency: v } })} />
        </div>
      )}
      {object.type === "parking" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parking</div>
          <Field label="Capacity"><NumInput value={m.capacity ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, capacity: v } })} /></Field>
          <Field label="Kind">
            <Input defaultValue={m.kind ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, kind: e.target.value } })} className="h-8" />
          </Field>
        </div>
      )}
      {object.type === "tree" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tree</div>
          <Field label="Species">
            <Input defaultValue={m.species ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, species: e.target.value } })} className="h-8" />
          </Field>
          <MetaSwitch label="Protected" value={!!m.protected} onChange={(v) => onCommitPatch({ metadata: { ...m, protected: v } })} />
        </div>
      )}

      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete object
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function NumInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <Input
      type="number"
      className="h-8"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = parseFloat(v); if (!Number.isNaN(n) && n !== value) onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}
function MetaSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <Label className="text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

// ---------- Phase 3: References ----------

function ReferencePanel({ references, uploading, analyzingRefId, onUploadClick, onSelect, onToggleVisible, onDelete, onAiImport, selectedRefId }: {
  references: any[];
  uploading: boolean;
  analyzingRefId: string | null;
  onUploadClick: () => void;
  onSelect: (r: any) => void;
  onToggleVisible: (r: any) => void;
  onDelete: (r: any) => void;
  onAiImport: (id: string) => void;
  selectedRefId: string | null;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" className="w-full" onClick={onUploadClick} disabled={uploading}>
        {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : "Upload reference image"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Upload a site plan, sketch, aerial photo, or map screenshot. Then use AI Import to auto-trace objects. PDF import arrives in a later phase.
      </p>
      {references.length === 0 ? (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          No references yet.
        </div>
      ) : references.map((r) => (
        <div key={r.id} className={cn("rounded border bg-background p-2", selectedRefId === r.id && "border-primary ring-1 ring-primary/40")}>
          <div className="mb-1.5 flex items-center gap-1">
            <button onClick={() => onToggleVisible(r)} className="text-muted-foreground hover:text-foreground">
              {r.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => onSelect(r)} className="flex-1 truncate text-left text-xs font-medium hover:underline">
              {r.label ?? "Reference"}
            </button>
            <button onClick={() => onDelete(r)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {r.signed_url ? (
            <button
              onClick={() => onSelect(r)}
              className="mb-1.5 block h-20 w-full overflow-hidden rounded bg-muted"
              style={{ backgroundImage: `url(${r.signed_url})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
              aria-label="Select reference"
            />
          ) : null}
          <Button
            size="sm" variant="secondary" className="w-full h-7 text-xs"
            onClick={() => onAiImport(r.id)}
            disabled={analyzingRefId === r.id}
          >
            {analyzingRefId === r.id ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Analyzing...</>
            ) : (
              <><Sparkles className="mr-1 h-3.5 w-3.5" />AI Import objects</>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ReferenceInspector({ reference, onPatch, onDelete, onAiImport, analyzing }: {
  reference: any;
  onPatch: (patch: any) => void;
  onDelete: () => void;
  onAiImport: () => void;
  analyzing: boolean;
}) {
  const t = reference.transform ?? {};
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</div>
        <div className="truncate text-sm font-medium">{reference.label}</div>
      </div>

      <Field label="Opacity">
        <div className="flex items-center gap-2">
          <Slider
            value={[Math.round((reference.opacity ?? 0.5) * 100)]}
            onValueChange={(v) => onPatch({ opacity: v[0] / 100 })}
            max={100} step={5}
          />
          <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((reference.opacity ?? 0.5) * 100)}%</span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><NumInput value={t.x ?? 0} onCommit={(v) => onPatch({ transform: { ...t, x: v } })} /></Field>
        <Field label="Y"><NumInput value={t.y ?? 0} onCommit={(v) => onPatch({ transform: { ...t, y: v } })} /></Field>
        <Field label="Width"><NumInput value={t.width ?? 0} onCommit={(v) => onPatch({ transform: { ...t, width: v } })} /></Field>
        <Field label="Height"><NumInput value={t.height ?? 0} onCommit={(v) => onPatch({ transform: { ...t, height: v } })} /></Field>
        <Field label="Rotation°"><NumInput value={t.rotation ?? 0} onCommit={(v) => onPatch({ transform: { ...t, rotation: v } })} /></Field>
      </div>

      <Button className="w-full" onClick={onAiImport} disabled={analyzing}>
        {analyzing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing drawing...</>) : (<><Sparkles className="mr-2 h-4 w-4" />AI Import objects</>)}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        AI reads this drawing and drops detected booths, buildings, roads, and other objects onto an "AI Import" layer. Review and adjust before publishing.
      </p>

      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete reference
      </Button>
    </div>
  );
}

