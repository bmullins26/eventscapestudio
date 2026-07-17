import { useState } from "react";
import type { AnyElement, BoothElement, IconElement, LayoutSettings, TextElement, BackgroundLayer } from "./types";
import type { DesignerActions } from "./store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Trash2, Copy, X, MapPin, Crop, RotateCcw, Move, Eye, EyeOff, Lock, Unlock,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Sparkles, Users, FileText, CalendarClock, Wrench, History as HistoryIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describe, uid, makeObjectId } from "./factory";
import { AddBackgroundDialog } from "./add-background-dialog";

/* -------------------------------------------------------------------------
 * Context Panel
 * -------------------------------------------------------------------------
 * The Context Panel replaces the old single-purpose inspector. Same visual
 * container, same styling — but the body changes with what's selected:
 *
 *   Nothing selected  →  Event Dashboard shell (Phase 2 stub; Phase 8 fills)
 *   Multi selected    →  Batch actions (align, distribute, delete, z-order)
 *   Single selected   →  Tabbed panel:
 *                          Properties           (wired)
 *                          Vendor               (placeholder)
 *                          Application          (placeholder)
 *                          Reservation          (placeholder)
 *                          Operations           (placeholder)
 *                          Venue Intelligence   (placeholder)
 *                          History              (placeholder)
 *
 * Placeholder tabs render an informative "arrives in a later phase" note so
 * the surface ships early and doesn't feel empty.
 * ---------------------------------------------------------------------- */

type SingleTab = "properties" | "vendor" | "application" | "reservation" | "operations" | "intelligence" | "history";

const SINGLE_TABS: Array<{ id: SingleTab; label: string; icon: React.ComponentType<{ className?: string }>; roadmap: string }> = [
  { id: "properties",   label: "Properties",         icon: Wrench,        roadmap: "Ships in Phase 2." },
  { id: "vendor",       label: "Vendor",             icon: Users,         roadmap: "Ships in Phase 4 with vendor assignment." },
  { id: "application",  label: "Application",        icon: FileText,      roadmap: "Ships in Phase 4 with application lookup." },
  { id: "reservation",  label: "Reservation",        icon: CalendarClock, roadmap: "Ships in Phase 4 with reservation timeline." },
  { id: "operations",   label: "Operations",         icon: Wrench,        roadmap: "Ships in Phase 4 with check-in / notes." },
  { id: "intelligence", label: "Venue Intelligence", icon: Sparkles,      roadmap: "Ships in Phase 4 (rules) + Phase 10 (AI)." },
  { id: "history",      label: "History",            icon: HistoryIcon,   roadmap: "Ships in Phase 4 with cross-event history." },
];

