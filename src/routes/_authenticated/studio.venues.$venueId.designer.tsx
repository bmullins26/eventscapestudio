import { useRef, useState, useCallback } from "react";
import { createFileRoute, Link, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MousePointer2, Hand, Square, Circle as CircleIcon, Type as TypeIcon,
  Layers, Library, LayoutTemplate, Search, ChevronLeft, Ruler, Grid3x3, Magnet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { getVenueDesign } from "@/lib/venue-designer.functions";
import { useCanvasInput, type CanvasCoords } from "@/components/booth-builder/use-canvas-input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({ meta: [{ title: "Venue Designer · EventScape Studio" }] }),
  component: VenueDesignerPage,
});

type Tool = "select" | "pan" | "rect" | "circle" | "text";

function VenueDesignerPage() {
  const { venueId } = Route.useParams();
  const fetchDesign = useServerFn(getVenueDesign);
  const { data, isLoading } = useQuery({
    queryKey: ["venue-design", venueId],
    queryFn: () => fetchDesign({ data: { venueId } }),
  });

  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [cursor, setCursor] = useState<CanvasCoords>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const onPan = useCallback((dx: number, dy: number) => {
    setView((v) => ({ ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom }));
  }, []);
  const onZoom = useCallback((factor: number, focal: CanvasCoords) => {
    setView((v) => {
      const nz = Math.min(8, Math.max(0.1, v.zoom * factor));
      // keep focal fixed under cursor (approx)
      const k = nz / v.zoom;
      return {
        zoom: nz,
        x: focal.x - (focal.x - v.x) * k,
        y: focal.y - (focal.y - v.y) * k,
      };
    });
  }, []);

  const input = useCanvasInput({ onPan, onZoom });

  const width = data?.venue?.canvas_width ?? 2000;
  const height = data?.venue?.canvas_height ?? 1500;
  const units = data?.venue?.units ?? "feet";

  return (
    <div className="fixed inset-0 top-16 flex flex-col bg-background">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/studio/venues"><ChevronLeft className="mr-1 h-4 w-4" />Venues</Link>
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <div className="text-sm font-medium truncate max-w-[240px]">
          {isLoading ? <Skeleton className="h-4 w-40" /> : (data?.venue?.name ?? "Venue")}
        </div>
        <div className="mx-2 h-6 w-px bg-border" />
        <ToolButton icon={MousePointer2} label="Select" active={tool === "select"} onClick={() => setTool("select")} />
        <ToolButton icon={Hand} label="Pan" active={tool === "pan"} onClick={() => setTool("pan")} />
        <div className="mx-1 h-6 w-px bg-border" />
        <ToolButton icon={Square} label="Rectangle" active={tool === "rect"} onClick={() => setTool("rect")} />
        <ToolButton icon={CircleIcon} label="Circle" active={tool === "circle"} onClick={() => setTool("circle")} />
        <ToolButton icon={TypeIcon} label="Text" active={tool === "text"} onClick={() => setTool("text")} />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Phase 1 · shell preview
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r bg-card">
          <Tabs defaultValue="objects" className="flex h-full flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="objects" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Library className="mr-1 h-3.5 w-3.5" />Objects
              </TabsTrigger>
              <TabsTrigger value="layers" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Layers className="mr-1 h-3.5 w-3.5" />Layers
              </TabsTrigger>
              <TabsTrigger value="templates" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <LayoutTemplate className="mr-1 h-3.5 w-3.5" />Versions
              </TabsTrigger>
            </TabsList>
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search library..." className="h-8 pl-7 text-xs" />
              </div>
            </div>
            <TabsContent value="objects" className="mt-0 flex-1 overflow-auto p-3">
              <ObjectCategoryList />
            </TabsContent>
            <TabsContent value="layers" className="mt-0 flex-1 overflow-auto p-3">
              {(data?.layers.length ?? 0) === 0 ? (
                <EmptyState icon={Layers} title="No layers yet" description="Layers appear as you add reference images and objects." />
              ) : (
                <ul className="space-y-1 text-sm">
                  {data!.layers.map((l: any) => (
                    <li key={l.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
                      <span className="truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground">{l.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="templates" className="mt-0 flex-1 overflow-auto p-3">
              <EmptyState icon={LayoutTemplate} title="No published versions" description="Publish the current design as a version to snapshot it for events." />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden bg-muted/30">
          <svg
            ref={svgRef}
            className="h-full w-full touch-none"
            style={{ cursor: tool === "pan" ? "grab" : "default" }}
            onPointerDown={input.onPointerDown}
            onPointerMove={(e) => {
              input.onPointerMove(e);
              if (!svgRef.current) return;
              const pt = svgRef.current.createSVGPoint();
              pt.x = e.clientX; pt.y = e.clientY;
              const ctm = svgRef.current.getScreenCTM();
              if (ctm) {
                const p = pt.matrixTransform(ctm.inverse());
                setCursor({ x: p.x, y: p.y });
              }
            }}
            onPointerUp={input.onPointerUp}
            onPointerCancel={input.onPointerCancel}
            onWheel={input.onWheel}
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
              {/* Canvas paper */}
              <rect x={0} y={0} width={width} height={height} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={2 / view.zoom} />
              {showGrid && <rect x={0} y={0} width={width} height={height} fill="url(#grid-lg)" opacity={0.5} />}
              {/* Placeholder for objects — populated in Phase 2 */}
              {(data?.objects ?? []).map((o: any) => (
                <rect key={o.id} x={o.geometry?.x ?? 0} y={o.geometry?.y ?? 0} width={o.geometry?.w ?? 40} height={o.geometry?.h ?? 40} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" />
              ))}
            </g>
          </svg>

          {/* Canvas empty state overlay */}
          {!isLoading && (data?.objects.length ?? 0) === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto max-w-md rounded-lg border bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                <div className="mb-2 text-lg font-semibold">Venue Designer</div>
                <p className="mb-4 text-sm text-muted-foreground">
                  The canvas is ready. Object placement, layers, reference import, and AI import arrive in the next phases.
                </p>
                <p className="text-xs text-muted-foreground">
                  Pan with two fingers or Space+drag. Pinch or Ctrl/⌘+scroll to zoom.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right inspector */}
        <aside className="w-72 shrink-0 border-l bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</div>
          <p className="text-sm text-muted-foreground">Select an object to edit its properties. In Phase 2 this panel becomes contextual (booth, building, road, tree, sponsor, ...).</p>
        </aside>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center gap-4 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <button className={cn("flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted", showGrid && "text-foreground")} onClick={() => setShowGrid((v) => !v)}>
          <Grid3x3 className="h-3.5 w-3.5" /> Grid
        </button>
        <button className={cn("flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted", snap && "text-foreground")} onClick={() => setSnap((v) => !v)}>
          <Magnet className="h-3.5 w-3.5" /> Snap
        </button>
        <div className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{units}</div>
        <div className="ml-auto flex items-center gap-4">
          <span>x {Math.round(cursor.x)}, y {Math.round(cursor.y)}</span>
          <span>{Math.round(view.zoom * 100)}%</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.1, v.zoom / 1.2) }))}>−</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>Reset</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setView((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.2) }))}>+</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick} title={label} className="h-8 px-2">
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function ObjectCategoryList() {
  const groups: Array<{ label: string; items: string[] }> = [
    { label: "Vendor", items: ["Booth", "Sponsor Banner", "Food Court", "Beer Garden"] },
    { label: "Structures", items: ["Building", "Stage", "Pavilion", "Restroom", "Ticket Booth", "Info Booth", "First Aid", "ATM"] },
    { label: "Circulation", items: ["Road", "Walkway", "Parking", "Fence"] },
    { label: "Utilities", items: ["Utility", "Trash Can", "Sign"] },
    { label: "Amenities", items: ["Table", "Bench", "Tree", "Kids Area", "Petting Zoo"] },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.items.map((it) => (
              <button key={it} disabled className="rounded border bg-background px-2 py-3 text-left text-xs opacity-60 cursor-not-allowed" title="Available in Phase 2">
                {it}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="pt-2 text-[11px] text-muted-foreground">Placement, editing, and library assets ship in Phase 2.</p>
    </div>
  );
}
