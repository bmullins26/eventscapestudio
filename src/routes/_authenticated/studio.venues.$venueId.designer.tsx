import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PanelLeft, PanelRight, Grid3x3, Magnet, Ruler as RulerIcon, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getVenueDesign, createVenueObject, updateVenueObject, deleteVenueObject,
  createVenueLayer, updateVenueLayer, deleteVenueLayer,
  createVenueReference, updateVenueReference, deleteVenueReference, analyzeVenueDrawing,
  listVenueTemplates, publishVenueTemplate, restoreVenueTemplate, deleteVenueTemplate,
  listOrgLibrary, saveObjectToLibrary, deleteOrgLibraryItem,
} from "@/lib/venue-designer.functions";
import { useCanvasInput, type CanvasCoords } from "@/components/booth-builder/use-canvas-input";
import { cn } from "@/lib/utils";
import { MenuBar } from "@/components/venue-designer/menu-bar";
import { ToolStrip } from "@/components/venue-designer/tool-strip";
import { BottomDrawer, type DrawerTab } from "@/components/venue-designer/bottom-drawer";
import {
  ObjectLibrary, Inspector, VenueInspector, LayerPanel, ObjectsListPanel,
  ReferencePanel, ReferenceInspector, VersionsPanel, HistoryPanel, AiPanel, ObjectShape,
} from "@/components/venue-designer/panels";
import { OBJECT_DEF_BY_TYPE } from "@/components/venue-designer/object-catalog";

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({ meta: [{ title: "Venue Designer · EventScape Studio" }] }),
  component: VenueDesignerPage,
});

type Tool = "select" | "pan" | "place";

