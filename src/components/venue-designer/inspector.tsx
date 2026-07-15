import { useState } from "react";
import type { AnyElement, BoothElement, IconElement, LayoutSettings, ShapeElement, TextElement, BackgroundLayer } from "./types";
import type { DesignerActions } from "./store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Trash2, Copy, X, MapPin } from "lucide-react";
import { describe, uid } from "./factory";
import { AddBackgroundDialog } from "./add-background-dialog";

export function Inspector({
  elements, selection, actions, settings, name, onName, onSettings,
  background, onBackgroundChange, venueId, organizationId,
}: {
  elements: AnyElement[];
  selection: string[];
  actions: DesignerActions;
  settings: LayoutSettings;
  name: string;
  onName: (v: string) => void;
  onSettings: (patch: Partial<LayoutSettings>) => void;
  background?: BackgroundLayer | null;
  onBackgroundChange?: (bg: BackgroundLayer | null) => void;
  venueId?: string;
  organizationId?: string;
}) {
  const sel = elements.filter((e) => selection.includes(e.id));
  const [addOpen, setAddOpen] = useState(false);

  if (sel.length === 0) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card">
        <PanelHeader title="Layout" />
        <div className="flex-1 space-y-4 overflow-auto p-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => onName(e.target.value)} className="h-8" />
          </Field>
          <div className="space-y-3 rounded border border-border p-3">
            <Toggle label="Add tax to booths" value={!!settings.addTax} onChange={(v) => onSettings({ addTax: v })} />
            <Toggle label="Render assignment names" value={!!settings.renderAssignments} onChange={(v) => onSettings({ renderAssignments: v })} />
            <Toggle label="Redact assignments" value={!!settings.redactAssignments} onChange={(v) => onSettings({ redactAssignments: v })} />
            <Toggle label="Hide unassigned IDs" value={!!settings.hideUnassignedIds} onChange={(v) => onSettings({ hideUnassignedIds: v })} />
          </div>
          {background && onBackgroundChange && (
            <BackgroundSection background={background} onChange={onBackgroundChange} />
          )}
          {!background && onBackgroundChange && venueId && organizationId && (
            <div className="space-y-2 rounded border border-dashed border-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Background</div>
              <p className="text-[11px] text-muted-foreground">
                Ground your layout with a satellite map or reference image.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Add background
              </Button>
              <AddBackgroundDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                venueId={venueId}
                organizationId={organizationId}
                onBackground={(bg) => onBackgroundChange(bg)}
              />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Select an object to edit its properties.</p>
        </div>
      </div>
    );
  }

  if (sel.length > 1) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card">
        <PanelHeader title={`${sel.length} objects selected`} />
        <div className="flex-1 space-y-3 overflow-auto p-3">
          <ZButtons ids={sel.map((s) => s.id)} actions={actions} />
          <Button variant="destructive" size="sm" onClick={() => actions.remove(sel.map((s) => s.id))} className="w-full">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    );
  }

  const el = sel[0];
  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <PanelHeader title={describe(el)} sub={el.kind} />
      <div className="flex-1 space-y-4 overflow-auto p-3">
        <NumRow el={el} actions={actions} />
        {el.kind === "booth" && <BoothFields el={el as BoothElement} actions={actions} />}
        {(el.kind === "rect" || el.kind === "circle" || el.kind === "triangle" || el.kind === "line") && (
          <ShapeFields el={el as ShapeElement} actions={actions} />
        )}
        {el.kind === "text" && <TextFields el={el as TextElement} actions={actions} />}
        {el.kind === "icon" && <IconFields el={el as IconElement} actions={actions} />}
        <ZButtons ids={[el.id]} actions={actions} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => actions.add({ ...el, id: uid(), x: el.x + 5, y: el.y + 5 } as AnyElement)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={() => actions.remove([el.id])}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector</div>
      <div className="mt-0.5 truncate text-sm font-medium">{title}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function NumRow({ el, actions }: { el: AnyElement; actions: DesignerActions }) {
  const set = (k: keyof AnyElement, v: number) => actions.update(el.id, { [k]: v } as Partial<AnyElement>);
  return (
    <div className="grid grid-cols-4 gap-2">
      <Field label="X"><Input type="number" className="h-8" value={round(el.x)} onChange={(e) => set("x", Number(e.target.value))} /></Field>
      <Field label="Y"><Input type="number" className="h-8" value={round(el.y)} onChange={(e) => set("y", Number(e.target.value))} /></Field>
      <Field label="W"><Input type="number" className="h-8" value={round(el.w)} onChange={(e) => set("w", Number(e.target.value))} /></Field>
      <Field label="H"><Input type="number" className="h-8" value={round(el.h)} onChange={(e) => set("h", Number(e.target.value))} /></Field>
      <Field label="Rot"><Input type="number" className="h-8 col-span-1" value={round(el.rotation)} onChange={(e) => set("rotation" as any, Number(e.target.value))} /></Field>
    </div>
  );
}

