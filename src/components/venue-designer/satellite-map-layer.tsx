import { useEffect, useRef, useState } from "react";

/**
 * Renders a live Google Maps satellite view at a fixed native pixel size,
 * positioned/scaled/rotated via CSS transform to match a world-space
 * bounding box on the designer canvas. Because we never resize the map
 * container, Google's tile system stays stable — canvas zoom/pan is
 * purely a CSS transform of the already-loaded map.
 */
interface Props {
  lat: number;
  lng: number;
  zoom: number;
  /** Native CSS pixel size the map is rendered at (must match server's mapPixelSize). */
  pixelSize: number;
  /** Screen-space placement of the layer's top-left corner. */
  screenX: number;
  screenY: number;
  /** Screen-space dimensions to display the map at (after CSS scale). */
  screenW: number;
  screenH: number;
  /** Degrees, clockwise. */
  rotation: number;
  opacity: number;
}

// Load the Maps JS API once, module-scoped.
let mapsLoadPromise: Promise<typeof google> | null = null;

function loadMapsJs(): Promise<typeof google> {
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
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: cbName,
      libraries: "",
    });
    if (channel) params.set("channel", channel);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps JS"));
    };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

export function SatelliteMapLayer(props: Props) {
  const { lat, lng, zoom, pixelSize, screenX, screenY, screenW, screenH, rotation, opacity } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  // One-time init.
  useEffect(() => {
    let cancelled = false;
    loadMapsJs()
      .then((g) => {
        if (cancelled || !hostRef.current) return;
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
    // Recreate on center/zoom change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom]);

  // Keep the map center/zoom current if props change without unmount.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter({ lat, lng });
    mapRef.current.setZoom(zoom);
  }, [lat, lng, zoom]);

  const scaleX = screenW / pixelSize;
  const scaleY = screenH / pixelSize;

  if (error) {
    return (
      <div
        style={{
          position: "absolute",
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center",
          pointerEvents: "none",
          opacity,
          background: "hsl(var(--muted))",
          border: "1px dashed hsl(var(--destructive))",
          color: "hsl(var(--destructive))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
        }}
      >
        Satellite failed: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center",
        pointerEvents: "none",
        opacity,
        overflow: "hidden",
      }}
    >
      <div
        ref={hostRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: pixelSize,
          height: pixelSize,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