const PREFS_KEY = "venue-designer-layout-v1";
type LayoutPrefs = {
  leftCollapsed: boolean; rightCollapsed: boolean;
  drawerCollapsed: boolean; drawerHeight: number; drawerTab: DrawerTab;
  showGrid: boolean; showRulers: boolean; showMinimap: boolean; snap: boolean;
};
const DEFAULT_PREFS: LayoutPrefs = {
  leftCollapsed: false, rightCollapsed: false,
  drawerCollapsed: false, drawerHeight: 240, drawerTab: "layers",
  showGrid: true, showRulers: true, showMinimap: false, snap: true,
};

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
  const fetchTemplates = useServerFn(listVenueTemplates);
  const publishTemplate = useServerFn(publishVenueTemplate);
  const restoreTemplate = useServerFn(restoreVenueTemplate);
  const removeTemplate = useServerFn(deleteVenueTemplate);
  const fetchLibrary = useServerFn(listOrgLibrary);
  const saveToLibrary = useServerFn(saveObjectToLibrary);
  const removeLibraryItem = useServerFn(deleteOrgLibraryItem);

  const queryKey = ["venue-design", venueId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchDesign({ data: { venueId } }) });

  // ---- Layout prefs (localStorage; server sync in later phase) ----
  const [prefs, setPrefs] = useState<LayoutPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREFS_KEY) : null;
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const patchPrefs = useCallback((p: Partial<LayoutPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const [tool, setTool] = useState<Tool>("select");
  const [placingType, setPlacingType] = useState<string | null>(null);
  const [placingLibraryItem, setPlacingLibraryItem] = useState<any | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [cursor, setCursor] = useState<CanvasCoords>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingRefId, setAnalyzingRefId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
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
  const input = useCanvasInput({
    onPan,
    onZoom: (f, focal) => {
      setView((v) => {
        const nz = Math.min(8, Math.max(0.1, v.zoom * f));
        const k = nz / v.zoom;
        return { zoom: nz, x: focal.x - (focal.x - v.x) * k, y: focal.y - (focal.y - v.y) * k };
      });
    },
  });

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

  const snapVal = useCallback((v: number) => (prefs.snap ? Math.round(v) : v), [prefs.snap]);

  const patchCache = useCallback((fn: (d: any) => any) => {
    qc.setQueryData(queryKey, (prev: any) => (prev ? fn(prev) : prev));
  }, [qc, queryKey]);

  // ---- Mutations ----
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

  const templatesKey = ["venue-templates", venueId];
  const { data: templates } = useQuery({ queryKey: templatesKey, queryFn: () => fetchTemplates({ data: { venueId } }) });
  const publishMutation = useMutation({
    mutationFn: (input: { label?: string; description?: string }) => publishTemplate({ data: { venueId, ...input } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: templatesKey }); toast.success("Version published"); },
    onError: (e: any) => toast.error(e?.message ?? "Publish failed"),
  });
  const restoreMutation = useMutation({
    mutationFn: (templateId: string) => restoreTemplate({ data: { venueId, templateId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Version restored"); },
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => removeTemplate({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKey }),
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const libraryKey = ["org-library", venueId];
  const { data: libraryItems } = useQuery({ queryKey: libraryKey, queryFn: () => fetchLibrary({ data: { venueId } }) });
  const saveLibraryMutation = useMutation({
    mutationFn: (input: any) => saveToLibrary({ data: { venueId, ...input } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: libraryKey }); toast.success("Saved to library"); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const deleteLibraryMutation = useMutation({
    mutationFn: (id: string) => removeLibraryItem({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryKey }),
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

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
      const { error: upErr } = await supabase.storage.from("venue-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      const canvasW = (data.venue as any).canvas_width ?? 2000;
      const canvasH = (data.venue as any).canvas_height ?? 1500;
      const scale = Math.min(canvasW / dims.w, canvasH / dims.h) * 0.9;
      const w = dims.w * scale, h = dims.h * scale;
      const transform = { x: (canvasW - w) / 2, y: (canvasH - h) / 2, width: w, height: h, rotation: 0 };
      await refCreateMutation.mutateAsync({ venueId, file_url: path, mime_type: file.type, label: file.name, transform, opacity: 0.5 });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const handleAiImport = async (referenceId: string) => {
    setAnalyzingRefId(referenceId);
    try {
      const r: any = await analyzeDrawing({ data: { venueId, referenceId } });
      toast.success(`AI detected ${r.count} object${r.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast.error(e?.message ?? "AI import failed");
    } finally { setAnalyzingRefId(null); }
  };

  const armType = useCallback((type: string) => {
    setPlacingType(type);
    setPlacingLibraryItem(null);
    setTool("place");
  }, []);

  const handleSaveSelectionAsAsset = useCallback(() => {
    if (!selected) { toast.error("Select an object first"); return; }
    const name = window.prompt("Library item name", selected.name ?? selected.type);
    if (!name) return;
    const category = window.prompt("Category", "Custom") ?? "Custom";
    saveLibraryMutation.mutate({
      name, category, type: selected.type, shape: selected.shape,
      default_geometry: { w: selected.geometry?.w ?? 10, h: selected.geometry?.h ?? 10 },
      default_style: selected.style ?? {}, default_metadata: selected.metadata ?? {},
    });
  }, [selected, saveLibraryMutation]);

  const handleDuplicate = useCallback(() => {
    if (!selected) return;
    const g = selected.geometry ?? {};
    placeMutation.mutate({
      venueId, layer_id: selected.layer_id, type: selected.type, shape: selected.shape,
      name: selected.name ? `${selected.name} copy` : undefined,
      geometry: { ...g, x: (g.x ?? 0) + 5, y: (g.y ?? 0) + 5 },
      style: selected.style ?? {}, metadata: selected.metadata ?? {},
    });
  }, [selected, placeMutation, venueId]);

  const handlePublish = useCallback(() => {
    const label = window.prompt("Version label", "");
    publishMutation.mutate({ label: label?.trim() || undefined });
  }, [publishMutation]);

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteMutation.mutate(selectedId); }
      if (e.key === "Escape") { setSelectedId(null); setPlacingType(null); setPlacingLibraryItem(null); setTool("select"); setPresenting(false); }
      if (e.key === "v") setTool("select");
      if (e.key === "h") setTool("pan");
      if (e.key === "b") armType("booth");
      if (e.key === "r") armType("building");
      if (e.key === "F5") { e.preventDefault(); setPresenting((p) => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); handleDuplicate(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); handlePublish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteMutation, armType, handleDuplicate, handlePublish]);

  // ---- Canvas click / drag ----
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== "place") return;
    const p = svgToCanvas(e.clientX, e.clientY);
    if (placingLibraryItem) {
      const li = placingLibraryItem;
      const g0 = li.default_geometry ?? { w: 10, h: 10 };
      const w = g0.w ?? 10, h = g0.h ?? 10;
      const targetLayer = layers.find((l: any) => l.kind === "custom") ?? layers[0];
      placeMutation.mutate({
        venueId, layer_id: targetLayer?.id ?? null, type: li.type, shape: li.shape, name: li.name,
        geometry: { x: snapVal(p.x - w / 2), y: snapVal(p.y - h / 2), w, h, rotation: 0 },
        style: li.default_style ?? {}, metadata: li.default_metadata ?? {},
      });
      if (!e.shiftKey) { setTool("select"); setPlacingLibraryItem(null); }
      return;
    }
    if (!placingType) return;
    const def = OBJECT_DEF_BY_TYPE[placingType];
    if (!def) return;
    const targetLayer = layers.find((l: any) => l.kind === def.defaultLayerKind) ?? layers[0];
    const g = { x: snapVal(p.x - def.size.w / 2), y: snapVal(p.y - def.size.h / 2), w: def.size.w, h: def.size.h, rotation: 0 };
    const nextBoothName = def.type === "booth"
      ? `B${(objects.filter((o: any) => o.type === "booth").length + 1).toString().padStart(3, "0")}`
      : undefined;
    placeMutation.mutate({
      venueId, layer_id: targetLayer?.id ?? null, type: def.type, shape: def.shape,
      name: nextBoothName ?? def.label, geometry: g,
      style: { fill: def.fill, stroke: def.stroke },
      metadata: def.type === "booth" ? { price: 0, size: `${def.size.w}x${def.size.h}`, electric: false, water: false, premium: false, corner: false } : {},
    });
    if (!e.shiftKey) { setTool("select"); setPlacingType(null); }
  };

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
    if (svgRef.current) { const p = svgToCanvas(e.clientX, e.clientY); setCursor(p); }
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgToCanvas(e.clientX, e.clientY);
    const obj = objects.find((o: any) => o.id === drag.id);
    if (!obj) return;
    if (drag.mode === "move") {
      const nx = snapVal(drag.origX + (p.x - drag.startX));
      const ny = snapVal(drag.origY + (p.y - drag.startY));
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === drag.id ? { ...o, geometry: { ...o.geometry, x: nx, y: ny } } : o) }));
    } else {
      const dx = p.x - drag.startX, dy = p.y - drag.startY;
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

  const zoomPct = Math.round(view.zoom * 100);

  return (
    <div className="fixed inset-0 top-16 z-30 flex flex-col bg-background">
      {!presenting && (
        <MenuBar
          venueName={isLoading ? "…" : (data?.venue?.name ?? "Venue")}
          onUndo={() => toast.info("Undo/redo arrives in phase D")}
          onRedo={() => toast.info("Undo/redo arrives in phase D")}
          onDuplicate={handleDuplicate}
          onDelete={() => selected && deleteMutation.mutate(selected.id)}
          onGroup={() => toast.info("Grouping arrives in phase B")}
          onUngroup={() => toast.info("Grouping arrives in phase B")}
          onLock={() => selected && updateMutation.mutate({ id: selected.id, patch: { locked: !selected.locked } })}
          onHide={() => selected && updateMutation.mutate({ id: selected.id, patch: { hidden: !selected.hidden } })}
          onRename={() => {
            if (!selected) return;
            const n = window.prompt("Rename", selected.name ?? "");
            if (n != null) updateMutation.mutate({ id: selected.id, patch: { name: n } });
          }}
          onSaveAsAsset={handleSaveSelectionAsAsset}
          onSelectAll={() => toast.info("Multi-select arrives in phase B")}
          onZoomIn={() => onZoom(1.2)}
          onZoomOut={() => onZoom(1 / 1.2)}
          onZoomFit={() => setView({ x: 0, y: 0, zoom: 1 })}
          onZoom100={() => setView((v) => ({ ...v, zoom: 1 }))}
          onToggleGrid={() => patchPrefs({ showGrid: !prefs.showGrid })}
          onToggleRulers={() => patchPrefs({ showRulers: !prefs.showRulers })}
          onToggleSnap={() => patchPrefs({ snap: !prefs.snap })}
          onToggleMinimap={() => patchPrefs({ showMinimap: !prefs.showMinimap })}
          onToggleLeft={() => patchPrefs({ leftCollapsed: !prefs.leftCollapsed })}
          onToggleRight={() => patchPrefs({ rightCollapsed: !prefs.rightCollapsed })}
          onToggleDrawer={() => patchPrefs({ drawerCollapsed: !prefs.drawerCollapsed })}
          onPresent={() => setPresenting(true)}
          onAlign={() => toast.info("Align arrives in phase B")}
          onDistribute={() => toast.info("Distribute arrives in phase B")}
          onBringForward={() => toast.info("Z-order arrives in phase B")}
          onSendBackward={() => toast.info("Z-order arrives in phase B")}
          onBringToFront={() => toast.info("Z-order arrives in phase B")}
          onSendToBack={() => toast.info("Z-order arrives in phase B")}
          onFlip={() => toast.info("Flip arrives in phase B")}
          onInsertType={armType}
          onInsertReference={() => fileInputRef.current?.click()}
          onOpenLibrary={() => patchPrefs({ leftCollapsed: false })}
          onAiTrace={() => { if (references[0]) handleAiImport(references[0].id); else toast.info("Upload a reference first"); }}
          onAiGenerateBooths={() => toast.info("AI booth grid arrives in phase C")}
          onAiAsk={() => { patchPrefs({ drawerCollapsed: false, drawerTab: "ai" }); }}
          onPublishVersion={handlePublish}
          onManageVersions={() => patchPrefs({ drawerCollapsed: false, drawerTab: "templates" })}
          gridOn={prefs.showGrid}
          rulersOn={prefs.showRulers}
          snapOn={prefs.snap}
          minimapOn={prefs.showMinimap}
        />
      )}

      {!presenting && (
        <ToolStrip
          tool={tool}
          placingType={placingType}
          onSelect={() => { setTool("select"); setPlacingType(null); setPlacingLibraryItem(null); }}
          onPan={() => { setTool("pan"); setPlacingType(null); setPlacingLibraryItem(null); }}
          onPickType={armType}
          onImportRef={() => fileInputRef.current?.click()}
          onPublish={handlePublish}
          onZoomOut={() => onZoom(1 / 1.2)}
          onZoomIn={() => onZoom(1.2)}
          onZoomReset={() => setView({ x: 0, y: 0, zoom: 1 })}
          zoomPct={zoomPct}
          uploading={uploading}
        />
      )}

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

      <div className="flex flex-1 min-h-0">
        {/* Left panel — Object Library */}
        {!presenting && (
          prefs.leftCollapsed ? (
            <div className="flex w-10 shrink-0 flex-col items-center border-r bg-card py-2">
              <button className="rounded p-1.5 hover:bg-muted" onClick={() => patchPrefs({ leftCollapsed: false })} title="Show Object Library">
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <aside className="relative w-64 shrink-0 border-r bg-card">
              <button
                className="absolute right-1 top-1 z-10 rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => patchPrefs({ leftCollapsed: true })}
                title="Collapse"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
              <ObjectLibrary
                activeType={placingType}
                onPick={armType}
                libraryItems={(libraryItems as any[]) ?? []}
                activeLibraryId={placingLibraryItem?.id ?? null}
                onPickLibrary={(item) => { setPlacingLibraryItem(item); setPlacingType(null); setTool("place"); }}
                onDeleteLibrary={(id) => deleteLibraryMutation.mutate(id)}
              />
            </aside>
          )
        )}

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden bg-muted/30">
          <svg
            ref={svgRef}
            className="h-full w-full touch-none"
            style={{ cursor: tool === "pan" ? "grab" : tool === "place" ? "crosshair" : "default" }}
            onPointerDown={(e) => { if (tool === "select") setSelectedId(null); input.onPointerDown(e); }}
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
              {prefs.showGrid && <rect x={0} y={0} width={width} height={height} fill="url(#grid-lg)" opacity={0.5} />}
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
                    <image href={r.signed_url} x={t.x ?? 0} y={t.y ?? 0} width={t.width ?? 100} height={t.height ?? 100}
                      opacity={r.opacity ?? 0.5} preserveAspectRatio="none"
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedRefId(r.id); setSelectedId(null); }}
                      style={{ cursor: "pointer" }} />
                    {isSel && (
                      <rect x={t.x ?? 0} y={t.y ?? 0} width={t.width ?? 100} height={t.height ?? 100}
                        fill="none" stroke="hsl(var(--primary))" strokeWidth={2 / view.zoom}
                        strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`} pointerEvents="none" />
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

          {/* Status bar overlay (bottom-left) */}
          {!presenting && (
            <div className="pointer-events-auto absolute bottom-2 left-2 flex items-center gap-2 rounded-md border bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              <button className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted", prefs.showGrid && "text-foreground")} onClick={() => patchPrefs({ showGrid: !prefs.showGrid })} title="Grid (G)">
                <Grid3x3 className="h-3.5 w-3.5" /> Grid
              </button>
              <button className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted", prefs.snap && "text-foreground")} onClick={() => patchPrefs({ snap: !prefs.snap })} title="Smart snap">
                <Magnet className="h-3.5 w-3.5" /> Snap
              </button>
              <button className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted", prefs.showRulers && "text-foreground")} onClick={() => patchPrefs({ showRulers: !prefs.showRulers })} title="Rulers">
                <RulerIcon className="h-3.5 w-3.5" /> {units}
              </button>
              <button className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted", prefs.showMinimap && "text-foreground")} onClick={() => patchPrefs({ showMinimap: !prefs.showMinimap })} title="Minimap">
                <Map className="h-3.5 w-3.5" /> Map
              </button>
              <span className="mx-1 h-3 w-px bg-border" />
              <span>x {Math.round(cursor.x)}, y {Math.round(cursor.y)}</span>
              <span>· {objects.length} obj</span>
              <span>· {zoomPct}%</span>
            </div>
          )}

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-8 w-40" />
            </div>
          )}

          {!isLoading && objects.length === 0 && !presenting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto max-w-md rounded-lg border bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                <div className="mb-2 text-lg font-semibold">Start building your venue</div>
                <p className="mb-4 text-sm text-muted-foreground">
                  Pick something from the Object Library on the left, then click the canvas to place it. Everything is editable, reusable, and saved automatically.
                </p>
                <p className="text-xs text-muted-foreground">V select · H pan · B booth · R rectangle · Del remove · F5 present</p>
              </div>
            </div>
          )}

          {presenting && (
            <button
              onClick={() => setPresenting(false)}
              className="absolute right-3 top-3 rounded-md border bg-card/95 px-3 py-1.5 text-xs shadow-sm hover:bg-muted"
            >
              Exit presentation (Esc)
            </button>
          )}
        </div>

        {/* Right panel — Properties */}
        {!presenting && (
          prefs.rightCollapsed ? (
            <div className="flex w-10 shrink-0 flex-col items-center border-l bg-card py-2">
              <button className="rounded p-1.5 hover:bg-muted" onClick={() => patchPrefs({ rightCollapsed: false })} title="Show Properties">
                <PanelRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <aside className="relative w-80 shrink-0 overflow-auto border-l bg-card">
              <button
                className="absolute right-1 top-1 z-10 rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => patchPrefs({ rightCollapsed: true })}
                title="Collapse"
              >
                <PanelRight className="h-3.5 w-3.5" />
              </button>
              {selected ? (
                <Inspector
                  key={selected.id}
                  object={selected}
                  layers={layers}
                  onPatch={(patch) => updateMutation.mutate({ id: selected.id, patch })}
                  onCommitPatch={(patch) => updateMutation.mutate({ id: selected.id, patch })}
                  onDelete={() => deleteMutation.mutate(selected.id)}
                  onSaveToLibrary={handleSaveSelectionAsAsset}
                  savingLibrary={saveLibraryMutation.isPending}
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
                <VenueInspector venue={data?.venue} />
              )}
            </aside>
          )
        )}
      </div>

      {/* Bottom drawer */}
      {!presenting && (
        <BottomDrawer
          active={prefs.drawerTab}
          onActive={(t) => patchPrefs({ drawerTab: t })}
          collapsed={prefs.drawerCollapsed}
          onToggleCollapsed={() => patchPrefs({ drawerCollapsed: !prefs.drawerCollapsed })}
          height={prefs.drawerHeight}
          onHeightChange={(h) => patchPrefs({ drawerHeight: h })}
          renderTab={(t) => {
            switch (t) {
              case "layers":
                return (
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
                );
              case "history": return <HistoryPanel />;
              case "ai": return <AiPanel />;
              case "assets":
                return (
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
                );
              case "templates":
                return (
                  <VersionsPanel
                    templates={(templates as any[]) ?? []}
                    publishing={publishMutation.isPending}
                    restoringId={restoreMutation.isPending ? (restoreMutation.variables as string) : null}
                    onPublish={(label) => publishMutation.mutate({ label })}
                    onRestore={(id) => { if (window.confirm("Restore this version? Current design will be replaced.")) restoreMutation.mutate(id); }}
                    onDelete={(id) => deleteTemplateMutation.mutate(id)}
                  />
                );
              case "objects":
                return (
                  <ObjectsListPanel
                    objects={objects}
                    layers={layers}
                    selectedId={selectedId}
                    onSelect={(id) => { setSelectedId(id); setSelectedRefId(null); }}
                    onToggleVisible={(o) => updateMutation.mutate({ id: o.id, patch: { hidden: !o.hidden } })}
                    onToggleLocked={(o) => updateMutation.mutate({ id: o.id, patch: { locked: !o.locked } })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                );
            }
          }}
        />
      )}
    </div>
  );
}
