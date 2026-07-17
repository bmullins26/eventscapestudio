import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnyElement, BoothElement, TextElement, IconElement, BackgroundLayer } from "./types";
import type { DesignerActions } from "./store";
import { IconGlyph } from "./icon-glyph";
import { SatelliteMapLayer } from "./satellite-map-layer";

interface Viewport {
  x: number; // world coord at screen (0,0)
  y: number;
  scale: number; // pixels per world unit (foot)
}

export type CanvasTool =
  | "select"
  | "booth"
  | "text"
  | "icon"
  | "calibrate"
  | "road"
  | "walkway"
  | "building"
  | "parking"
  | "measure"
  | "table"
  | "chair"
  | "fence";

/** Per-object overlay rendered by the canvas in event mode. */
export interface CanvasOverlay {
  fill: string;
  stroke: string;
  badges: Array<{ id: string; glyph: string; label: string }>;
  tooltip: string;
}

export interface CanvasProps {
  elements: AnyElement[];
  selection: string[];
  actions: DesignerActions;
  tool: CanvasTool;
  toolPayload?: { iconKey?: string } | null;
  onZoomChange?: (pct: number) => void;
  viewportRef: React.MutableRefObject<Viewport>;
  background?: BackgroundLayer | null;
  onCalibrate?: (p1: { x: number; y: number }, p2: { x: number; y: number }) => void;
  mapInteractive?: boolean;
  onMapViewportChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  /** Base map treated as the currently selected layer. */
  bgSelected?: boolean;
  /** Crop editing overlay is active. */
  cropMode?: boolean;
  onBgChange?: (patch: Partial<BackgroundLayer>) => void;
  onBgSelect?: (selected: boolean) => void;
  /**
   * Optional per-object overlay for event mode. Keyed by `objectId` (the
   * persistent UUID on every element). When present, the canvas will:
   *   • override booth fill / stroke with the derived color
   *   • render badges inside the booth
   *   • surface a hover tooltip near the cursor with the tooltip string
   */
  overlayByObjectId?: Map<string, CanvasOverlay> | null;
}

// Screen -> world
const s2w = (sx: number, sy: number, vp: Viewport) => ({
  x: vp.x + sx / vp.scale,
  y: vp.y + sy / vp.scale,
});

const HANDLE_SIZE = 8; // screen px

type DragState =
  | { kind: "pan"; startX: number; startY: number; vp0: Viewport }
  | { kind: "move"; ids: string[]; startX: number; startY: number; orig: Map<string, { x: number; y: number }> }
  | { kind: "resize"; id: string; handle: string; startX: number; startY: number; orig: AnyElement }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; origRot: number }
  | { kind: "marquee"; startX: number; startY: number; x1: number; y1: number }
  | { kind: "bg-move"; startX: number; startY: number; orig: BackgroundLayer }
  | { kind: "bg-resize"; handle: string; startX: number; startY: number; orig: BackgroundLayer }
  | { kind: "bg-rotate"; cx: number; cy: number; startAngle: number; origRot: number }
  | { kind: "crop-move"; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number }; bg: BackgroundLayer }
  | { kind: "crop-resize"; handle: string; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number }; bg: BackgroundLayer }
  | null;

