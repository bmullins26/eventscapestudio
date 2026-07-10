import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";

const MapCanvas = lazy(() => import("./map-canvas"));

import type { MapCanvasProps } from "./map-canvas";

export function ClientMapCanvas(props: MapCanvasProps) {
  return (
    <ClientOnly fallback={<MapFallback />}>
      <Suspense fallback={<MapFallback />}>
        <MapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
}

function MapFallback(): ReactNode {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  );
}
