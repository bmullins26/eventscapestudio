import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, SVGOverlay, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { Basemap } from "./floating-zoom";

/**
 * Reference zoom level: "one canvas unit ≈ one screen pixel" at this Leaflet zoom.
 */
export const REF_ZOOM = 20;

const BASEMAPS: Record<Basemap, { url: string; attribution: string; maxNativeZoom: number } | null> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — World Imagery",
    maxNativeZoom: 19,
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxNativeZoom: 19,
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
  onCanvasClick: (pt: { x: number; y: number }) => void;
  tool: "select" | "pan" | "place";
  gridOn?: boolean;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  children: React.ReactNode;
};

export default function MapCanvas(props: MapCanvasProps) {
  const { centerLat, centerLng, mapZoom, basemap } = props;

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
      className="h-full w-full"
      style={{ background: basemap === "blank" ? "hsl(var(--muted))" : "#0a0a0a" }}
    >
      {bm && (
        <TileLayer
          key={basemap}
          url={bm.url}
          attribution={bm.attribution}
          maxNativeZoom={bm.maxNativeZoom}
          maxZoom={22}
        />
      )}
      <Overlay {...props} />
    </MapContainer>
  );
}

function Overlay({
  centerLat, centerLng, canvasWidth, canvasHeight,
  onZoomChange, onMapReady, onCanvasClick, tool, gridOn, svgRef, children,
}: MapCanvasProps) {
  const map = useMap();
  const readyRef = useRef(false);
  const overlayHostRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onMapReady(map);
    }
    onZoomChange(map.getZoom());
  }, [map, onMapReady, onZoomChange]);

  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  // The SVG created by react-leaflet is the nearest <svg> ancestor of overlayHostRef.
  useEffect(() => {
    const g = overlayHostRef.current;
    if (!g) return;
    let el: Element | null = g;
    while (el && el.tagName.toLowerCase() !== "svg") el = el.parentElement;
    svgRef.current = (el as SVGSVGElement | null) ?? null;
  }, [svgRef]);

  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const c = L.latLng(centerLat ?? map.getCenter().lat, centerLng ?? map.getCenter().lng);
    const centerPoint = map.project(c, REF_ZOOM);
    const half = L.point(canvasWidth / 2, canvasHeight / 2);
    const tl = map.unproject(centerPoint.subtract(half), REF_ZOOM);
    const br = map.unproject(centerPoint.add(half), REF_ZOOM);
    return [[tl.lat, tl.lng], [br.lat, br.lng]];
  }, [centerLat, centerLng, canvasWidth, canvasHeight, map]);

  const svgToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, [svgRef]);

  return (
    <SVGOverlay
      bounds={bounds}
      attributes={{
        viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
        preserveAspectRatio: "none",
        style: "overflow: visible;",
      }}
    >
      <g ref={overlayHostRef}>
        {gridOn && (
          <>
            <defs>
              <pattern id="vd-grid" width={20} height={20} patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.75} />
              </pattern>
            </defs>
            <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="url(#vd-grid)" pointerEvents="none" />
          </>
        )}

        {/* Venue extent frame */}
        <rect
          x={0} y={0} width={canvasWidth} height={canvasHeight}
          fill="none" stroke="hsl(var(--primary))" strokeWidth={3}
          strokeDasharray="12 8" opacity={0.65} pointerEvents="none"
        />

        {/* Hit rect for placement / background deselect */}
        <rect
          x={-canvasWidth * 2} y={-canvasHeight * 2}
          width={canvasWidth * 5} height={canvasHeight * 5}
          fill="transparent"
          style={{
            pointerEvents: tool === "place" ? "auto" : "none",
            cursor: tool === "place" ? "crosshair" : "default",
          }}
          onClick={(e) => {
            if (tool !== "place") return;
            e.stopPropagation();
            const p = svgToCanvas(e.clientX, e.clientY);
            onCanvasClick(p);
          }}
        />

        {children}
      </g>
    </SVGOverlay>
  );
}
