import { useState } from "react";
import { Layers as LayersIcon, History as HistoryIcon, Sparkles, ImageIcon, LayoutTemplate, Boxes, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type DrawerTab = "layers" | "history" | "ai" | "assets" | "templates" | "objects";

const TABS: Array<{ id: DrawerTab; label: string; icon: any }> = [
  { id: "layers",    label: "Layers",    icon: LayersIcon },
  { id: "history",   label: "History",   icon: HistoryIcon },
  { id: "ai",        label: "AI",        icon: Sparkles },
  { id: "assets",    label: "Assets",    icon: ImageIcon },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "objects",   label: "Objects",   icon: Boxes },
];

export function BottomDrawer({
  active, onActive, collapsed, onToggleCollapsed, height, onHeightChange, renderTab,
}: {
  active: DrawerTab;
  onActive: (t: DrawerTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  height: number;
  onHeightChange: (h: number) => void;
  renderTab: (t: DrawerTab) => React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="flex shrink-0 flex-col border-t bg-card" style={{ height: collapsed ? 36 : height }}>
      <div className="flex h-9 items-center border-b">
        {!collapsed && (
          <div
            className={cn("h-1 w-full cursor-ns-resize absolute top-0 left-0 right-0 hover:bg-primary/30", dragging && "bg-primary/40")}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
              const startY = e.clientY;
              const startH = height;
              const onMove = (ev: PointerEvent) => onHeightChange(Math.max(140, Math.min(600, startH - (ev.clientY - startY))));
              const onUp = () => { setDragging(false); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          />
        )}
        <div className="flex flex-1 items-center overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = active === t.id && !collapsed;
            return (
              <button
                key={t.id}
                onClick={() => { if (collapsed) onToggleCollapsed(); onActive(t.id); }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 border-r px-3 text-xs transition",
                  on ? "bg-background font-medium text-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <button
          className="mr-2 flex h-7 items-center gap-1 rounded px-2 text-[11px] text-muted-foreground hover:bg-muted"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand drawer" : "Collapse drawer"}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {renderTab(active)}
        </div>
      )}
    </div>
  );
}
