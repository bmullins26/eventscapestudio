import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import {
  getVenueDesign, createVenueObject, updateVenueObject, deleteVenueObject,
  createVenueLayer, updateVenueLayer, deleteVenueLayer,
  createVenueReference, updateVenueReference, deleteVenueReference, analyzeVenueDrawing,
  listVenueTemplates, publishVenueTemplate, restoreVenueTemplate, deleteVenueTemplate,
  listOrgLibrary, saveObjectToLibrary, deleteOrgLibraryItem,
  updateVenueMapLocation,
} from "@/lib/venue-designer.functions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ObjectLibrary, Inspector, VenueInspector, LayerPanel, ObjectsListPanel,
  ReferencePanel, ReferenceInspector, VersionsPanel, ObjectShape,
} from "@/components/venue-designer/panels";
import { OBJECT_DEF_BY_TYPE } from "@/components/venue-designer/object-catalog";
import { ClientMapCanvas } from "@/components/venue-designer/client-map-canvas";
import { REF_ZOOM } from "@/components/venue-designer/map-canvas";
import { FloatingTopbar } from "@/components/venue-designer/floating-topbar";
import { MapSearch } from "@/components/venue-designer/map-search";
import { FloatingTools } from "@/components/venue-designer/floating-tools";
import { FloatingZoom, type Basemap } from "@/components/venue-designer/floating-zoom";
import { PropertiesCard } from "@/components/venue-designer/properties-card";
import { SideSheet } from "@/components/venue-designer/side-sheet";

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({ meta: [{ title: "Venue Designer · EventScape Studio" }] }),
  component: VenueDesignerPage,
});

type Tool = "select" | "pan" | "place";
type SidePanel = "library" | "layers" | "objects" | "refs" | "versions" | null;