export function DesignerCanvas({ elements, selection, actions, tool, toolPayload, onZoomChange, viewportRef, background, onCalibrate, mapInteractive, onMapViewportChange, bgSelected = false, cropMode = false, onBgChange, onBgSelect, overlayByObjectId = null }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState<Viewport>(() => viewportRef.current);
  const [space, setSpace] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [calibratePt1, setCalibratePt1] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  /** Which object the mouse is currently over — drives the event-mode hover card. */
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** Screen-space cursor position for the hover card. */
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { viewportRef.current = vp; onZoomChange?.(Math.round(vp.scale * 100 / 4)); }, [vp, onZoomChange, viewportRef]);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Keyboard: space for pan
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditable(e.target)) { setSpace(true); e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Wheel zoom (cursor anchored)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldBefore = s2w(sx, sy, vp);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = Math.max(1, Math.min(60, vp.scale * factor));
    const nx = worldBefore.x - sx / newScale;
    const ny = worldBefore.y - sy / newScale;
    setVp({ x: nx, y: ny, scale: newScale });
  };

  const worldFromEvent = (e: React.PointerEvent | PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return s2w(e.clientX - rect.left, e.clientY - rect.top, vp);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!containerRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse or space: pan
    if (e.button === 1 || space || (e.button === 0 && (e.altKey))) {
      setDrag({ kind: "pan", startX: sx, startY: sy, vp0: vp });
      return;
    }

    // Background layer interactions when it is the selected layer or in crop mode.
    if (background && (bgSelected || cropMode)) {
      const target = e.target as Element;
      const bgHandle = target.closest("[data-bg-handle]")?.getAttribute("data-bg-handle");
      const bgRotate = target.closest("[data-bg-rotate]")?.getAttribute("data-bg-rotate");
      const bgBody = target.closest("[data-bg-body]")?.getAttribute("data-bg-body");
      const cropHandle = target.closest("[data-crop-handle]")?.getAttribute("data-crop-handle");
      const cropBody = target.closest("[data-crop-body]")?.getAttribute("data-crop-body");

      if (cropMode) {
        const crop = background.crop ?? { x: 0, y: 0, w: 1, h: 1 };
        if (cropHandle) {
          setDrag({ kind: "crop-resize", handle: cropHandle, startX: sx, startY: sy, orig: { ...crop }, bg: background });
          return;
        }
        if (cropBody) {
          setDrag({ kind: "crop-move", startX: sx, startY: sy, orig: { ...crop }, bg: background });
          return;
        }
        return;
      }

      // bgSelected mode — always allow rotate/resize/move handles.
      if (!background.locked) {
        if (bgRotate) {
          const cx = background.x + background.w / 2;
          const cy = background.y + background.h / 2;
          const w = s2w(sx, sy, vp);
          const startAngle = Math.atan2(w.y - cy, w.x - cx) * 180 / Math.PI;
          setDrag({ kind: "bg-rotate", cx, cy, startAngle, origRot: background.rotation });
          return;
        }
        if (bgHandle) {
          setDrag({ kind: "bg-resize", handle: bgHandle, startX: sx, startY: sy, orig: { ...background } });
          return;
        }
        // Body drag: for satellite this pans the layer in world space, unless
        // the internal map is in "adjust map view" mode where the map itself
        // consumes gestures.
        if (bgBody && !mapInteractive) {
          setDrag({ kind: "bg-move", startX: sx, startY: sy, orig: { ...background } });
          return;
        }
      }
      // fall through — allow element hit-testing / marquee below
    }

    // Calibrate tool: record two clicks, then invoke onCalibrate.
    if (tool === "calibrate" && e.button === 0) {
      const w = s2w(sx, sy, vp);
      if (!calibratePt1) {
        setCalibratePt1({ x: w.x, y: w.y });
      } else {
        onCalibrate?.(calibratePt1, { x: w.x, y: w.y });
        setCalibratePt1(null);
      }
      return;
    }

    // Placement tool: create element at cursor
    if (tool !== "select" && e.button === 0) {
      const w = s2w(sx, sy, vp);
      const step = e.altKey ? 0 : e.shiftKey ? 5 : 1;
      const wx = step > 0 ? snap(w.x, step) : w.x;
      const wy = step > 0 ? snap(w.y, step) : w.y;
      const factory = (globalThis as any).__vdFactory as ((tool: string, x: number, y: number, extra?: any) => AnyElement) | undefined;
      const el = factory ? factory(tool, wx, wy, toolPayload) : null;
      if (el) actions.add(el);
      return;
    }

    // Hit test
    const target = e.target as Element;
    const idAttr = target.closest("[data-el-id]")?.getAttribute("data-el-id");
    const handleAttr = target.closest("[data-handle]")?.getAttribute("data-handle");
    const rotateAttr = target.closest("[data-rotate]")?.getAttribute("data-rotate");

    if (rotateAttr && selection.includes(rotateAttr)) {
      const el = elements.find((x) => x.id === rotateAttr)!;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const w = s2w(sx, sy, vp);
      const startAngle = Math.atan2(w.y - cy, w.x - cx) * 180 / Math.PI;
      setDrag({ kind: "rotate", id: rotateAttr, cx, cy, startAngle, origRot: el.rotation });
      return;
    }
    if (handleAttr && selection[0]) {
      const el = elements.find((x) => x.id === selection[0]);
      if (el) { setDrag({ kind: "resize", id: el.id, handle: handleAttr, startX: sx, startY: sy, orig: { ...el } }); return; }
    }
    if (idAttr) {
      if (bgSelected) onBgSelect?.(false);
      const already = selection.includes(idAttr);
      if (!already) actions.select(e.shiftKey ? [...selection, idAttr] : [idAttr]);
      const ids = already ? selection : e.shiftKey ? [...selection, idAttr] : [idAttr];
      const orig = new Map(ids.map((id) => {
        const el = elements.find((x) => x.id === id)!;
        return [id, { x: el.x, y: el.y }] as const;
      }));
      setDrag({ kind: "move", ids, startX: sx, startY: sy, orig });
      return;
    }

    // Empty click. If background exists, is unlocked, and cursor is inside its
    // rotated bounds, select the base map as the active layer. Otherwise clear.
    if (background && !background.hidden && !background.locked && !cropMode) {
      const w = s2w(sx, sy, vp);
      const cx = background.x + background.w / 2;
      const cy = background.y + background.h / 2;
      const rad = -(background.rotation * Math.PI) / 180;
      const rx = Math.cos(rad) * (w.x - cx) - Math.sin(rad) * (w.y - cy) + cx;
      const ry = Math.sin(rad) * (w.x - cx) + Math.cos(rad) * (w.y - cy) + cy;
      if (rx >= background.x && rx <= background.x + background.w && ry >= background.y && ry <= background.y + background.h) {
        actions.select([]);
        if (!bgSelected) onBgSelect?.(true);
        if (!mapInteractive) {
          setDrag({ kind: "bg-move", startX: sx, startY: sy, orig: { ...background } });
        }
        return;
      }
    }
    if (bgSelected) onBgSelect?.(false);
    actions.select([]);
    setDrag({ kind: "marquee", startX: sx, startY: sy, x1: sx, y1: sy });
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Track hover for the event-mode hover card whenever we're not dragging.
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!drag) {
        const target = e.target as SVGElement | null;
        const elGroup = target?.closest?.("[data-el-id]") as SVGElement | null;
        setHoverId(elGroup?.getAttribute("data-el-id") ?? null);
      }
    }
    if (!drag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (drag.kind === "pan") {
      const dx = (sx - drag.startX) / vp.scale;
      const dy = (sy - drag.startY) / vp.scale;
      setVp({ ...drag.vp0, x: drag.vp0.x - dx, y: drag.vp0.y - dy });
    } else if (drag.kind === "move") {
      const dx = (sx - drag.startX) / vp.scale;
      const dy = (sy - drag.startY) / vp.scale;
      for (const id of drag.ids) {
        const o = drag.orig.get(id)!;
        actions.update(id, { x: snap(o.x + dx, e.shiftKey ? 5 : 1), y: snap(o.y + dy, e.shiftKey ? 5 : 1) } as Partial<AnyElement>);
      }
    } else if (drag.kind === "resize") {
      const dx = (sx - drag.startX) / vp.scale;
      const dy = (sy - drag.startY) / vp.scale;
      const o = drag.orig;
      let { x, y, w, h } = o;
      if (drag.handle.includes("e")) w = Math.max(1, o.w + dx);
      if (drag.handle.includes("s")) h = Math.max(1, o.h + dy);
      if (drag.handle.includes("w")) { w = Math.max(1, o.w - dx); x = o.x + (o.w - w); }
      if (drag.handle.includes("n")) { h = Math.max(1, o.h - dy); y = o.y + (o.h - h); }
      actions.update(drag.id, { x, y, w, h } as Partial<AnyElement>);
    } else if (drag.kind === "rotate") {
      const w = s2w(sx, sy, vp);
      const angle = Math.atan2(w.y - drag.cy, w.x - drag.cx) * 180 / Math.PI;
      let next = drag.origRot + (angle - drag.startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      actions.update(drag.id, { rotation: next } as Partial<AnyElement>);
    } else if (drag.kind === "bg-move") {
      const dx = (sx - drag.startX) / vp.scale;
      const dy = (sy - drag.startY) / vp.scale;
      onBgChange?.({ x: drag.orig.x + dx, y: drag.orig.y + dy });
    } else if (drag.kind === "bg-resize") {
      const dx = (sx - drag.startX) / vp.scale;
      const dy = (sy - drag.startY) / vp.scale;
      const o = drag.orig;
      let { x, y, w, h } = o;
      if (drag.handle.includes("e")) w = Math.max(1, o.w + dx);
      if (drag.handle.includes("s")) h = Math.max(1, o.h + dy);
      if (drag.handle.includes("w")) { w = Math.max(1, o.w - dx); x = o.x + (o.w - w); }
      if (drag.handle.includes("n")) { h = Math.max(1, o.h - dy); y = o.y + (o.h - h); }
      onBgChange?.({ x, y, w, h });
    } else if (drag.kind === "bg-rotate") {
      const w = s2w(sx, sy, vp);
      const angle = Math.atan2(w.y - drag.cy, w.x - drag.cx) * 180 / Math.PI;
      let next = drag.origRot + (angle - drag.startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      onBgChange?.({ rotation: next });
    } else if (drag.kind === "crop-move") {
      const dxF = (sx - drag.startX) / vp.scale / drag.bg.w;
      const dyF = (sy - drag.startY) / vp.scale / drag.bg.h;
      const nx = Math.min(1 - drag.orig.w, Math.max(0, drag.orig.x + dxF));
      const ny = Math.min(1 - drag.orig.h, Math.max(0, drag.orig.y + dyF));
      onBgChange?.({ crop: { x: nx, y: ny, w: drag.orig.w, h: drag.orig.h } });
    } else if (drag.kind === "crop-resize") {
      const dxF = (sx - drag.startX) / vp.scale / drag.bg.w;
      const dyF = (sy - drag.startY) / vp.scale / drag.bg.h;
      const o = drag.orig;
      let { x, y, w, h } = o;
      const min = 0.02;
      if (drag.handle.includes("e")) w = Math.min(1 - o.x, Math.max(min, o.w + dxF));
      if (drag.handle.includes("s")) h = Math.min(1 - o.y, Math.max(min, o.h + dyF));
      if (drag.handle.includes("w")) {
        const nx = Math.max(0, Math.min(o.x + o.w - min, o.x + dxF));
        w = o.x + o.w - nx; x = nx;
      }
      if (drag.handle.includes("n")) {
        const ny = Math.max(0, Math.min(o.y + o.h - min, o.y + dyF));
        h = o.y + o.h - ny; y = ny;
      }
      onBgChange?.({ crop: { x, y, w, h } });
    } else if (drag.kind === "marquee") {
      setDrag({ ...drag, x1: sx, y1: sy });
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    if (drag?.kind === "marquee") {
      const x0 = Math.min(drag.startX, drag.x1); const y0 = Math.min(drag.startY, drag.y1);
      const x1 = Math.max(drag.startX, drag.x1); const y1 = Math.max(drag.startY, drag.y1);
      if (Math.abs(x1 - x0) > 2 && Math.abs(y1 - y0) > 2) {
        const a = s2w(x0, y0, vp); const b = s2w(x1, y1, vp);
        const inside = elements.filter((el) => !el.hidden && !el.locked && el.x >= a.x && el.y >= a.y && el.x + el.w <= b.x && el.y + el.h <= b.y).map((e) => e.id);
        actions.select(inside);
      }
    }
    setDrag(null);
  };

  const gridMinor = 5; // ft
  const gridMajor = 10;

  const cursor = drag?.kind === "pan" ? "grabbing" : space ? "grab" : tool !== "select" ? "crosshair" : "default";

  const startEditing = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el || el.locked) return;
    const current = el.kind === "text" ? el.text : (el.name ?? (el.kind === "booth" ? el.label : ""));
    setEditingId(id);
    setEditingValue(current);
  };
  const commitEdit = () => {
    if (!editingId) return;
    const el = elements.find((e) => e.id === editingId);
    if (el) {
      const v = editingValue.trim();
      if (el.kind === "text") actions.update(el.id, { text: v || "Label" } as Partial<AnyElement>);
      else actions.update(el.id, { name: v } as Partial<AnyElement>);
    }
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  // F2 keyboard shortcut for renaming the current selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inEditable = t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
      if (inEditable) return;
      if (e.key === "F2" && selection.length === 1) {
        e.preventDefault();
        startEditing(selection[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, elements]);

  useLayoutEffect(() => {
    if (editingId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingId]);

  const onDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const idAttr = (e.target as Element).closest("[data-el-id]")?.getAttribute("data-el-id");
    if (idAttr) startEditing(idAttr);
  };

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor }}
      className="relative h-full w-full overflow-hidden bg-muted/40 touch-none select-none"
    >
      {/* Live Google Maps satellite layer (behind SVG). Rendered when the
          background is a "google-satellite" kind. Pointer-events disabled so
          the SVG above handles all input. */}
      {background && !background.hidden && background.kind === "google-satellite" &&
        typeof background.meta?.lat === "number" &&
        typeof background.meta?.lng === "number" && (() => {
        const bx = (background.x - vp.x) * vp.scale;
        const by = (background.y - vp.y) * vp.scale;
        const bw = background.w * vp.scale;
        const bh = background.h * vp.scale;
        return (
          <SatelliteMapLayer
            lat={background.meta.lat!}
            lng={background.meta.lng!}
            zoom={background.meta.zoom ?? 19}
            pixelSize={1024}
            screenX={bx}
            screenY={by}
            screenW={bw}
            screenH={bh}
            rotation={background.rotation}
            opacity={background.opacity}
            interactive={!!mapInteractive}
            onViewportChange={onMapViewportChange}
            crop={background.crop ?? null}
          />
        );
      })()}

      <svg width={size.w} height={size.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="vd-grid-minor" x={0} y={0} width={gridMinor * vp.scale} height={gridMinor * vp.scale} patternUnits="userSpaceOnUse" patternTransform={`translate(${-vp.x * vp.scale % (gridMinor * vp.scale)}, ${-vp.y * vp.scale % (gridMinor * vp.scale)})`}>
            <path d={`M ${gridMinor * vp.scale} 0 L 0 0 0 ${gridMinor * vp.scale}`} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.5} />
          </pattern>
          <pattern id="vd-grid-major" x={0} y={0} width={gridMajor * vp.scale} height={gridMajor * vp.scale} patternUnits="userSpaceOnUse" patternTransform={`translate(${-vp.x * vp.scale % (gridMajor * vp.scale)}, ${-vp.y * vp.scale % (gridMajor * vp.scale)})`}>
            <path d={`M ${gridMajor * vp.scale} 0 L 0 0 0 ${gridMajor * vp.scale}`} fill="none" stroke="hsl(var(--border))" strokeWidth={1} opacity={0.8} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={size.w} height={size.h} fill="url(#vd-grid-minor)" />
        <rect x={0} y={0} width={size.w} height={size.h} fill="url(#vd-grid-major)" />

        {/* Background reference layer (raster image kinds — behind elements) */}
        {background && !background.hidden && background.kind !== "google-satellite" && background.url && (() => {
          const bx = (background.x - vp.x) * vp.scale;
          const by = (background.y - vp.y) * vp.scale;
          const bw = background.w * vp.scale;
          const bh = background.h * vp.scale;
          const cx = bx + bw / 2;
          const cy = by + bh / 2;
          const crop = background.crop;
          const clipId = crop ? `vd-bg-clip-${Math.round(bx)}-${Math.round(by)}` : null;
          return (
            <g transform={`rotate(${background.rotation} ${cx} ${cy})`} style={{ pointerEvents: "none" }}>
              {crop && clipId && (
                <defs>
                  <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                    <rect x={bx + crop.x * bw} y={by + crop.y * bh} width={crop.w * bw} height={crop.h * bh} />
                  </clipPath>
                </defs>
              )}
              <g clipPath={clipId ? `url(#${clipId})` : undefined}>
                <image
                  href={background.url}
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  opacity={background.opacity}
                  preserveAspectRatio="none"
                />
              </g>
              {background.kind === "satellite" && (
                <text x={bx + 6} y={by + bh - 6} fontSize={10} fill="#fff" stroke="#000" strokeWidth={0.3}
                  style={{ pointerEvents: "none" }}>Imagery ©Google</text>
              )}
            </g>
          );
        })()}

        <g transform={`scale(${vp.scale}) translate(${-vp.x} ${-vp.y})`}>
          {elements.map((el) => el.hidden ? null : (
            <ElementNode
              key={el.id}
              el={el}
              selected={selection.includes(el.id)}
              vpScale={vp.scale}
              overlay={overlayByObjectId?.get(el.objectId) ?? null}
            />
          ))}
        </g>

        {/* Calibration guide overlay */}
        {tool === "calibrate" && calibratePt1 && (() => {
          const p1x = (calibratePt1.x - vp.x) * vp.scale;
          const p1y = (calibratePt1.y - vp.y) * vp.scale;
          return <circle cx={p1x} cy={p1y} r={5} fill="hsl(var(--primary))" />;
        })()}

        {/* Selection handles overlay (screen space) */}
        {selection.length === 1 && (() => {
          const el = elements.find((e) => e.id === selection[0]);
          if (!el) return null;
          const x = (el.x - vp.x) * vp.scale;
          const y = (el.y - vp.y) * vp.scale;
          const w = el.w * vp.scale;
          const h = el.h * vp.scale;
          const handles = [
            ["nw", x, y], ["n", x + w / 2, y], ["ne", x + w, y],
            ["e", x + w, y + h / 2], ["se", x + w, y + h],
            ["s", x + w / 2, y + h], ["sw", x, y + h], ["w", x, y + h / 2],
          ] as const;
          const cx = x + w / 2; const cy = y + h / 2;
          return (
            <g transform={`rotate(${el.rotation} ${cx} ${cy})`} pointerEvents="all">
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" />
              <line x1={cx} y1={y} x2={cx} y2={y - 24} stroke="hsl(var(--primary))" strokeWidth={1.5} />
              <circle data-rotate={el.id} cx={cx} cy={y - 28} r={6} fill="hsl(var(--primary))" style={{ cursor: "grab" }} />
              {handles.map(([k, hx, hy]) => (
                <rect key={k} data-handle={k} x={hx - HANDLE_SIZE / 2} y={hy - HANDLE_SIZE / 2} width={HANDLE_SIZE} height={HANDLE_SIZE}
                  fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5}
                  style={{ cursor: cursorForHandle(k as string) }} />
              ))}
            </g>
          );
        })()}

        {/* Background adjust frame (screen space, rotates with bg) */}
        {bgSelected && !cropMode && background && !background.hidden && (() => {
          const bx = (background.x - vp.x) * vp.scale;
          const by = (background.y - vp.y) * vp.scale;
          const bw = background.w * vp.scale;
          const bh = background.h * vp.scale;
          const cx = bx + bw / 2; const cy = by + bh / 2;
          const locked = background.locked;
          const handles = [
            ["nw", bx, by], ["n", bx + bw / 2, by], ["ne", bx + bw, by],
            ["e", bx + bw, by + bh / 2], ["se", bx + bw, by + bh],
            ["s", bx + bw / 2, by + bh], ["sw", bx, by + bh], ["w", bx, by + bh / 2],
          ] as const;
          return (
            <g transform={`rotate(${background.rotation} ${cx} ${cy})`} pointerEvents="all">
              {!locked && !mapInteractive && (
                <rect data-bg-body="1" x={bx} y={by} width={bw} height={bh}
                  fill="transparent" style={{ cursor: "move" }} />
              )}
              <rect x={bx} y={by} width={bw} height={bh}
                fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="6 4"
                pointerEvents="none" />
              {!locked && (
                <>
                  <line x1={cx} y1={by} x2={cx} y2={by - 24} stroke="hsl(var(--primary))" strokeWidth={1.5} pointerEvents="none" />
                  <circle data-bg-rotate="1" cx={cx} cy={by - 28} r={7} fill="hsl(var(--primary))" style={{ cursor: "grab" }} />
                </>
              )}
              {!locked && handles.map(([k, hx, hy]) => (
                <rect key={k} data-bg-handle={k} x={hx - HANDLE_SIZE / 2} y={hy - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE} height={HANDLE_SIZE}
                  fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5}
                  style={{ cursor: cursorForHandle(k as string) }} />
              ))}
            </g>
          );
        })()}

        {/* Crop overlay (screen space, rotates with bg) */}
        {cropMode && background && (() => {
          const bx = (background.x - vp.x) * vp.scale;
          const by = (background.y - vp.y) * vp.scale;
          const bw = background.w * vp.scale;
          const bh = background.h * vp.scale;
          const cx = bx + bw / 2; const cy = by + bh / 2;
          const crop = background.crop ?? { x: 0, y: 0, w: 1, h: 1 };
          const cx0 = bx + crop.x * bw;
          const cy0 = by + crop.y * bh;
          const cw = crop.w * bw;
          const ch = crop.h * bh;
          const maskId = `vd-crop-mask-${Math.round(bx)}-${Math.round(by)}`;
          const handles = [
            ["nw", cx0, cy0], ["n", cx0 + cw / 2, cy0], ["ne", cx0 + cw, cy0],
            ["e", cx0 + cw, cy0 + ch / 2], ["se", cx0 + cw, cy0 + ch],
            ["s", cx0 + cw / 2, cy0 + ch], ["sw", cx0, cy0 + ch], ["w", cx0, cy0 + ch / 2],
          ] as const;
          return (
            <g transform={`rotate(${background.rotation} ${cx} ${cy})`} pointerEvents="all">
              <defs>
                <mask id={maskId}>
                  <rect x={bx} y={by} width={bw} height={bh} fill="white" />
                  <rect x={cx0} y={cy0} width={cw} height={ch} fill="black" />
                </mask>
              </defs>
              <rect x={bx} y={by} width={bw} height={bh}
                fill="hsl(var(--background) / 0.6)" mask={`url(#${maskId})`} pointerEvents="none" />
              <rect data-crop-body="1" x={cx0} y={cy0} width={cw} height={ch}
                fill="transparent" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="6 4"
                style={{ cursor: "move" }} />
              {handles.map(([k, hx, hy]) => (
                <rect key={k} data-crop-handle={k} x={hx - HANDLE_SIZE / 2} y={hy - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE} height={HANDLE_SIZE}
                  fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5}
                  style={{ cursor: cursorForHandle(k as string) }} />
              ))}
            </g>
          );
        })()}

        {/* Marquee */}
        {drag?.kind === "marquee" && (
          <rect
            x={Math.min(drag.startX, drag.x1)} y={Math.min(drag.startY, drag.y1)}
            width={Math.abs(drag.x1 - drag.startX)} height={Math.abs(drag.y1 - drag.startY)}
            fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeDasharray="4 2"
          />
        )}
      </svg>

      {/* Inline rename overlay (HTML input positioned over the element) */}
      {editingId && (() => {
        const el = elements.find((e) => e.id === editingId);
        if (!el) return null;
        const sx = (el.x - vp.x) * vp.scale;
        const sy = (el.y - vp.y) * vp.scale;
        const sw = Math.max(80, el.w * vp.scale);
        const sh = el.h * vp.scale;
        // Place the input just below the element (or centered inside a booth).
        const top = el.kind === "booth" ? sy + sh / 2 - 12 : sy + sh + 4;
        return (
          <input
            ref={editingInputRef}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            placeholder={el.kind === "booth" ? "Booth name (e.g. Kate's Pretzels)" : "Name"}
            className="absolute z-30 rounded-md border border-primary/70 bg-card px-2 py-1 text-xs font-medium shadow-lg outline-none focus:ring-2 focus:ring-primary"
            style={{ left: sx, top, width: sw, minWidth: 120 }}
          />
        );
      })()}
    </div>
  );
}

