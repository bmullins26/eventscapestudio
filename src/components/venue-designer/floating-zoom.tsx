import { Plus, Minus, Map as MapIcon, HelpCircle, Layers } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export type Basemap = "satellite" | "streets" | "blank";

export function FloatingZoom({
  zoomPct, onZoomOut, onZoomIn, basemap, onBasemap, onHelp,
}: {
  zoomPct: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  onHelp: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-[500] flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-background/95 p-1 shadow-md backdrop-blur">
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onZoomOut} title="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <div className="min-w-[46px] text-center text-[11px] font-medium tabular-nums text-muted-foreground">{zoomPct}%</div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onZoomIn} title="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-md backdrop-blur hover:bg-muted hover:text-foreground" title="Base map">
            {basemap === "blank" ? <Layers className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">Base map</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={basemap} onValueChange={(v) => onBasemap(v as Basemap)}>
            <DropdownMenuRadioItem value="satellite">Satellite</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="streets">Streets</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="blank">Blank</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-md backdrop-blur hover:bg-muted hover:text-foreground" onClick={onHelp} title="Help & shortcuts">
        <HelpCircle className="h-4 w-4" />
      </button>
    </div>
  );
}
