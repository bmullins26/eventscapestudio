import { MousePointer2, Hand, Square, Circle, Type } from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "select" | "pan" | "place";

export function FloatingTools({
  tool, placingType, onSelect, onPan, onArm,
}: {
  tool: Tool;
  placingType: string | null;
  onSelect: () => void;
  onPan: () => void;
  onArm: (type: string) => void;
}) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-full transition";
  const inactive = "text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = "bg-primary text-primary-foreground shadow-sm";
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/70 bg-background/95 p-1 shadow-md backdrop-blur">
      <button className={cn(btn, tool === "select" ? active : inactive)} onClick={onSelect} title="Select (V)">
        <MousePointer2 className="h-4 w-4" />
      </button>
      <button className={cn(btn, tool === "pan" ? active : inactive)} onClick={onPan} title="Pan (H)">
        <Hand className="h-4 w-4" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button className={cn(btn, tool === "place" && placingType === "booth" ? active : inactive)} onClick={() => onArm("booth")} title="Booth (B)">
        <Square className="h-4 w-4" />
      </button>
      <button className={cn(btn, tool === "place" && placingType === "building" ? active : inactive)} onClick={() => onArm("building")} title="Building (R)">
        <Square className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button className={cn(btn, tool === "place" && placingType === "tree" ? active : inactive)} onClick={() => onArm("tree")} title="Tree">
        <Circle className="h-4 w-4" />
      </button>
      <button className={cn(btn, tool === "place" && placingType === "sign" ? active : inactive)} onClick={() => onArm("sign")} title="Label / sign">
        <Type className="h-4 w-4" />
      </button>
    </div>
  );
}