const PREFS_KEY = "venue-designer-oneplan-v1";
type Prefs = { basemap: Basemap; gridOn: boolean; side: SidePanel };
const DEFAULT_PREFS: Prefs = { basemap: "satellite", gridOn: false, side: "library" };

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
  const saveMapLoc = useServerFn(updateVenueMapLocation);

  const queryKey = ["venue-design", venueId];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchDesign({ data: { venueId } }) });

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREFS_KEY) : null;
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const patchPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const [tool, setTool] = useState<Tool>("select");
  const [placingType, setPlacingType] = useState<string | null>(null);
  const [placingLibraryItem, setPlacingLibraryItem] = useState<any | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingRefId, setAnalyzingRefId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(18);
  const [presenting, setPresenting] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { id: string; startX: number; startY: number; origX: number; origY: number; origW?: number; origH?: number; mode: "move" | "resize"; handle?: string }
    | null
  >(null);

  const layers: any[] = (data?.layers as any[] | undefined) ?? [];
  const objects: any[] = (data?.objects as any[] | undefined) ?? [];
  const references: any[] = ((data as any)?.references as any[] | undefined) ?? [];
  const layerById = useMemo(() => Object.fromEntries(layers.map((l: any) => [l.id, l])), [layers]);
  const selected = objects.find((o: any) => o.id === selectedId) ?? null;
  const selectedRef = references.find((r: any) => r.id === selectedRefId) ?? null;

  const width = data?.venue?.canvas_width ?? 2000;
  const height = data?.venue?.canvas_height ?? 1500;

  const svgToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

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
  });

  const saveMapLocMutation = useMutation({
    mutationFn: (input: { center_lat: number; center_lng: number; map_zoom: number }) =>
      saveMapLoc({ data: { venueId, ...input } }),
    onSuccess: (_r, input) => {
      patchCache((d) => ({ ...d, venue: { ...d.venue, ...input } }));
      toast.success("Map location saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save location"),
  });

  const handleFileUpload = async (file: File) => {
    if (!data?.venue) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image.");
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

  const handleSaveMapLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    saveMapLocMutation.mutate({
      center_lat: c.lat,
      center_lng: c.lng,
      map_zoom: Math.round(map.getZoom()),
    });
  }, [saveMapLocMutation]);

  const handleRename = useCallback(() => {
    if (!data?.venue) return;
    const n = window.prompt("Venue name", data.venue.name ?? "");
    if (!n) return;
    supabase.from("venues").update({ name: n }).eq("id", venueId).then(({ error }) => {
      if (error) toast.error(error.message);
      else { patchCache((d) => ({ ...d, venue: { ...d.venue, name: n } })); toast.success("Renamed"); }
    });
  }, [data?.venue, venueId, patchCache]);

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteMutation.mutate(selectedId); }
      if (e.key === "Escape") { setSelectedId(null); setSelectedRefId(null); setPlacingType(null); setPlacingLibraryItem(null); setTool("select"); setPresenting(false); }
      if (e.key === "v") setTool("select");
      if (e.key === "h") setTool("pan");
      if (e.key === "b") armType("booth");
      if (e.key === "r") armType("building");
      if (e.key === "F5") { e.preventDefault(); setPresenting((p) => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); handleDuplicate(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteMutation, armType, handleDuplicate]);

  // ---- Placement ----
  const handleCanvasClick = (p: { x: number; y: number }) => {
    if (tool !== "place") return;
    if (placingLibraryItem) {
      const li = placingLibraryItem;
      const g0 = li.default_geometry ?? { w: 10, h: 10 };
      const w = g0.w ?? 10, h = g0.h ?? 10;
      const targetLayer = layers.find((l: any) => l.kind === "custom") ?? layers[0];
      placeMutation.mutate({
        venueId, layer_id: targetLayer?.id ?? null, type: li.type, shape: li.shape, name: li.name,
        geometry: { x: p.x - w / 2, y: p.y - h / 2, w, h, rotation: 0 },
        style: li.default_style ?? {}, metadata: li.default_metadata ?? {},
      });
      setTool("select"); setPlacingLibraryItem(null);
      return;
    }
    if (!placingType) return;
    const def = OBJECT_DEF_BY_TYPE[placingType];
    if (!def) return;
    const targetLayer = layers.find((l: any) => l.kind === def.defaultLayerKind) ?? layers[0];
    const g = { x: p.x - def.size.w / 2, y: p.y - def.size.h / 2, w: def.size.w, h: def.size.h, rotation: 0 };
    const nextBoothName = def.type === "booth"
      ? `B${(objects.filter((o: any) => o.type === "booth").length + 1).toString().padStart(3, "0")}`
      : undefined;
    placeMutation.mutate({
      venueId, layer_id: targetLayer?.id ?? null, type: def.type, shape: def.shape,
      name: nextBoothName ?? def.label, geometry: g,
      style: { fill: def.fill, stroke: def.stroke },
      metadata: def.type === "booth" ? { price: 0, size: `${def.size.w}x${def.size.h}`, electric: false, water: false, premium: false, corner: false } : {},
    });
    setTool("select"); setPlacingType(null);
  };

  // ---- Object drag ----
  const setMapDragEnabled = (enabled: boolean) => {
    const m = mapRef.current;
    if (!m) return;
    if (enabled) m.dragging.enable();
    else m.dragging.disable();
  };

  const handleObjectPointerDown = (e: React.PointerEvent, obj: any) => {
    if (tool !== "select") return;
    if (obj.locked) return;
    const layer = layerById[obj.layer_id];
    if (layer?.locked) return;
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    setSelectedId(obj.id);
    setSelectedRefId(null);
    setMapDragEnabled(false);
    const start = svgToCanvas(e.clientX, e.clientY);
    dragRef.current = { id: obj.id, startX: start.x, startY: start.y, origX: obj.geometry?.x ?? 0, origY: obj.geometry?.y ?? 0, mode: "move" };
  };
  const handleResizePointerDown = (e: React.PointerEvent, obj: any, handle: string) => {
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    setMapDragEnabled(false);
    const start = svgToCanvas(e.clientX, e.clientY);
    dragRef.current = {
      id: obj.id, startX: start.x, startY: start.y,
      origX: obj.geometry?.x ?? 0, origY: obj.geometry?.y ?? 0,
      origW: obj.geometry?.w, origH: obj.geometry?.h,
      mode: "resize", handle,
    };
  };
  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgToCanvas(e.clientX, e.clientY);
    const obj = objects.find((o: any) => o.id === drag.id);
    if (!obj) return;
    if (drag.mode === "move") {
      const nx = drag.origX + (p.x - drag.startX);
      const ny = drag.origY + (p.y - drag.startY);
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === drag.id ? { ...o, geometry: { ...o.geometry, x: nx, y: ny } } : o) }));
    } else {
      const dx = p.x - drag.startX, dy = p.y - drag.startY;
      const g = obj.geometry ?? {};
      const orig = { x: drag.origX, y: drag.origY, w: drag.origW ?? g.w, h: drag.origH ?? g.h };
      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;
      const h = drag.handle!;
      if (h.includes("e")) nw = Math.max(1, orig.w + dx);
      if (h.includes("s")) nh = Math.max(1, orig.h + dy);
      if (h.includes("w")) { nw = Math.max(1, orig.w - dx); nx = orig.x + (orig.w - nw); }
      if (h.includes("n")) { nh = Math.max(1, orig.h - dy); ny = orig.y + (orig.h - nh); }
      patchCache((d) => ({ ...d, objects: d.objects.map((o: any) => o.id === drag.id ? { ...o, geometry: { ...o.geometry, x: nx, y: ny, w: nw, h: nh } } : o) }));
    }
  };
  const handleGlobalPointerUp = () => {
    const drag = dragRef.current;
    setMapDragEnabled(true);
    if (drag) {
      const obj = objects.find((o: any) => o.id === drag.id);
      if (obj) updateMutation.mutate({ id: drag.id, patch: { geometry: obj.geometry } });
      dragRef.current = null;
    }
  };

  const centerLat = (data?.venue as any)?.center_lat ?? null;
  const centerLng = (data?.venue as any)?.center_lng ?? null;
  const savedZoom = (data?.venue as any)?.map_zoom ?? null;

  const zoomPct = Math.round(Math.pow(2, mapZoom - REF_ZOOM) * 100);

  const placeAtPoint = useCallback((payload: { kind: "catalog"; type: string } | { kind: "library"; item: any }, p: { x: number; y: number }) => {
    if (payload.kind === "library") {
      const li = payload.item;
      const g0 = li.default_geometry ?? { w: 10, h: 10 };
      const w = g0.w ?? 10, h = g0.h ?? 10;
      const targetLayer = layers.find((l: any) => l.kind === "custom") ?? layers[0];
      placeMutation.mutate({
        venueId, layer_id: targetLayer?.id ?? null, type: li.type, shape: li.shape, name: li.name,
        geometry: { x: p.x - w / 2, y: p.y - h / 2, w, h, rotation: 0 },
        style: li.default_style ?? {}, metadata: li.default_metadata ?? {},
      });
      return;
    }
    const def = OBJECT_DEF_BY_TYPE[payload.type];
    if (!def) return;
    const targetLayer = layers.find((l: any) => l.kind === def.defaultLayerKind) ?? layers[0];
    const g = { x: p.x - def.size.w / 2, y: p.y - def.size.h / 2, w: def.size.w, h: def.size.h, rotation: 0 };
    const nextBoothName = def.type === "booth"
      ? `B${(objects.filter((o: any) => o.type === "booth").length + 1).toString().padStart(3, "0")}`
      : undefined;
    placeMutation.mutate({
      venueId, layer_id: targetLayer?.id ?? null, type: def.type, shape: def.shape,
      name: nextBoothName ?? def.label, geometry: g,
      style: { fill: def.fill, stroke: def.stroke },
      metadata: def.type === "booth" ? { price: 0, size: `${def.size.w}x${def.size.h}`, electric: false, water: false, premium: false, corner: false } : {},
    });
  }, [layers, objects, placeMutation, venueId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const raw = e.dataTransfer.getData("application/x-vd-object");
    if (!raw) return;
    e.preventDefault();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return; }
    const p = svgToCanvas(e.clientX, e.clientY);
    placeAtPoint(parsed, p);
  }, [placeAtPoint, svgToCanvas]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-background"
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      onPointerCancel={handleGlobalPointerUp}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-vd-object")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={handleDrop}
    >

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

      <ClientMapCanvas
        centerLat={centerLat}
        centerLng={centerLng}
        mapZoom={savedZoom}
        canvasWidth={width}
        canvasHeight={height}
        basemap={prefs.basemap}
        gridOn={prefs.gridOn}
        tool={tool}
        svgRef={svgRef}
        onMapReady={(m) => { mapRef.current = m; }}
        onZoomChange={setMapZoom}
        onCanvasClick={handleCanvasClick}
      >
        {/* References first, then objects */}
        {references.map((r: any) => {
          if (!r.visible || !r.signed_url) return null;
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
                opacity={r.opacity ?? 0.5} preserveAspectRatio="none"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedRefId(r.id); setSelectedId(null);
                }}
                style={{ cursor: "pointer" }}
              />
              {isSel && (
                <rect
                  x={t.x ?? 0} y={t.y ?? 0} width={t.width ?? 100} height={t.height ?? 100}
                  fill="none" stroke="hsl(var(--primary))" strokeWidth={2}
                  strokeDasharray="4 4" pointerEvents="none"
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
              zoom={1}
              onPointerDown={(e) => handleObjectPointerDown(e, o)}
              onResizePointerDown={(e, h) => handleResizePointerDown(e, o, h)}
            />
          );
        })}
      </ClientMapCanvas>

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </div>
      )}

      {!presenting && (
        <>
          <FloatingTopbar
            venueName={isLoading ? "…" : (data?.venue?.name ?? "Venue")}
            onUndo={() => toast.info("Undo/redo coming soon")}
            onRedo={() => toast.info("Undo/redo coming soon")}
            onExport={() => toast.info("Export coming soon")}
            onShare={() => toast.info("Share coming soon")}
            onRename={handleRename}
            onPresent={() => setPresenting(true)}
            onManageVersions={() => patchPrefs({ side: "versions" })}
            onPublish={handlePublish}
            onOpenLayers={() => patchPrefs({ side: "layers" })}
            onOpenObjects={() => patchPrefs({ side: "objects" })}
            onOpenReferences={() => patchPrefs({ side: "refs" })}
            onOpenLibrary={() => patchPrefs({ side: "library" })}
            onOpenVersions={() => patchPrefs({ side: "versions" })}
            onSaveMapLocation={handleSaveMapLocation}
            mapLocationSaved={centerLat != null}
          />

          <MapSearch
            getMap={() => mapRef.current}
            onPicked={() => toast.info("Click ⋯ → Save map location to anchor this venue here")}
          />



          <FloatingTools
            tool={tool}
            placingType={placingType}
            onSelect={() => { setTool("select"); setPlacingType(null); setPlacingLibraryItem(null); }}
            onPan={() => { setTool("pan"); setPlacingType(null); setPlacingLibraryItem(null); }}
            onArm={armType}
          />

          <FloatingZoom
            zoomPct={zoomPct}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onZoomIn={() => mapRef.current?.zoomIn()}
            basemap={prefs.basemap}
            onBasemap={(b) => patchPrefs({ basemap: b })}
            onHelp={() => toast.info("V select · H pan · B booth · R building · Del remove")}
          />

          {/* Left slide-out */}
          <SideSheet open={prefs.side === "library"} onClose={() => patchPrefs({ side: null })} title="Object Library" width={288}>
            <ObjectLibrary
              activeType={placingType}
              onPick={armType}
              libraryItems={(libraryItems as any[]) ?? []}
              activeLibraryId={placingLibraryItem?.id ?? null}
              onPickLibrary={(item) => { setPlacingLibraryItem(item); setPlacingType(null); setTool("place"); }}
              onDeleteLibrary={(id) => deleteLibraryMutation.mutate(id)}
            />
          </SideSheet>
          <SideSheet open={prefs.side === "layers"} onClose={() => patchPrefs({ side: null })} title="Layers" width={288}>
            <LayerPanel
              layers={layers}
              onToggleVisible={(l) => layerUpdateMutation.mutate({ id: l.id, patch: { visible: !l.visible } })}
              onToggleLocked={(l) => layerUpdateMutation.mutate({ id: l.id, patch: { locked: !l.locked } })}
              onRename={(l, name) => layerUpdateMutation.mutate({ id: l.id, patch: { name } })}
              onDelete={(l) => layerDeleteMutation.mutate(l.id)}
              onAdd={() => {
                const name = window.prompt("Layer name", "New layer");
                if (name) layerCreateMutation.mutate({ venueId, name, kind: "custom", order_index: layers.length });
              }}
            />
          </SideSheet>
          <SideSheet open={prefs.side === "objects"} onClose={() => patchPrefs({ side: null })} title="Objects" width={320}>
            <ObjectsListPanel
              objects={objects} layers={layers} selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onToggleVisible={(o) => updateMutation.mutate({ id: o.id, patch: { hidden: !o.hidden } })}
              onToggleLocked={(o) => updateMutation.mutate({ id: o.id, patch: { locked: !o.locked } })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </SideSheet>
          <SideSheet open={prefs.side === "refs"} onClose={() => patchPrefs({ side: null })} title="References & AI" width={320}>
            <ReferencePanel
              references={references} uploading={uploading} analyzingRefId={analyzingRefId}
              onUploadClick={() => fileInputRef.current?.click()}
              onSelect={(r) => { setSelectedRefId(r.id); setSelectedId(null); }}
              onToggleVisible={(r) => refUpdateMutation.mutate({ id: r.id, patch: { visible: !r.visible } })}
              onDelete={(r) => refDeleteMutation.mutate(r.id)}
              onAiImport={handleAiImport}
              selectedRefId={selectedRefId}
            />
          </SideSheet>
          <SideSheet open={prefs.side === "versions"} onClose={() => patchPrefs({ side: null })} title="Versions" width={320}>
            <VersionsPanel
              templates={(templates as any[]) ?? []}
              publishing={publishMutation.isPending}
              restoringId={restoreMutation.isPending ? (restoreMutation.variables as any) : null}
              onPublish={(label) => publishMutation.mutate({ label })}
              onRestore={(id) => restoreMutation.mutate(id)}
              onDelete={(id) => deleteTemplateMutation.mutate(id)}
            />
          </SideSheet>

          {/* Floating properties card */}
          {(selected || selectedRef) && (
            <PropertiesCard
              title={selected ? (selected.name ?? selected.type) : (selectedRef?.label ?? "Reference")}
              subtitle={selected ? `${selected.type} · ${selected.shape}` : undefined}
              onClose={() => { setSelectedId(null); setSelectedRefId(null); }}
            >
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
            </PropertiesCard>
          )}

          {/* First-run map anchor prompt */}
          {!isLoading && centerLat == null && (
            <div className="pointer-events-auto absolute left-1/2 top-24 z-[500] w-[min(420px,90vw)] -translate-x-1/2 rounded-2xl border border-border/70 bg-background/95 p-4 text-sm shadow-lg backdrop-blur">
              <div className="mb-1 font-medium">Anchor this venue to a location</div>
              <p className="mb-3 text-xs text-muted-foreground">
                Pan and zoom the satellite map to your venue's actual location, then click <span className="font-medium">Save map location</span> under the ⋯ menu.
                Everything you draw will stay pinned to the real world.
              </p>
              <button
                onClick={handleSaveMapLocation}
                className="w-full rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save this map view as the venue location
              </button>
            </div>
          )}
        </>
      )}

      {presenting && (
        <button
          onClick={() => setPresenting(false)}
          className="absolute right-3 top-3 z-[600] rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-sm hover:bg-muted"
        >
          Exit presentation (Esc)
        </button>
      )}
    </div>
  );
}
