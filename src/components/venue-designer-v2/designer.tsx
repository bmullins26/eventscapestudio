import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Undo2, Redo2, MousePointer2, Store,
  Type, Package, Layers as LayersIcon, Search,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, PanelRightClose, PanelRightOpen,
  Route as RouteIcon, Footprints, Building2, ParkingSquare, Ruler, Armchair, Fence as FenceIcon, Table2,
  MapPin, Eye, EyeOff, Lock, Unlock, Move as MoveIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignerCanvas, type CanvasTool } from "@/components/venue-designer/canvas";
import { Inspector } from "@/components/venue-designer/inspector";
import { useDesignerStore } from "@/components/venue-designer/store";
import { makeBooth, makeText, makeIcon, makePreset, ICONS, uid, resetBoothCounter } from "@/components/venue-designer/factory";
import { IconGlyph } from "@/components/venue-designer/icon-glyph";
import { AddBackgroundDialog } from "@/components/venue-designer/add-background-dialog";
import type { AnyElement, IconKey, Layout } from "@/components/venue-designer/types";

interface DesignerV2Props {
  venueId: string;
  organizationId: string;
  venueName: string;
  initial: Layout;
  onSave: (layout: Layout) => Promise<void>;
}

type LeftTab = "objects" | "layers" | "search" | null;

function installFactory() {
  (globalThis as any).__vdFactory = (tool: string, x: number, y: number, extra?: any): AnyElement | null => {
    if (tool === "booth") return makeBooth(x - 5, y - 5);
    if (tool === "text") return makeText(x, y - 3);
    if (tool === "icon" && extra?.iconKey) return makeIcon(extra.iconKey as IconKey, x - 4, y - 4);
    if (
      tool === "road" || tool === "walkway" || tool === "building" ||
      tool === "parking" || tool === "measure" || tool === "table" ||
      tool === "chair" || tool === "fence"
    ) return makePreset(tool as any, x, y);
    return null;
  };
}

