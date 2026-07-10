import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, SVGOverlay, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression, LeafletMouseEvent } from "leaflet";
import { ObjectShape } from "./panels";
import type { Basemap } from "./floating-zoom";

/**
 * Reference zoom level at which "one canvas unit ≈ one screen pixel".
 * Higher = more precision, less overshoot before hitting Leaflet's max zoom.
 */
export const REF_ZOOM = 20;

const BASEMAPS: Record<Basemap, { url: string; attribution: string; maxZoom: number } | null> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — World Imagery",
    maxZoom: 22,
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  blank: null,
};

export type MapCanvasProps = {
  centerLat: number | null;
  centerLng: number | null;
  mapZoom: number | null;
  canvasWidth: number;
  canvasHeight: number;
  basemap: Basemap;
  onZoomChange: (zoom: number) => void;
  onMapReady: (map: L.Map) => void;
  children: React.ReactNode;
  onCanvasClick: (pt: { x: number; y: number }) => void;
  tool: "select" | "pan" | "place";
  gridOn?: boolean;
  showObjectPointerEvents?: boolean;
};

/**
 * Full-viewport Leaflet map. An SVG overlay is anchored to a lat/lng bounding
 * box computed from the venue's center at REF_ZOOM so canvas pixel coordinates
 * map 1:1 to the overlay's viewBox.
 */
export function MapCanvas(props: MapCanvasProps) {
  const {
    centerLat, centerLng, mapZoom, canvasWidth, canvasHeight, basemap,
  } = props;

  const initialCenter = useMemo<[number, number]>(
    () => [centerLat ?? 40.7829, centerLng ?? -73.9654],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialZoom = mapZoom ?? 18;
  const bm = BASEMAPS[basemap];

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      minZoom={2}
      maxZoom={22}
      zoomControl={false}
      attributionControl
      className="h-full w-full !bg-muted"
      preferCanvas={false}
      style={{ background: basemap === "blank" ? "hsl(var(--muted))" : undefined }}
    >
      {bm && (
        <TileLayer
          key={basemap}
          url={bm.url}
          attribution={bm.attribution}
          maxNativeZoom={bm.maxZoom}
          maxZoom={22}
        />
      )}
      <MapController {...props} />
    </MapContainer>
  );
}

function MapController({
  centerLat, centerLng, canvasWidth, canvasHeight,
  onZoomChange, onMapReady, children, onCanvasClick, tool, gridOn, showObjectPointerEvents,
}: MapCanvasProps) {
  const map = useMap();
  const readyRef = useRef(false);

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onMapReady(map);
    }
    onZoomChange(map.getZoom());
  }, [map, onMapReady, onZoomChange]);

  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
    moveend: () => onZoomChange(map.getZoom()),
  });

  // Compute SVG overlay bounds so the viewBox (0..canvasWidth, 0..canvasHeight)
  // is anchored around the venue center at REF_ZOOM.
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const center = L.latLng(centerLat ?? map.getCenter().lat, centerLng ?? map.getCenter().lng);
    const centerPoint = map.project(center, REF_ZOOM);
    const half = L.point(canvasWidth / 2, canvasHeight / 2);
    const topLeft = map.unproject(centerPoint.subtract(half), REF_ZOOM);
    const bottomRight = map.unproject(centerPoint.add(half), REF_ZOOM);
    return [
      [topLeft.lat, topLeft.lng],
      [bottomRight.lat, bottomRight.lng],
    ];
  }, [centerLat, centerLng, canvasWidth, canvasHeight, map]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const svgToCanvas = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // Bind clicks on the map surface (falls through the transparent overlay
  // where nothing captured pointer events) for placement mode.
  useEffect(() => {
    const handler = (e: LeafletMouseEvent) => {
      if (tool !== "place") return;
      onCanvasClick({ x: 0, y: 0 }); // fallback; overlay click below is preferred
      void e;
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, tool, onCanvasClick]);

  return (
    <SVGOverlay
      bounds={bounds}
      attributes={{
        viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
        preserveAspectRatio: "none",
        style: "overflow: visible;",
      }}
    >
      <RefBinder svgRef={svgRef} />
      {/* Transparent hit rect for placement clicks */}
      <rect
        x={0} y={0} width={canvasWidth} height={canvasHeight}
        fill="transparent"
        style={{ pointerEvents: tool === "place" ? "auto" : "none", cursor: tool === "place" ? "crosshair" : "default" }}
        onClick={(e) => {
          if (tool !== "place") return;
          e.stopPropagation();
          const p = svgToCanvas(e.clientX, e.clientY);
          onCanvasClick(p);
        }}
      />
      {gridOn && (
        <g pointerEvents="none" opacity={0.35}>
          <defs>
            <pattern id="vd-grid" width={20} height={20} patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--foreground) / 0.25)" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="url(#vd-grid)" />
        </g>
      )}
      {/* Venue extent frame */}
      <rect
        x={0} y={0} width={canvasWidth} height={canvasHeight}
        fill="none" stroke="hsl(var(--primary) / 0.5)" strokeWidth={2}
        strokeDasharray="8 6" pointerEvents="none"
      />
      {children}
      {/* Small badge that objects will be interactive */}
      {!showObjectPointerEvents && null}
    </SVGOverlay>
  );
}

function RefBinder({ svgRef }: { svgRef: React.MutableRefObject<SVGSVGElement | null> }) {
  // react-leaflet gives us no ref on SVGOverlay; grab it from the parent DOM.
  useEffect(() => {
    // The SVG created by react-leaflet is our nearest ancestor <svg>.
    const check = () => {
      const svgs = document.querySelectorAll("svg.leaflet-image-layer, svg[data-vd-overlay], .leaflet-overlay-pane svg");
      const el = Array.from(svgs).pop() as SVGSVGElement | undefined;
      if (el) svgRef.current = el;
    };
    check();
  }, [svgRef]);
  return null;
}

/** Helper used from parent code to disable/enable map dragging during object drag. */
export function useMapDragToggle(map: L.Map | null) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!map) return;
    if (dragging) map.dragging.disable();
    else map.dragging.enable();
  }, [map, dragging]);
  return setDragging;
}

/** Render objects group (imported by parent). Kept as a re-export for symmetry. */
export { ObjectShape };
