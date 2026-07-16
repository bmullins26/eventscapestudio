import { useEffect, useRef, useState } from "react";

/**
 * Renders a live Google Maps satellite view. Two modes:
 *  - non-interactive: rendered at a fixed native pixel size, then CSS-scaled
 *    to the world bounding box. Tiles never reload on canvas pan/zoom.
 *  - interactive (adjust mode): the user drags/zooms the map itself; on idle
 *    we report the new center/zoom to the parent so the background layer's
 *    lat/lng/zoom (and world size in feet) can be updated.
 */
interface Props {
  lat: number;
  lng: number;
  zoom: number;
  pixelSize: number;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  rotation: number;
  opacity: number;
  interactive?: boolean;
  onViewportChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  /** Optional visual clip in fractions 0..1 of the layer's own box. */
  crop?: { x: number; y: number; w: number; h: number } | null;
}

let mapsLoadPromise: Promise<any> | null = null;

function loadMapsJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsLoadPromise) return mapsLoadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps browser key not configured"));

  mapsLoadPromise = new Promise((resolve, reject) => {
    const cbName = `__vdMapsInit_${Math.random().toString(36).slice(2)}`;
    (window as any)[cbName] = () => {
      try { resolve((window as any).google); } finally { delete (window as any)[cbName]; }
    };
    const s = document.createElement("script");
    const params = new URLSearchParams({ key, loading: "async", callback: cbName, libraries: "" });
    if (channel) params.set("channel", channel);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => { mapsLoadPromise = null; reject(new Error("Failed to load Google Maps JS")); };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

export function SatelliteMapLayer(props: Props) {
  const {
    lat, lng, zoom, pixelSize, screenX, screenY, screenW, screenH,
    rotation, opacity, interactive = false, onViewportChange,
  } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const idleListenerRef = useRef<any>(null);
  const onViewportRef = useRef(onViewportChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { onViewportRef.current = onViewportChange; }, [onViewportChange]);

  // Initialize map once.
  useEffect(() => {
    let cancelled = false;
    loadMapsJs()
      .then((g) => {
        if (cancelled || !hostRef.current || mapRef.current) return;
        const map = new g.maps.Map(hostRef.current, {
          center: { lat, lng },
          zoom,
          mapTypeId: g.maps.MapTypeId.SATELLITE,
          tilt: 0,
          disableDefaultUI: true,
          keyboardShortcuts: false,
          gestureHandling: "none",
          clickableIcons: false,
          disableDoubleClickZoom: true,
          draggable: false,
          scrollwheel: false,
          isFractionalZoomEnabled: false,
        });
        mapRef.current = map;
      })
      .catch((err) => !cancelled && setError(err?.message ?? "Map failed to load"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle interactivity + attach/detach idle handler.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({
      draggable: interactive,
      scrollwheel: interactive,
      disableDoubleClickZoom: !interactive,
      gestureHandling: interactive ? "greedy" : "none",
    });
    if (interactive && (window as any).google?.maps?.event) {
      idleListenerRef.current = (window as any).google.maps.event.addListener(map, "idle", () => {
        const c = map.getCenter();
        const z = map.getZoom();
        if (!c || typeof z !== "number") return;
        onViewportRef.current?.({ lat: c.lat(), lng: c.lng(), zoom: z });
      });
    } else if (idleListenerRef.current && (window as any).google?.maps?.event) {
      (window as any).google.maps.event.removeListener(idleListenerRef.current);
      idleListenerRef.current = null;
    }
    return () => {
      if (idleListenerRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
    };
  }, [interactive]);

  // Sync external changes to center/zoom (e.g. loading a new address). Skip
  // when values already match to avoid feedback loops with the idle handler.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    const eps = 1e-6;
    if (!c || Math.abs(c.lat() - lat) > eps || Math.abs(c.lng() - lng) > eps) {
      map.setCenter({ lat, lng });
    }
    if (z !== zoom) map.setZoom(zoom);
  }, [lat, lng, zoom]);

  const scaleX = screenW / pixelSize;
  const scaleY = screenH / pixelSize;

  if (error) {
    return (
      <div
        style={{
          position: "absolute", left: screenX, top: screenY, width: screenW, height: screenH,
          transform: `rotate(${rotation}deg)`, transformOrigin: "center",
          pointerEvents: "none", opacity,
          background: "hsl(var(--muted))", border: "1px dashed hsl(var(--destructive))",
          color: "hsl(var(--destructive))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
        }}
      >
        Satellite failed: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute", left: screenX, top: screenY, width: screenW, height: screenH,
        transform: `rotate(${rotation}deg)`, transformOrigin: "center",
        pointerEvents: interactive ? "auto" : "none",
        opacity, overflow: "hidden",
        outline: interactive ? "2px solid hsl(var(--primary))" : undefined,
      }}
    >
      <div
        ref={hostRef}
        style={{
          position: "absolute", top: 0, left: 0,
          width: pixelSize, height: pixelSize,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