export function VenueDesignerV2({ venueId, organizationId, venueName, initial, onSave }: DesignerV2Props) {
  const { state, actions } = useDesignerStore(initial);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [iconKey, setIconKey] = useState<IconKey>("tree");
  const [zoomPct, setZoomPct] = useState(100);
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>(null);
  const [rightOpen, setRightOpen] = useState(true);
  const [bgDialogOpen, setBgDialogOpen] = useState(false);
  const [bgSelected, setBgSelected] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [mapAdjust, setMapAdjust] = useState(false);
  const viewportRef = useRef({ x: -20, y: -20, scale: 4 });
  const workspaceRef = useRef<HTMLDivElement | null>(null);


  const bg = state.settings.background ?? null;
  const patchBg = (patch: Partial<NonNullable<typeof bg>>) => {
    if (!bg) return;
    actions.setSettings({ background: { ...bg, ...patch } });
  };
  const onMapViewport = (v: { lat: number; lng: number; zoom: number }) => {
    if (!bg || bg.kind !== "google-satellite") return;
    const mpp = (156543.03392 * Math.cos((v.lat * Math.PI) / 180)) / Math.pow(2, v.zoom);
    const feet = 1024 * mpp * 3.28084;
    const cx = bg.x + bg.w / 2;
    const cy = bg.y + bg.h / 2;
    actions.setSettings({
      background: {
        ...bg,
        w: feet, h: feet,
        x: cx - feet / 2, y: cy - feet / 2,
        meta: { ...(bg.meta ?? {}), lat: v.lat, lng: v.lng, zoom: v.zoom },
      },
    });
  };

  useEffect(() => { installFactory(); }, []);

  // Seed booth counter to continue numbering
  useEffect(() => {
    const maxN = state.elements.reduce((m, e) => {
      if (e.kind !== "booth") return m;
      const n = Number((e as any).label);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    resetBoothCounter(maxN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open inspector on selection (desktop)
  useEffect(() => {
    if (state.selection.length > 0) setRightOpen(true);
  }, [state.selection.length]);

  // Keyboard shortcuts (V/B/R/C/T/L/M, arrows, delete, cmd+z, cmd+d)
  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo(); else actions.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); actions.redo(); return; }
      if (meta && e.key.toLowerCase() === "d" && state.selection.length) {
        e.preventDefault();
        state.selection.forEach((id) => {
          const el = state.elements.find((x) => x.id === id);
          if (el) actions.add({ ...el, id: uid(), x: el.x + 5, y: el.y + 5 } as AnyElement);
        });
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection.length) {
        e.preventDefault();
        actions.remove(state.selection);
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && state.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : e.ctrlKey ? 0.25 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        state.selection.forEach((id) => {
          const el = state.elements.find((x) => x.id === id);
          if (el) actions.update(id, { x: el.x + dx, y: el.y + dy } as Partial<AnyElement>);
        });
        return;
      }
      const map: Record<string, CanvasTool> = { v: "select", b: "booth", t: "text", m: "measure", f: "fence" };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
      if (e.key === "Escape") { setTool("select"); setLeftTab(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, state.selection, state.elements]);

  // Debounced auto-save
  useEffect(() => {
    if (!state.dirty) return;
    const h = window.setTimeout(async () => {
      setSaving(true);
      try {
        await onSave({ name: state.name, settings: state.settings, elements: state.elements });
        actions.markSaved();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to save");
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(h);
  }, [state.dirty, state.name, state.settings, state.elements, onSave, actions]);

  const manualSave = async () => {
    setSaving(true);
    try {
      await onSave({ name: state.name, settings: state.settings, elements: state.elements });
      actions.markSaved();
      toast.success("Layout saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  const setZoom = (delta: number) => {
    const vp = viewportRef.current;
    const next = Math.max(1, Math.min(60, vp.scale * delta));
    // recenter around 0
    viewportRef.current = { ...vp, scale: next };
    setZoomPct(Math.round(next * 100 / 4));
    // force re-render of canvas by touching a state (simple approach: nudge tool)
    setTool((t) => t);
  };

  const zoomToFit = () => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    const winW = Math.max(200, (rect?.width ?? window.innerWidth) - 60);
    const winH = Math.max(200, (rect?.height ?? window.innerHeight) - 60);
    if (state.elements.length === 0) {
      const scale = Math.max(1, Math.min(60, Math.min(winW / 120, winH / 90)));
      viewportRef.current = { x: -10, y: -10, scale };
      setZoomPct(Math.round(scale * 100 / 4));
      setTool((t) => t);
      return;
    }
    const xs = state.elements.flatMap((e) => [e.x, e.x + e.w]);
    const ys = state.elements.flatMap((e) => [e.y, e.y + e.h]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const pad = 0.1;
    const scale = Math.max(1, Math.min(60, Math.min(winW / (w * (1 + pad)), winH / (h * (1 + pad)))));
    viewportRef.current = { x: minX - w * pad / 2, y: minY - h * pad / 2, scale };
    setZoomPct(Math.round(scale * 100 / 4));
    setTool((t) => t);
  };


  const selectedCount = state.selection.length;
  const selectedName = useMemo(() => {
    if (selectedCount === 0) return "";
    if (selectedCount > 1) return `${selectedCount} objects`;
    const el = state.elements.find((e) => e.id === state.selection[0]);
    if (!el) return "";
    if (el.kind === "booth") return `Booth ${(el as any).label}`;
    return el.name ?? el.kind;
  }, [selectedCount, state.selection, state.elements]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden designer-desk">
      {/* Framed workspace — a centered "sheet on a desk" that clips the canvas */}
      <div
        ref={workspaceRef}
        className={cn(
          "absolute rounded-2xl border border-border/70 bg-card overflow-hidden",
          "shadow-[0_20px_60px_-20px_hsl(var(--foreground)/0.28),0_2px_6px_-2px_hsl(var(--foreground)/0.08)]",
          "transition-[right,left,top,bottom] duration-200 ease-out",
          "top-[68px] bottom-[60px] left-[68px]",
          rightOpen ? "right-[340px]" : "right-4",
        )}
      >
        <DesignerCanvas
          elements={state.elements}
          selection={state.selection}
          actions={actions}
          tool={tool}
          toolPayload={tool === "icon" ? { iconKey } : null}
          onZoomChange={setZoomPct}
          viewportRef={viewportRef}
          background={state.settings.background ?? null}
          bgSelected={bgSelected}
          cropMode={cropMode}
          onBgSelect={(sel) => { setBgSelected(sel); if (!sel) { setCropMode(false); setMapAdjust(false); } }}
          onBgChange={patchBg}
          mapInteractive={mapAdjust && bg?.kind === "google-satellite"}
          onMapViewportChange={onMapViewport}
        />

        {(cropMode || mapAdjust) && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-3">
            <div className="pointer-events-auto rounded-md border border-border/60 bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
              {cropMode
                ? "Drag the crop handles — click Done to apply"
                : "Adjusting map view — drag to pan · scroll to zoom"}
              <button
                className="ml-3 rounded px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-muted"
                onClick={() => { setCropMode(false); setMapAdjust(false); }}
              >Done</button>
            </div>
          </div>
        )}
      </div>



      {/* Top floating toolbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
          <Link to="/studio/venues" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Back to venues">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mx-1 h-5 w-px bg-border" />
          <input
            value={state.name}
            onChange={(e) => actions.setName(e.target.value)}
            className="h-8 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus:border-primary focus:outline-none"
            style={{ width: `${Math.max(state.name.length, 12)}ch` }}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">· {venueName}</span>
        </div>

        {/* Center: primary tool cluster */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-card/95 p-1 shadow-lg backdrop-blur">
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")} title="Select (V)"><MousePointer2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "booth"} onClick={() => setTool("booth")} title="Booth (B)"><Store className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => setTool("text")} title="Text (T)"><Type className="h-4 w-4" /></ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn active={tool === "road"} onClick={() => setTool("road" as CanvasTool)} title="Road"><RouteIcon className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "walkway"} onClick={() => setTool("walkway" as CanvasTool)} title="Walkway"><Footprints className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "building"} onClick={() => setTool("building" as CanvasTool)} title="Building"><Building2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "parking"} onClick={() => setTool("parking" as CanvasTool)} title="Parking"><ParkingSquare className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "measure"} onClick={() => setTool("measure" as CanvasTool)} title="Measurement (M)"><Ruler className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "table"} onClick={() => setTool("table" as CanvasTool)} title="Table"><Table2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "chair"} onClick={() => setTool("chair" as CanvasTool)} title="Chair"><Armchair className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "fence"} onClick={() => setTool("fence" as CanvasTool)} title="Fence (F)"><FenceIcon className="h-4 w-4" /></ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={() => setBgDialogOpen(true)} title="Add background / satellite map"><MapPin className="h-4 w-4" /></ToolBtn>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={actions.undo} disabled={state.past.length === 0} title="Undo (⌘Z)"><Undo2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={actions.redo} disabled={state.future.length === 0} title="Redo (⌘⇧Z)"><Redo2 className="h-4 w-4" /></ToolBtn>
        </div>

        {/* Right: save cluster */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {saving ? "Saving…" : state.dirty ? "Unsaved" : "Saved"}
          </span>
          <Button size="sm" onClick={manualSave} className="h-8">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save
          </Button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            title={rightOpen ? "Hide inspector" : "Show inspector"}
          >
            {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Left icon rail */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-start pt-20">
        <div className="pointer-events-auto ml-3 flex flex-col gap-1 rounded-xl border border-border/60 bg-card/95 p-1 shadow-lg backdrop-blur">
          <RailBtn active={leftTab === "objects"} onClick={() => setLeftTab((t) => t === "objects" ? null : "objects")} title="Objects"><Package className="h-4 w-4" /></RailBtn>
          <RailBtn active={leftTab === "layers"} onClick={() => setLeftTab((t) => t === "layers" ? null : "layers")} title="Layers"><LayersIcon className="h-4 w-4" /></RailBtn>
          <RailBtn active={leftTab === "search"} onClick={() => setLeftTab((t) => t === "search" ? null : "search")} title="Search"><Search className="h-4 w-4" /></RailBtn>
        </div>

        {/* Slide-over panel */}
        {leftTab && (
          <div className="pointer-events-auto ml-2 mt-0 flex h-[calc(100vh-8rem)] w-72 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {leftTab === "objects" ? "Object library" : leftTab === "layers" ? "Elements" : "Search"}
              </div>
              <button onClick={() => setLeftTab(null)} className="rounded p-1 hover:bg-muted" aria-label="Close">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {leftTab === "objects" && (
                <ObjectLibraryPanel
                  onPick={(kind, key) => {
                    if (kind === "icon" && key) { setIconKey(key as IconKey); setTool("icon"); }
                    else setTool(kind as CanvasTool);
                  }}
                  activeTool={tool}
                  activeIconKey={iconKey}
                />
              )}
              {leftTab === "layers" && (
                <ElementsListPanel
                  elements={state.elements}
                  selection={state.selection}
                  onSelect={(id) => actions.select([id])}
                  onToggleHidden={(id, hidden) => actions.update(id, { hidden } as any)}
                  onToggleLocked={(id, locked) => actions.update(id, { locked } as any)}
                />
              )}
              {leftTab === "search" && (
                <SearchPanel elements={state.elements} onSelect={(id) => actions.select([id])} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right contextual inspector — floating overlay */}
      {rightOpen && (
        <div className="pointer-events-auto absolute right-4 top-[68px] bottom-[60px] z-30 flex w-80 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedCount === 0 ? "Layout settings" : selectedName}
            </div>
            <button onClick={() => setRightOpen(false)} className="rounded p-1 hover:bg-muted" aria-label="Close">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Inspector
              elements={state.elements}
              selection={state.selection}
              actions={actions}
              settings={state.settings}
              name={state.name}
              onName={actions.setName}
              onSettings={actions.setSettings}
              background={state.settings.background ?? null}
              onBackgroundChange={(bg) => { actions.setSettings({ background: bg }); if (!bg) { setBgSelected(false); setCropMode(false); setMapAdjust(false); } }}
              venueId={venueId}
              organizationId={organizationId}
              bgSelected={bgSelected}
              onBgSelectChange={setBgSelected}
              cropMode={cropMode}
              onCropModeChange={setCropMode}
              mapAdjust={mapAdjust}
              onMapAdjustChange={setMapAdjust}
            />
          </div>
        </div>
      )}

      <AddBackgroundDialog
        open={bgDialogOpen}
        onOpenChange={setBgDialogOpen}
        venueId={venueId}
        organizationId={organizationId}
        onBackground={(bg) => actions.setSettings({ background: bg })}
      />

      {/* Bottom status bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur">
          <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted" onClick={() => setZoom(1 / 1.2)} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="tabular-nums w-12 text-center">{zoomPct}%</span>
          <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted" onClick={() => setZoom(1.2)} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-7 items-center gap-1 rounded px-2 hover:bg-muted" onClick={zoomToFit} title="Fit to content">
            <Maximize2 className="h-3.5 w-3.5" /> Fit
          </button>
          <div className="mx-2 h-4 w-px bg-border" />
          <span>{state.elements.length} object{state.elements.length === 1 ? "" : "s"}</span>
          {selectedCount > 0 && <><div className="mx-2 h-4 w-px bg-border" /><span>{selectedCount} selected</span></>}
          <div className="mx-2 h-4 w-px bg-border" />
          <span>ft · grid on</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function ToolBtn({ active, onClick, title, children, disabled }: {
  active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function RailBtn({ active, onClick, title, children }: { active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ObjectLibraryPanel({ onPick, activeTool, activeIconKey }: {
  onPick: (kind: string, iconKey?: string) => void;
  activeTool: CanvasTool;
  activeIconKey: IconKey;
}) {
  const shapes: Array<{ key: CanvasTool; label: string; icon: React.ReactNode }> = [
    { key: "booth", label: "Booth", icon: <Store className="h-4 w-4" /> },
    { key: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
    { key: "road" as CanvasTool, label: "Road", icon: <RouteIcon className="h-4 w-4" /> },
    { key: "walkway" as CanvasTool, label: "Walkway", icon: <Footprints className="h-4 w-4" /> },
    { key: "building" as CanvasTool, label: "Building", icon: <Building2 className="h-4 w-4" /> },
    { key: "parking" as CanvasTool, label: "Parking", icon: <ParkingSquare className="h-4 w-4" /> },
    { key: "measure" as CanvasTool, label: "Measure", icon: <Ruler className="h-4 w-4" /> },
    { key: "table" as CanvasTool, label: "Table", icon: <Table2 className="h-4 w-4" /> },
    { key: "chair" as CanvasTool, label: "Chair", icon: <Armchair className="h-4 w-4" /> },
    { key: "fence" as CanvasTool, label: "Fence", icon: <FenceIcon className="h-4 w-4" /> },
  ];
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Primitives</div>
        <div className="grid grid-cols-3 gap-2">
          {shapes.map((s) => (
            <button
              key={s.key}
              onClick={() => onPick(s.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border border-border p-2 text-[11px] transition hover:border-primary hover:bg-primary/5",
                activeTool === s.key && "border-primary bg-primary/10 text-primary",
              )}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Icons</div>
        <div className="grid grid-cols-3 gap-2">
          {ICONS.map((i) => (
            <button
              key={i.key}
              onClick={() => onPick("icon", i.key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border border-border p-2 text-[10px] transition hover:border-primary hover:bg-primary/5",
                activeTool === "icon" && activeIconKey === i.key && "border-primary bg-primary/10 text-primary",
              )}
              title={i.label}
            >
              <IconGlyph iconKey={i.key} size={20} />
              <span className="truncate w-full text-center">{i.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ElementsListPanel({
  elements, selection, onSelect, onToggleHidden, onToggleLocked,
}: {
  elements: AnyElement[];
  selection: string[];
  onSelect: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
}) {
  if (elements.length === 0) {
    return <div className="text-xs text-muted-foreground">No elements yet. Pick a tool and click on the canvas to add one.</div>;
  }
  return (
    <div className="space-y-1">
      {[...elements].reverse().map((el) => {
        const label = el.kind === "booth" ? `Booth ${(el as any).label}` : el.name ?? el.kind;
        const isSel = selection.includes(el.id);
        return (
          <div
            key={el.id}
            className={cn(
              "flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs",
              isSel ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-muted",
            )}
          >
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(el.id)}>
              {label}
            </button>
            <button
              onClick={() => onToggleHidden(el.id, !el.hidden)}
              className={cn("rounded px-1 text-[10px]", el.hidden ? "text-muted-foreground" : "text-foreground")}
              title={el.hidden ? "Show" : "Hide"}
            >
              {el.hidden ? "◌" : "●"}
            </button>
            <button
              onClick={() => onToggleLocked(el.id, !el.locked)}
              className={cn("rounded px-1 text-[10px]", el.locked ? "text-primary" : "text-muted-foreground")}
              title={el.locked ? "Unlock" : "Lock"}
            >
              {el.locked ? "🔒" : "🔓"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SearchPanel({ elements, onSelect }: { elements: AnyElement[]; onSelect: (id: string) => void; }) {
  const [q, setQ] = useState("");
  const matches = elements.filter((el) => {
    if (!q.trim()) return false;
    const s = q.toLowerCase();
    if (el.name?.toLowerCase().includes(s)) return true;
    if (el.kind === "booth" && String((el as any).label).toLowerCase().includes(s)) return true;
    if (el.kind === "text" && (el as any).text?.toLowerCase().includes(s)) return true;
    if (el.kind.includes(s)) return true;
    return false;
  });
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booths, labels, kinds…" className="h-8" />
      {q && matches.length === 0 && <div className="text-xs text-muted-foreground">No matches.</div>}
      <div className="space-y-1">
        {matches.map((el) => (
          <button
            key={el.id}
            onClick={() => onSelect(el.id)}
            className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted"
          >
            {el.kind === "booth" ? `Booth ${(el as any).label}` : el.name ?? el.kind}
          </button>
        ))}
      </div>
    </div>
  );
}