export function Inspector({
  elements, selection, actions, settings, name, onName, onSettings,
  background, onBackgroundChange, venueId, organizationId,
  bgSelected = false, onBgSelectChange,
  cropMode = false, onCropModeChange,
  mapAdjust = false, onMapAdjustChange,
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
  bgSelected?: boolean;
  onBgSelectChange?: (v: boolean) => void;
  cropMode?: boolean;
  onCropModeChange?: (v: boolean) => void;
  mapAdjust?: boolean;
  onMapAdjustChange?: (v: boolean) => void;
}) {
  const sel = elements.filter((e) => selection.includes(e.id));
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SingleTab>("properties");

  /* ------------------------- Empty selection: Dashboard ------------------------- */
  if (sel.length === 0) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card">
        <PanelHeader
          eyebrow="Dashboard"
          title={bgSelected && background ? "Base map" : name || "Venue Workspace"}
        />
        <div className="flex-1 space-y-4 overflow-auto p-3 animate-fade-in">
          <Field label="Name">
            <Input value={name} onChange={(e) => onName(e.target.value)} className="h-8" />
          </Field>

          {!bgSelected && (
            <DashboardStubs elementCount={elements.length} />
          )}

          <div className="space-y-3 rounded border border-border p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Layout settings</div>
            <Toggle label="Add tax to booths" value={!!settings.addTax} onChange={(v) => onSettings({ addTax: v })} />
            <Toggle label="Render assignment names" value={!!settings.renderAssignments} onChange={(v) => onSettings({ renderAssignments: v })} />
            <Toggle label="Redact assignments" value={!!settings.redactAssignments} onChange={(v) => onSettings({ redactAssignments: v })} />
            <Toggle label="Hide unassigned IDs" value={!!settings.hideUnassignedIds} onChange={(v) => onSettings({ hideUnassignedIds: v })} />
          </div>

          {background && onBackgroundChange && (
            <BackgroundSection
              background={background}
              onChange={onBackgroundChange}
              bgSelected={bgSelected}
              onBgSelectChange={onBgSelectChange}
              cropMode={cropMode}
              onCropModeChange={onCropModeChange}
              mapAdjust={mapAdjust}
              onMapAdjustChange={onMapAdjustChange}
            />
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
        </div>
      </div>
    );
  }

  /* ---------------------------- Multi selection: Batch --------------------------- */
  if (sel.length > 1) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card">
        <PanelHeader eyebrow="Batch edit" title={`${sel.length} objects selected`} />
        <div className="flex-1 space-y-3 overflow-auto p-3 animate-fade-in">
          <AlignButtons sel={sel} actions={actions} />
          <ZButtons ids={sel.map((s) => s.id)} actions={actions} />
          <Button variant="destructive" size="sm" onClick={() => actions.remove(sel.map((s) => s.id))} className="w-full">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
          <p className="text-[11px] text-muted-foreground">
            More batch actions (Electric · Water · Category · Sponsor · Duplicate) arrive in Phase 5.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------- Single selection: tabbed panel ---------------------- */
  const el = sel[0];
  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <PanelHeader eyebrow="Context Panel" title={describe(el)} sub={el.kind} />

      {/* Tab strip */}
      <div className="flex flex-wrap gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1.5">
        {SINGLE_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium transition",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60",
              )}
              title={t.label}
            >
              <Icon className="h-3 w-3" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div key={activeTab} className="flex-1 space-y-4 overflow-auto p-3 animate-fade-in">
        {activeTab === "properties" && (
          <PropertiesTab el={el} actions={actions} />
        )}
        {activeTab !== "properties" && (
          <PlaceholderTab tab={activeTab} el={el} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Properties tab
 * ---------------------------------------------------------------------- */

function PropertiesTab({ el, actions }: { el: AnyElement; actions: DesignerActions }) {
  return (
    <>
      <Field label={el.kind === "text" ? "Text" : "Name"}>
        <Input
          className="h-8"
          value={el.kind === "text" ? el.text : (el.name ?? "")}
          placeholder={el.kind === "booth" ? "e.g. Kate's Pretzels" : "Label shown on canvas"}
          onChange={(e) => {
            if (el.kind === "text") actions.update(el.id, { text: e.target.value } as Partial<AnyElement>);
            else actions.update(el.id, { name: e.target.value } as Partial<AnyElement>);
          }}
        />
      </Field>
      {(el.kind === "booth" || el.kind === "icon") && (
        <Field label="Label color">
          <Input
            type="color"
            className="h-8 p-1"
            value={colorish(el.labelColor ?? "#111827")}
            onChange={(e) => actions.update(el.id, { labelColor: e.target.value } as Partial<AnyElement>)}
          />
        </Field>
      )}
      <NumRow el={el} actions={actions} />

      {el.kind === "booth" && <BoothFields el={el as BoothElement} actions={actions} />}
      {el.kind === "text" && <TextFields el={el as TextElement} actions={actions} />}
      {el.kind === "icon" && <IconFields el={el as IconElement} actions={actions} />}
      <ZButtons ids={[el.id]} actions={actions} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => actions.add({ ...el, id: uid(), objectId: makeObjectId(), x: el.x + 5, y: el.y + 5 } as AnyElement)}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" onClick={() => actions.remove([el.id])}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
 * Placeholder tabs (Vendor / Application / Reservation / Operations /
 * Venue Intelligence / History). Each shows the object's persistent ID so
 * it's obvious the wiring is in place — later phases replace these bodies.
 * ---------------------------------------------------------------------- */
function PlaceholderTab({ tab, el }: { tab: SingleTab; el: AnyElement }) {
  const def = SINGLE_TABS.find((t) => t.id === tab)!;
  const Icon = def.icon;
  const isEventOnly = tab !== "properties";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold">{def.label}</div>
          <div className="text-[11px] text-muted-foreground">{def.roadmap}</div>
        </div>
      </div>
      {isEventOnly && (
        <p className="text-[11px] text-muted-foreground">
          Live vendor, application, reservation, payment, and check-in data appears here
          once this workspace is opened in <strong>Event mode</strong> (Phase 3).
        </p>
      )}
      <div className="rounded border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground">
        <div>Object ID (persistent): <code className="text-foreground">{el.objectId?.slice(0, 8) ?? "—"}</code></div>
        <div>Kind: <code className="text-foreground">{el.kind}</code></div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Dashboard stubs (empty selection) — Phase 8 fills in real data.
 * ---------------------------------------------------------------------- */
function DashboardStubs({ elementCount }: { elementCount: number }) {
  const stubs: Array<{ label: string; value: string; hint: string }> = [
    { label: "Objects on canvas", value: String(elementCount), hint: "Live from the layout." },
    { label: "Available booths",  value: "—", hint: "Wires up in Phase 3 (event mode)." },
    { label: "Reserved / Paid",   value: "—", hint: "Wires up in Phase 3." },
    { label: "Pending apps",      value: "—", hint: "Wires up in Phase 4." },
    { label: "Revenue",           value: "—", hint: "Wires up in Phase 8." },
    { label: "Upcoming tasks",    value: "—", hint: "Wires up in Phase 8." },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {stubs.map((s) => (
        <div key={s.label} className="rounded border border-border/70 bg-background/50 p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{s.value}</div>
          <div className="text-[10px] text-muted-foreground">{s.hint}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- Shared UI helpers ---------------------------- */

function PanelHeader({ eyebrow = "Context Panel", title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
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
      <Field label="Rot"><Input type="number" className="h-8 col-span-1" value={round(el.rotation)} onChange={(e) => set("rotation" as keyof AnyElement, Number(e.target.value))} /></Field>
    </div>
  );
}

function BoothFields({ el, actions }: { el: BoothElement; actions: DesignerActions }) {
  const s = (patch: Partial<BoothElement>) => actions.update(el.id, patch);
  return (
    <div className="space-y-3">
      <Field label="Booth ID / label"><Input className="h-8" value={el.label} onChange={(e) => s({ label: e.target.value })} /></Field>
      <Field label="Category">
        <Input
          className="h-8"
          value={el.category ?? ""}
          placeholder="Food · Crafts · Retail…"
          onChange={(e) => s({ category: e.target.value === "" ? null : e.target.value })}
        />
      </Field>
      <Field label="Price"><Input type="number" className="h-8" value={el.price ?? ""} onChange={(e) => s({ price: e.target.value === "" ? null : Number(e.target.value) })} /></Field>

      <div className="rounded border border-border p-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Traits</div>
        <div className="grid grid-cols-2 gap-2">
          <TraitToggle label="Premium"  value={!!el.isPremium}  onChange={(v) => s({ isPremium: v })} />
          <TraitToggle label="Corner"   value={!!el.isCorner}   onChange={(v) => s({ isCorner: v })} />
          <TraitToggle label="Electric" value={!!el.isElectric} onChange={(v) => s({ isElectric: v })} />
          <TraitToggle label="Water"    value={!!el.isWater}    onChange={(v) => s({ isWater: v })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Fill"><Input type="color" className="h-8 p-1" value={colorish(el.fill)} onChange={(e) => s({ fill: e.target.value })} /></Field>
        <Field label="Outline"><Input type="color" className="h-8 p-1" value={colorish(el.stroke)} onChange={(e) => s({ stroke: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Stroke"><Input type="number" step="0.25" className="h-8" value={el.strokeWidth} onChange={(e) => s({ strokeWidth: Number(e.target.value) })} /></Field>
        <Field label="Radius"><Input type="number" step="0.5" className="h-8" value={el.radius} onChange={(e) => s({ radius: Number(e.target.value) })} /></Field>
        <Field label="Style">
          <Select value={el.strokeStyle} onValueChange={(v) => s({ strokeStyle: v as BoothElement["strokeStyle"] })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font size"><Input type="number" className="h-8" value={el.fontSize} onChange={(e) => s({ fontSize: Number(e.target.value) })} /></Field>
        <Field label="Font weight">
          <Select value={String(el.fontWeight)} onValueChange={(v) => s({ fontWeight: Number(v) as BoothElement["fontWeight"] })}>
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

function TraitToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs transition",
        value
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span className={cn("h-3.5 w-3.5 rounded-full border", value ? "border-primary bg-primary" : "border-muted-foreground/40")} />
    </button>
  );
}

function AlignButtons({ sel, actions }: { sel: AnyElement[]; actions: DesignerActions }) {
  if (sel.length < 2) return null;
  const minX = Math.min(...sel.map((e) => e.x));
  const maxX = Math.max(...sel.map((e) => e.x + e.w));
  const minY = Math.min(...sel.map((e) => e.y));
  const maxY = Math.max(...sel.map((e) => e.y + e.h));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const apply = (fn: (e: AnyElement) => Partial<AnyElement>) => {
    sel.forEach((e) => actions.update(e.id, fn(e) as Partial<AnyElement>));
  };
  const distribute = (axis: "x" | "y") => {
    if (sel.length < 3) return;
    const sorted = [...sel].sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstC = axis === "x" ? first.x + first.w / 2 : first.y + first.h / 2;
    const lastC = axis === "x" ? last.x + last.w / 2 : last.y + last.h / 2;
    const step = (lastC - firstC) / (sorted.length - 1);
    sorted.forEach((el, i) => {
      if (i === 0 || i === sorted.length - 1) return;
      const target = firstC + step * i;
      if (axis === "x") actions.update(el.id, { x: target - el.w / 2 } as Partial<AnyElement>);
      else actions.update(el.id, { y: target - el.h / 2 } as Partial<AnyElement>);
    });
  };

  const btn = (title: string, onClick: () => void, Icon: React.ComponentType<{ className?: string }>) => (
    <Button variant="outline" size="sm" title={title} onClick={onClick} className="h-8 w-full px-0">
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="space-y-2 rounded border border-border p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Align</div>
      <div className="grid grid-cols-6 gap-1">
        {btn("Align left", () => apply(() => ({ x: minX })), AlignStartVertical)}
        {btn("Center horizontally", () => apply((e) => ({ x: midX - e.w / 2 })), AlignCenterVertical)}
        {btn("Align right", () => apply((e) => ({ x: maxX - e.w })), AlignEndVertical)}
        {btn("Align top", () => apply(() => ({ y: minY })), AlignStartHorizontal)}
        {btn("Center vertically", () => apply((e) => ({ y: midY - e.h / 2 })), AlignCenterHorizontal)}
        {btn("Align bottom", () => apply((e) => ({ y: maxY - e.h })), AlignEndHorizontal)}
      </div>
      {sel.length >= 3 && (
        <div className="grid grid-cols-2 gap-1">
          {btn("Distribute horizontally", () => distribute("x"), AlignHorizontalDistributeCenter)}
          {btn("Distribute vertically", () => distribute("y"), AlignVerticalDistributeCenter)}
        </div>
      )}
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
          <Select value={String(el.fontWeight)} onValueChange={(v) => s({ fontWeight: Number(v) as TextElement["fontWeight"] })}>
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

function BackgroundSection({
  background, onChange,
  bgSelected = false, onBgSelectChange,
  cropMode = false, onCropModeChange,
  mapAdjust = false, onMapAdjustChange,
}: {
  background: BackgroundLayer;
  onChange: (bg: BackgroundLayer | null) => void;
  bgSelected?: boolean;
  onBgSelectChange?: (v: boolean) => void;
  cropMode?: boolean;
  onCropModeChange?: (v: boolean) => void;
  mapAdjust?: boolean;
  onMapAdjustChange?: (v: boolean) => void;
}) {
  const s = (patch: Partial<BackgroundLayer>) => onChange({ ...background, ...patch });
  const isSat = background.kind === "google-satellite";
  return (
    <div className="space-y-3 rounded border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base map</div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange(null)}>
          <X className="mr-1 h-3 w-3" /> Remove
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {isSat ? (background.meta?.address ?? "Satellite imagery") :
          background.kind === "satellite" ? (background.meta?.address ?? "Satellite imagery") : "Uploaded reference"}
        {background.calibrated ? " · calibrated" : " · not calibrated"}
      </div>
      {onBgSelectChange && (
        <Button
          size="sm"
          variant={bgSelected ? "default" : "outline"}
          className="h-8 w-full"
          onClick={() => onBgSelectChange(!bgSelected)}
        >
          <Move className="mr-1.5 h-3.5 w-3.5" /> {bgSelected ? "Deselect layer" : "Select layer to move"}
        </Button>
      )}
      {bgSelected && (
        <div className="grid grid-cols-2 gap-2">
          {isSat && onMapAdjustChange && (
            <Button size="sm" variant={mapAdjust ? "default" : "outline"} className="h-8" onClick={() => onMapAdjustChange(!mapAdjust)}>
              <MapPin className="mr-1.5 h-3.5 w-3.5" /> {mapAdjust ? "Done" : "Adjust view"}
            </Button>
          )}
          {onCropModeChange && (
            <Button size="sm" variant={cropMode ? "default" : "outline"} className="h-8" onClick={() => onCropModeChange(!cropMode)}>
              <Crop className="mr-1.5 h-3.5 w-3.5" /> {cropMode ? "Apply" : "Crop"}
            </Button>
          )}
        </div>
      )}
      {background.crop && (
        <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => s({ crop: null })}>
          <RotateCcw className="mr-1.5 h-3 w-3" /> Reset crop
        </Button>
      )}
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
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={() => s({ hidden: !background.hidden })}>
          {background.hidden ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hidden</> : <><Eye className="mr-1.5 h-3.5 w-3.5" /> Visible</>}
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => s({ locked: !background.locked })}>
          {background.locked ? <><Lock className="mr-1.5 h-3.5 w-3.5" /> Locked</> : <><Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlocked</>}
        </Button>
      </div>
    </div>
  );
}