function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function cursorForHandle(k: string): string {
  return ({
    n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
    nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  } as Record<string, string>)[k] ?? "pointer";
}

function ElementNode({ el, selected, vpScale }: { el: AnyElement; selected: boolean; vpScale: number }) {
  const cx = el.x + el.w / 2; const cy = el.y + el.h / 2;
  const transform = el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined;
  const commonProps: any = { "data-el-id": el.id, transform, style: { cursor: el.locked ? "not-allowed" : "move" } };
  const highlight = selected ? { filter: "drop-shadow(0 0 2px hsl(var(--primary)))" } : {};

  if (el.kind === "booth") return renderBooth(el, commonProps, highlight, vpScale);
  if (el.kind === "text") return renderText(el, commonProps, highlight);
  if (el.kind === "icon") return renderIcon(el, commonProps, highlight, vpScale);
  return null;
}

/**
 * Auto-fitting label below an element. Uses SVG `textLength` so long names
 * shrink horizontally to fit within the element's world-space width. Hidden
 * at very small on-screen sizes to avoid clutter.
 */
function ElementLabel({ el, vpScale }: { el: AnyElement; vpScale: number }) {
  const name = el.name?.trim();
  if (!name) return null;
  const screenW = el.w * vpScale;
  if (screenW < 24) return null;
  const worldFont = 14 / Math.max(vpScale, 0.0001);
  // Sit the label right up against the element (small screen-space gap ~2px).
  const gap = 2 / Math.max(vpScale, 0.0001);
  const y = el.y + el.h + gap;
  const fill = (el as { labelColor?: string }).labelColor ?? "hsl(var(--foreground))";
  const commonText = {
    x: el.x + el.w / 2,
    y,
    fontSize: worldFont,
    fontWeight: 700,
    textAnchor: "middle" as const,
    dominantBaseline: "hanging" as const,
  };
  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Halo outline for legibility over map imagery */}
      <text
        {...commonText}
        fill="none"
        stroke="hsl(var(--background))"
        strokeWidth={worldFont * 0.35}
        strokeLinejoin="round"
        style={{ paintOrder: "stroke" }}
      >
        {name}
      </text>
      <text {...commonText} fill={fill}>
        {name}
      </text>
    </g>
  );
}