function BoothFields({ el, actions }: { el: BoothElement; actions: DesignerActions }) {
  const s = (patch: Partial<BoothElement>) => actions.update(el.id, patch);
  return (
    <div className="space-y-3">
      <Field label="Booth ID / label"><Input className="h-8" value={el.label} onChange={(e) => s({ label: e.target.value })} /></Field>
      <Field label="Price"><Input type="number" className="h-8" value={el.price ?? ""} onChange={(e) => s({ price: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fill"><Input type="color" className="h-8 p-1" value={colorish(el.fill)} onChange={(e) => s({ fill: e.target.value })} /></Field>
        <Field label="Outline"><Input type="color" className="h-8 p-1" value={colorish(el.stroke)} onChange={(e) => s({ stroke: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Stroke"><Input type="number" step="0.25" className="h-8" value={el.strokeWidth} onChange={(e) => s({ strokeWidth: Number(e.target.value) })} /></Field>
        <Field label="Radius"><Input type="number" step="0.5" className="h-8" value={el.radius} onChange={(e) => s({ radius: Number(e.target.value) })} /></Field>
        <Field label="Style">
          <Select value={el.strokeStyle} onValueChange={(v) => s({ strokeStyle: v as any })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font size"><Input type="number" className="h-8" value={el.fontSize} onChange={(e) => s({ fontSize: Number(e.target.value) })} /></Field>
        <Field label="Font weight">
          <Select value={String(el.fontWeight)} onValueChange={(v) => s({ fontWeight: Number(v) as any })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="400">Regular</SelectItem>
              <SelectItem value="500">Medium</SelectItem>
              <SelectItem value="600">Semibold</SelectItem>
              <SelectItem value="700">Bold</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function ShapeFields({ el, actions }: { el: ShapeElement; actions: DesignerActions }) {
  const s = (patch: Partial<ShapeElement>) => actions.update(el.id, patch);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fill"><Input type="color" className="h-8 p-1" value={colorish(el.fill)} onChange={(e) => s({ fill: e.target.value })} /></Field>
        <Field label="Stroke"><Input type="color" className="h-8 p-1" value={colorish(el.stroke)} onChange={(e) => s({ stroke: e.target.value })} /></Field>
      </div>
      <Field label="Stroke width"><Input type="number" step="0.25" className="h-8" value={el.strokeWidth} onChange={(e) => s({ strokeWidth: Number(e.target.value) })} /></Field>
    </div>
  );
}

function TextFields({ el, actions }: { el: TextElement; actions: DesignerActions }) {
  const s = (patch: Partial<TextElement>) => actions.update(el.id, patch);
  return (
    <div className="space-y-3">
      <Field label="Text"><Input className="h-8" value={el.text} onChange={(e) => s({ text: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Color"><Input type="color" className="h-8 p-1" value={colorish(el.color)} onChange={(e) => s({ color: e.target.value })} /></Field>
        <Field label="Size"><Input type="number" className="h-8" value={el.fontSize} onChange={(e) => s({ fontSize: Number(e.target.value) })} /></Field>
        <Field label="Weight">
          <Select value={String(el.fontWeight)} onValueChange={(v) => s({ fontWeight: Number(v) as any })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="400">Regular</SelectItem>
              <SelectItem value="600">Semibold</SelectItem>
              <SelectItem value="700">Bold</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function IconFields({ el, actions }: { el: IconElement; actions: DesignerActions }) {
  return (
    <div className="space-y-3">
      <Field label="Tint"><Input type="color" className="h-8 p-1" value={colorish(el.tint)} onChange={(e) => actions.update(el.id, { tint: e.target.value })} /></Field>
    </div>
  );
}

function ZButtons({ ids, actions }: { ids: string[]; actions: DesignerActions }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      <Button variant="outline" size="sm" title="Send to back" onClick={() => ids.forEach((id) => actions.z(id, "back"))}><ArrowDownToLine className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="sm" title="Send backward" onClick={() => ids.forEach((id) => actions.z(id, "backward"))}><ArrowDown className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="sm" title="Bring forward" onClick={() => ids.forEach((id) => actions.z(id, "forward"))}><ArrowUp className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="sm" title="Bring to front" onClick={() => ids.forEach((id) => actions.z(id, "front"))}><ArrowUpToLine className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function round(n: number) { return Math.round(n * 100) / 100; }
function colorish(v: string): string {
  // Convert CSS var/hsl to hex only when it's already a hex; otherwise return a fallback for the input widget.
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(v)) return v;
  return "#4f46e5";
}

function BackgroundSection({ background, onChange }: { background: BackgroundLayer; onChange: (bg: BackgroundLayer | null) => void }) {
  const s = (patch: Partial<BackgroundLayer>) => onChange({ ...background, ...patch });
  return (
    <div className="space-y-3 rounded border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Background</div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange(null)}>
          <X className="mr-1 h-3 w-3" /> Remove
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {background.kind === "satellite" ? (background.meta?.address ?? "Satellite imagery") : "Uploaded reference"}
        {background.calibrated ? " · calibrated" : " · not calibrated"}
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Opacity ({Math.round(background.opacity * 100)}%)</Label>
        <Slider
          value={[Math.round(background.opacity * 100)]}
          min={5} max={100} step={1}
          onValueChange={(v) => s({ opacity: (v[0] ?? 100) / 100 })}
          className="mt-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width (ft)">
          <Input type="number" step="0.5" className="h-8" value={round(background.w)} onChange={(e) => {
            const w = Number(e.target.value); if (!Number.isFinite(w) || w <= 0) return;
            const aspect = background.h / background.w;
            const h = w * aspect;
            const cx = background.x + background.w / 2;
            const cy = background.y + background.h / 2;
            s({ w, h, x: cx - w / 2, y: cy - h / 2 });
          }} />
        </Field>
        <Field label="Rotation°">
          <Input type="number" step="1" className="h-8" value={round(background.rotation)} onChange={(e) => s({ rotation: Number(e.target.value) })} />
        </Field>
      </div>
      <Toggle label="Lock background" value={background.locked} onChange={(v) => s({ locked: v })} />
    </div>
  );
}

