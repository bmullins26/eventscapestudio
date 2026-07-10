import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MousePointer2, Hand, Square, Circle as CircleIcon, Type as TypeIcon,
  Slash, PenLine, Ruler as RulerIcon, Spline, Store, Trees, Utensils, Zap, Droplets,
  Signpost, MapPin, ImagePlus, Upload, Loader2, LayoutTemplate,
} from "lucide-react";

export type ToolStripProps = {
  tool: "select" | "pan" | "place";
  placingType: string | null;
  onSelect: () => void;
  onPan: () => void;
  onPickType: (type: string) => void;
  onImportRef: () => void;
  onPublish: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  zoomPct: number;
  uploading: boolean;
};

const QUICK: Array<{ type: string; icon: any; title: string }> = [
  { type: "booth",       icon: Store,      title: "Booth (B)" },
  { type: "building",    icon: Square,     title: "Building" },
  { type: "stage",       icon: LayoutTemplate, title: "Stage" },
  { type: "road",        icon: Slash,      title: "Road" },
  { type: "walkway",     icon: PenLine,    title: "Walkway" },
  { type: "parking",     icon: MapPin,     title: "Parking" },
  { type: "tree",        icon: Trees,      title: "Tree" },
  { type: "food_truck",  icon: Utensils,   title: "Food Truck" },
  { type: "electrical",  icon: Zap,        title: "Electrical" },
  { type: "water",       icon: Droplets,   title: "Water" },
  { type: "sign",        icon: Signpost,   title: "Sign" },
  { type: "measurement", icon: RulerIcon,  title: "Measurement" },
];

export function ToolStrip(p: ToolStripProps) {
  return (
    <div className="flex items-center gap-1 border-b bg-card px-2 py-1">
      <ToolBtn icon={MousePointer2} label="Select (V)" active={p.tool === "select"} onClick={p.onSelect} />
      <ToolBtn icon={Hand} label="Pan (H)" active={p.tool === "pan"} onClick={p.onPan} />
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolBtn icon={Square} label="Rectangle" active={p.placingType === "building"} onClick={() => p.onPickType("building")} />
      <ToolBtn icon={CircleIcon} label="Circle" active={p.placingType === "tree"} onClick={() => p.onPickType("tree")} />
      <ToolBtn icon={Spline} label="Polygon" active={false} onClick={() => p.onPickType("building")} />
      <ToolBtn icon={Slash} label="Line" active={false} onClick={() => p.onPickType("fence")} />
      <ToolBtn icon={TypeIcon} label="Text / Sign" active={p.placingType === "sign"} onClick={() => p.onPickType("sign")} />
      <div className="mx-1 h-6 w-px bg-border" />
      {QUICK.map((q) => (
        <ToolBtn key={q.type} icon={q.icon} label={q.title} active={p.placingType === q.type} onClick={() => p.onPickType(q.type)} />
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={p.onImportRef} disabled={p.uploading} className="h-8 gap-1 px-2" title="Upload reference image">
        {p.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        <span className="hidden text-xs md:inline">Reference</span>
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={p.onZoomOut}>−</Button>
        <button className="h-8 min-w-[52px] rounded px-2 text-xs hover:bg-muted" onClick={p.onZoomReset}>{p.zoomPct}%</button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={p.onZoomIn}>+</Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button size="sm" className="h-8 gap-1 px-3" onClick={p.onPublish}>
          <Upload className="h-3.5 w-3.5" /> Publish
        </Button>
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick} title={label} className={cn("h-8 px-2")}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