function renderBooth(el: BoothElement, common: any, hl: any, vpScale: number) {
  const dash = el.strokeStyle === "dashed" ? "1 0.6" : undefined;
  const name = el.name?.trim();
  const canFitName = !!name && el.h >= el.fontSize * 2.2;
  const nameFont = Math.min(el.fontSize * 0.7, 10 / Math.max(vpScale, 0.0001));
  const labelFill = (el as { labelColor?: string }).labelColor ?? "hsl(var(--foreground))";
  return (
    <g {...common}>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius} ry={el.radius}
        fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeDasharray={dash} style={hl} />
      <text x={el.x + el.w / 2} y={canFitName ? el.y + el.h * 0.38 : el.y + el.h / 2}
        fontSize={el.fontSize} fontWeight={el.fontWeight}
        textAnchor="middle" dominantBaseline="central" fill={labelFill}
        style={{ pointerEvents: "none" }}>
        {el.label}
      </text>
      {canFitName && (
        <>
          <text
            x={el.x + el.w / 2}
            y={el.y + el.h * 0.72}
            fontSize={nameFont}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
            fill="none"
            stroke="hsl(var(--background))"
            strokeWidth={nameFont * 0.35}
            strokeLinejoin="round"
            style={{ pointerEvents: "none", paintOrder: "stroke" }}
          >
            {name}
          </text>
          <text
            x={el.x + el.w / 2}
            y={el.y + el.h * 0.72}
            fontSize={nameFont}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
            fill={labelFill}
            style={{ pointerEvents: "none" }}
          >
            {name}
          </text>
        </>
      )}
      {name && !canFitName && <ElementLabel el={el} vpScale={vpScale} />}
    </g>
  );
}



function renderText(el: TextElement, common: any, hl: any) {
  return (
    <g {...common}>
      <text x={el.x} y={el.y + el.fontSize} fontSize={el.fontSize} fontWeight={el.fontWeight} fill={el.color} style={hl}>
        {el.text}
      </text>
    </g>
  );
}

function renderIcon(el: IconElement, common: any, hl: any, vpScale: number) {
  return (
    <g {...common} style={{ ...common.style, ...hl }}>
      <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}>
        <div style={{ width: "100%", height: "100%", color: el.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconGlyph iconKey={el.iconKey} size={Math.min(el.w, el.h) * vpScale} color={el.tint} />
        </div>
      </foreignObject>
      <ElementLabel el={el} vpScale={vpScale} />
    </g>
  );
}
