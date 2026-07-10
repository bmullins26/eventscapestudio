import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Undo2, Redo2, Save, MousePointer2, Square, Circle as CircleIcon, Triangle, Minus, Type, Store, Image as ImageIcon, Layers, MapPin, Upload, Ruler, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DesignerCanvas } from "./canvas";
import type { CanvasTool } from "./canvas";
import { ObjectExplorer } from "./object-explorer";
import { Inspector } from "./inspector";
import { useDesignerStore } from "./store";
import type { AnyElement, Layout, BackgroundLayer } from "./types";
import type { IconKey } from "./types";
import { makeBooth, makeShape, makeText, makeIcon, ICONS, uid, resetBoothCounter } from "./factory";
import { IconGlyph } from "./icon-glyph";
import { uploadReferenceBackground, calibrateBackground } from "./background";
import { detectRectanglesFromUrl } from "./detect-rects";
import { fetchSatelliteBackground } from "@/lib/venue-designer.functions";

type Tool = CanvasTool;

interface DesignerShellProps {
  venueId: string;
  organizationId: string;
  venueName: string;
  initial: Layout;
  onSave: (layout: Layout) => Promise<void>;
}

// Factory bridge (used by canvas placement)
function installFactory() {
  (globalThis as any).__vdFactory = (tool: string, x: number, y: number, extra?: any): AnyElement | null => {
    if (tool === "booth") return makeBooth(x - 5, y - 5);
    if (tool === "rect" || tool === "circle" || tool === "triangle" || tool === "line") return makeShape(tool, x - 6, y - 6);
    if (tool === "text") return makeText(x, y - 3);
    if (tool === "icon" && extra?.iconKey) return makeIcon(extra.iconKey as IconKey, x - 4, y - 4);
    return null;
  };
}

export function DesignerShell({ venueId: _venueId, venueName, initial, onSave }: DesignerShellProps) {
  const { state, actions } = useDesignerStore(initial);
  const [tool, setTool] = useState<Tool>("select");
  const [iconKey, setIconKey] = useState<IconKey>("tree");
  const [zoomPct, setZoomPct] = useState(100);
  const [saving, setSaving] = useState(false);
  const viewportRef = useRef({ x: -20, y: -20, scale: 4 });

  useEffect(() => { installFactory(); }, []);

  // Bump booth counter so new booths continue numbering
  useEffect(() => {
    const maxN = state.elements.reduce((m, e) => {
      if (e.kind !== "booth") return m;
      const n = Number((e as any).label);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    resetBoothCounter(maxN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo(); else actions.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); actions.redo(); return; }
      if (meta && e.key.toLowerCase() === "d" && state.selection.length) {
        e.preventDefault();
        state.selection.forEach((id) => {
          const el = state.elements.find((x) => x.id === id);
          if (el) actions.add({ ...el, id: uid(), x: el.x + 5, y: el.y + 5 } as AnyElement);
        });
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection.length) {
        e.preventDefault();
        actions.remove(state.selection);
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && state.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : e.ctrlKey ? 0.25 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        state.selection.forEach((id) => {
          const el = state.elements.find((x) => x.id === id);
          if (el) actions.update(id, { x: el.x + dx, y: el.y + dy } as Partial<AnyElement>);
        });
        return;
      }
      // Tool hotkeys
      const map: Record<string, Tool> = { v: "select", b: "booth", r: "rect", c: "circle", t: "text", l: "line" };
      const t = map[e.key.toLowerCase()];
      if (t) { setTool(t); }
      if (e.key === "Escape") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, state.selection, state.elements]);

  // Debounced auto-save
  useEffect(() => {
    if (!state.dirty) return;
    const h = window.setTimeout(async () => {
      setSaving(true);
      try {
        await onSave({ name: state.name, settings: state.settings, elements: state.elements });
        actions.markSaved();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to save");
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(h);
  }, [state.dirty, state.name, state.settings, state.elements, onSave, actions]);

  const manualSave = async () => {
    setSaving(true);
    try {
      await onSave({ name: state.name, settings: state.settings, elements: state.elements });
      actions.markSaved();
      toast.success("Layout saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex h-12 items-center gap-2 border-b border-border bg-card px-3">
        <Link to="/studio/venues" className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted" aria-label="Back to venues">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={state.name}
          onChange={(e) => actions.setName(e.target.value)}
          className="h-8 min-w-0 flex-shrink rounded border border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus:border-primary focus:outline-none"
          style={{ width: `${Math.max(state.name.length, 12)}ch` }}
        />
        <div className="text-xs text-muted-foreground truncate">· {venueName}</div>

        <div className="mx-4 h-6 w-px bg-border" />

        <ToolBtn active={tool === "select"} onClick={() => setTool("select")} title="Select (V)"><MousePointer2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "booth"} onClick={() => setTool("booth")} title="Booth (B)"><Store className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle (R)"><Square className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "circle"} onClick={() => setTool("circle")} title="Circle (C)"><CircleIcon className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "triangle"} onClick={() => setTool("triangle")} title="Triangle"><Triangle className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "line"} onClick={() => setTool("line")} title="Line (L)"><Minus className="h-4 w-4" /></ToolBtn>
        <ToolBtn active={tool === "text"} onClick={() => setTool("text")} title="Text (T)"><Type className="h-4 w-4" /></ToolBtn>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn("flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-muted", tool === "icon" && "bg-primary/10 text-primary")}
              title="Icons"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="capitalize">{iconKey.replace("_", " ")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel className="text-xs">Icons</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ICONS.map((i) => (
              <DropdownMenuItem key={i.key} onClick={() => { setIconKey(i.key); setTool("icon"); }}>
                <span className="mr-2 inline-flex h-4 w-4 items-center justify-center"><IconGlyph iconKey={i.key} size={16} /></span>
                {i.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-3 h-6 w-px bg-border" />

        <ToolBtn onClick={actions.undo} disabled={state.past.length === 0} title="Undo (⌘Z)"><Undo2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={actions.redo} disabled={state.future.length === 0} title="Redo (⌘⇧Z)"><Redo2 className="h-4 w-4" /></ToolBtn>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{zoomPct}%</span>
          {saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
          {!saving && !state.dirty && <span className="text-[11px] text-muted-foreground">Saved</span>}
          <Button size="sm" onClick={manualSave} className="h-8">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <div className="w-64 shrink-0">
          <ObjectExplorer elements={state.elements} selection={state.selection} actions={actions} />
        </div>
        <div className="min-w-0 flex-1">
          <DesignerCanvas
            elements={state.elements}
            selection={state.selection}
            actions={actions}
            tool={tool}
            toolPayload={tool === "icon" ? { iconKey } : null}
            onZoomChange={setZoomPct}
            viewportRef={viewportRef}
          />
        </div>
        <div className="w-72 shrink-0">
          <Inspector
            elements={state.elements}
            selection={state.selection}
            actions={actions}
            settings={state.settings}
            name={state.name}
            onName={actions.setName}
            onSettings={actions.setSettings}
          />
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children, disabled }: {
  active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded transition",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
