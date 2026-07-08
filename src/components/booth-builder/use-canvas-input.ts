import { useCallback, useEffect, useRef, useState } from "react";

type PointerRef = {
  id: number;
  type: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
};

export type CanvasCoords = { x: number; y: number };

type Options = {
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number, focal: CanvasCoords) => void;
  /** Called when a *stable* single-finger drag begins on empty canvas / selected target */
  minZoom?: number;
  maxZoom?: number;
};

/**
 * Unified pointer input for the venue canvas.
 * Handles pinch-zoom, two-finger pan, and single-pointer pan on empty canvas.
 * Individual object dragging is handled by per-object pointer handlers so this
 * only fires when the gesture starts outside a target (empty canvas).
 *
 * Also implements palm rejection: when a pen pointer is active or was active
 * within 300ms, touch pointers are ignored.
 */
export function useCanvasInput(opts: Options) {
  const pointers = useRef<Map<number, PointerRef>>(new Map());
  const lastPenAt = useRef<number>(0);
  const pinchStartDist = useRef<number>(0);

  const isPalm = useCallback((type: string) => {
    if (type !== "touch") return false;
    return Date.now() - lastPenAt.current < 300;
  }, []);

  const svgPoint = useCallback((el: SVGSVGElement, clientX: number, clientY: number): CanvasCoords => {
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = el.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    if (isPalm(e.pointerType)) return;
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, {
      id: e.pointerId,
      type: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStartDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, [isPalm]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const prevX = p.x, prevY = p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.current.size === 2) {
      // Two-finger gesture: pan + pinch-zoom
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStartDist.current > 0) {
        const factor = dist / pinchStartDist.current;
        if (Math.abs(factor - 1) > 0.02) {
          const focalClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const svg = e.currentTarget as SVGSVGElement;
          const focal = svgPoint(svg, focalClient.x, focalClient.y);
          opts.onZoom(factor, focal);
          pinchStartDist.current = dist;
        }
      }
      // Pan by average delta
      const dx = ((a.x - prevX) + (b.x - prevX)) / 2;
      const dy = ((a.y - prevY) + (b.y - prevY)) / 2;
      opts.onPan(dx, dy);
      return;
    }

    if (pointers.current.size === 1) {
      // Single-finger pan on empty canvas
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      opts.onPan(dx, dy);
    }
  }, [opts, svgPoint]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStartDist.current = 0;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const svg = e.currentTarget as SVGSVGElement;
    const focal = svgPoint(svg, e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    opts.onZoom(factor, focal);
  }, [opts, svgPoint]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel, isPalm };
}

/**
 * Long-press detector for touch context menus. Fires after ~500ms if the
 * pointer hasn't moved more than 10px.
 */
export function useLongPress(onLongPress: (e: React.PointerEvent) => void, ms = 500) {
  const timerRef = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [suppressClick, setSuppressClick] = useState(false);

  const clear = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clear, []);

  return {
    suppressClick,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return; // right-click handles this on desktop
        start.current = { x: e.clientX, y: e.clientY };
        setSuppressClick(false);
        clear();
        timerRef.current = window.setTimeout(() => {
          setSuppressClick(true);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
          onLongPress(e);
        }, ms);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!start.current) return;
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      },
      onPointerUp: () => clear(),
      onPointerCancel: () => clear(),
    },
  };
}
