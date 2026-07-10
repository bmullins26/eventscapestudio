import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Search, Eye, EyeOff, Lock, Unlock, Trash2, Plus, BookmarkPlus, Upload, Loader2, Sparkles, LayoutTemplate, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OBJECT_CATALOG, LIBRARY_CATEGORIES, type LibraryCategory } from "./object-catalog";

// ---------- Object Library (left panel) ----------

export function ObjectLibrary({ activeType, onPick, libraryItems, activeLibraryId, onPickLibrary, onDeleteLibrary }: {
  activeType: string | null;
  onPick: (type: string) => void;
  libraryItems: any[];
  activeLibraryId: string | null;
  onPickLibrary: (item: any) => void;
  onDeleteLibrary: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.toLowerCase();
  const byCat: Record<string, typeof OBJECT_CATALOG> = {};
  for (const o of OBJECT_CATALOG) {
    if (q && !o.label.toLowerCase().includes(ql)) continue;
    (byCat[o.category] ??= []).push(o);
  }
  const orgItemsFiltered = (libraryItems ?? []).filter((i: any) => !q || (i.name?.toLowerCase().includes(ql) || i.category?.toLowerCase().includes(ql)));
  const orgByCategory = orgItemsFiltered.reduce<Record<string, any[]>>((acc, item) => {
    const c = item.category || "Custom";
    (acc[c] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library..." className="h-8 pl-7 text-xs" />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {orgItemsFiltered.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="h-3 w-3 fill-current text-amber-500" /> My Library
            </div>
            {Object.entries(orgByCategory).map(([cat, items]) => (
              <div key={cat} className="mb-2">
                <div className="mb-1 text-[10px] text-muted-foreground">{cat}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map((it: any) => {
                    const style = it.default_style ?? {};
                    const active = activeLibraryId === it.id;
                    return (
                      <div key={it.id} className="group relative">
                        <button
                          onClick={() => onPickLibrary(it)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData("application/x-vd-object", JSON.stringify({ kind: "library", item: it }));
                          }}
                          className={cn(
                            "w-full cursor-grab rounded border bg-background px-2 py-2 text-left text-xs transition hover:border-primary hover:bg-primary/5 active:cursor-grabbing",
                            active && "border-primary bg-primary/10"
                          )}
                        >
                          <div className="mb-1 h-4 w-full rounded" style={{ background: style.fill ?? "#f3f4f6", border: `1px solid ${style.stroke ?? "#9ca3af"}` }} />
                          <div className="truncate">{it.name}</div>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${it.name}" from library?`)) onDeleteLibrary(it.id); }}
                          className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete from library"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {LIBRARY_CATEGORIES.filter((c) => (byCat[c]?.length ?? 0) > 0).map((cat) => (
          <div key={cat}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {byCat[cat].map((it) => (
                <button
                  key={it.type}
                  onClick={() => onPick(it.type)}
                  className={cn(
                    "rounded border bg-background px-2 py-2 text-left text-xs transition hover:border-primary hover:bg-primary/5",
                    activeType === it.type && "border-primary bg-primary/10"
                  )}
                  title={it.label}
                >
                  <div className="mb-1 h-4 w-full rounded" style={{ background: it.fill, border: `1px solid ${it.stroke}` }} />
                  <div className="truncate">{it.label}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Inspector (right panel) ----------

export function Inspector({ object, layers, onPatch, onCommitPatch, onDelete, onSaveToLibrary, savingLibrary }: {
  object: any;
  layers: any[];
  onPatch: (patch: any) => void;
  onCommitPatch: (patch: any) => void;
  onDelete: () => void;
  onSaveToLibrary: () => void;
  savingLibrary: boolean;
}) {
  const g = object.geometry ?? {};
  const m = object.metadata ?? {};
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</div>
        <div className="truncate text-sm font-medium">{object.name ?? object.type}</div>
        <div className="text-xs text-muted-foreground">{object.type} · {object.shape}</div>
      </div>

      <Field label="Name">
        <Input defaultValue={object.name ?? ""} onBlur={(e) => e.target.value !== object.name && onCommitPatch({ name: e.target.value })} className="h-8" />
      </Field>

      <Field label="Layer">
        <Select value={object.layer_id ?? undefined} onValueChange={(v) => onCommitPatch({ layer_id: v })}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Layer" /></SelectTrigger>
          <SelectContent>{layers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>

      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X"><NumInput value={g.x ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, x: v } })} /></Field>
          <Field label="Y"><NumInput value={g.y ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, y: v } })} /></Field>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width"><NumInput value={g.w ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, w: v } })} /></Field>
          <Field label="Height"><NumInput value={g.h ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, h: v } })} /></Field>
        </div>
      </div>
      <Field label="Rotation°"><NumInput value={g.rotation ?? 0} onCommit={(v) => onCommitPatch({ geometry: { ...g, rotation: v } })} /></Field>

      <div className="flex items-center justify-between rounded border p-2 text-sm">
        <Label className="text-xs">Locked</Label>
        <Switch checked={!!object.locked} onCheckedChange={(v) => onCommitPatch({ locked: v })} />
      </div>
      <div className="flex items-center justify-between rounded border p-2 text-sm">
        <Label className="text-xs">Hidden</Label>
        <Switch checked={!!object.hidden} onCheckedChange={(v) => onCommitPatch({ hidden: v })} />
      </div>

      {object.type === "booth" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Booth</div>
          <Field label="Price"><NumInput value={m.price ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, price: v } })} /></Field>
          <Field label="Category">
            <Input defaultValue={m.category ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, category: e.target.value } })} className="h-8" />
          </Field>
          <Field label="Notes">
            <Input defaultValue={m.notes ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, notes: e.target.value } })} className="h-8" />
          </Field>
          <MetaSwitch label="Electric" value={!!m.electric} onChange={(v) => onCommitPatch({ metadata: { ...m, electric: v } })} />
          <MetaSwitch label="Water" value={!!m.water} onChange={(v) => onCommitPatch({ metadata: { ...m, water: v } })} />
          <MetaSwitch label="Premium" value={!!m.premium} onChange={(v) => onCommitPatch({ metadata: { ...m, premium: v } })} />
          <MetaSwitch label="Corner" value={!!m.corner} onChange={(v) => onCommitPatch({ metadata: { ...m, corner: v } })} />
          <MetaSwitch label="ADA" value={!!m.ada} onChange={(v) => onCommitPatch({ metadata: { ...m, ada: v } })} />
        </div>
      )}
      {(object.type === "building" || object.type === "stage" || object.type === "pavilion" || object.type === "tent") && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Structure</div>
          <Field label="Capacity"><NumInput value={m.capacity ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, capacity: v } })} /></Field>
          <MetaSwitch label="Indoor" value={!!m.indoor} onChange={(v) => onCommitPatch({ metadata: { ...m, indoor: v } })} />
          <MetaSwitch label="Electric" value={!!m.electric} onChange={(v) => onCommitPatch({ metadata: { ...m, electric: v } })} />
        </div>
      )}
      {(object.type === "parking") && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parking</div>
          <Field label="Capacity"><NumInput value={m.capacity ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, capacity: v } })} /></Field>
        </div>
      )}
      {(object.type === "electrical" || object.type === "generator") && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Utility</div>
          <Field label="Amps"><NumInput value={m.amps ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, amps: v } })} /></Field>
          <Field label="Circuits"><NumInput value={m.circuits ?? 0} onCommit={(v) => onCommitPatch({ metadata: { ...m, circuits: v } })} /></Field>
        </div>
      )}
      {(object.type === "sign" || object.type === "arrow") && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sign</div>
          <Field label="Text">
            <Input defaultValue={m.text ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, text: e.target.value } })} className="h-8" />
          </Field>
        </div>
      )}
      {object.type === "tree" && (
        <div className="space-y-2 rounded border p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tree</div>
          <Field label="Species">
            <Input defaultValue={m.species ?? ""} onBlur={(e) => onCommitPatch({ metadata: { ...m, species: e.target.value } })} className="h-8" />
          </Field>
          <MetaSwitch label="Protected" value={!!m.protected} onChange={(v) => onCommitPatch({ metadata: { ...m, protected: v } })} />
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={onSaveToLibrary} disabled={savingLibrary}>
        <BookmarkPlus className="mr-1 h-4 w-4" /> Save as asset
      </Button>

      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete object
      </Button>
    </div>
  );
}

export function VenueInspector({ venue }: { venue: any }) {
  return (
    <div className="space-y-3 p-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Venue</div>
      <div className="truncate text-sm font-medium">{venue?.name ?? "Venue"}</div>
      <div className="text-xs text-muted-foreground">Nothing selected. Pick an object on the canvas, or drag one from the Object Library.</div>
      <div className="rounded border p-2 text-xs">
        <div className="mb-1 text-muted-foreground">Canvas</div>
        <div>{venue?.canvas_width ?? 2000} × {venue?.canvas_height ?? 1500} {venue?.units ?? "ft"}</div>
      </div>
    </div>
  );
}

// ---------- Layers Panel ----------

export function LayerPanel({ layers, onToggleVisible, onToggleLocked, onRename, onDelete, onAdd }: {
  layers: any[];
  onToggleVisible: (l: any) => void;
  onToggleLocked: (l: any) => void;
  onRename: (l: any, name: string) => void;
  onDelete: (l: any) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <Button size="sm" variant="outline" className="w-full" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add layer
      </Button>
      {[...layers].sort((a, b) => (b.order_index ?? 0) - (a.order_index ?? 0)).map((l) => (
        <div key={l.id} className="flex items-center gap-1 rounded border bg-background px-2 py-1.5 text-sm">
          <button onClick={() => onToggleVisible(l)} className="text-muted-foreground hover:text-foreground" title="Toggle visibility">
            {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onToggleLocked(l)} className="text-muted-foreground hover:text-foreground" title="Toggle lock">
            {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
          <input
            defaultValue={l.name}
            onBlur={(e) => e.target.value !== l.name && onRename(l, e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={() => onDelete(l)} className="text-muted-foreground hover:text-destructive" title="Delete layer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Objects list ----------

export function ObjectsListPanel({ objects, layers, selectedId, onSelect, onToggleVisible, onToggleLocked, onDelete }: {
  objects: any[]; layers: any[]; selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (o: any) => void;
  onToggleLocked: (o: any) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.toLowerCase();
  const byLayer: Record<string, any[]> = {};
  for (const o of objects) {
    if (q && !(o.name ?? o.type).toLowerCase().includes(ql)) continue;
    (byLayer[o.layer_id ?? "_none"] ??= []).push(o);
  }
  const layerName = (id: string) => layers.find((l) => l.id === id)?.name ?? "No layer";
  return (
    <div className="space-y-2 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter objects..." className="h-8 pl-7 text-xs" />
      </div>
      {Object.entries(byLayer).length === 0 && (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">No objects yet.</div>
      )}
      {Object.entries(byLayer).map(([lid, list]) => (
        <div key={lid}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{layerName(lid)}</div>
          <div className="space-y-1">
            {list.map((o) => (
              <div key={o.id} className={cn("flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs", selectedId === o.id && "border-primary bg-primary/5")}>
                <button onClick={() => onToggleVisible(o)} className="text-muted-foreground hover:text-foreground">
                  {o.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => onToggleLocked(o)} className="text-muted-foreground hover:text-foreground">
                  {o.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => onSelect(o.id)} className="flex-1 truncate text-left">
                  {o.name ?? o.type}
                </button>
                <span className="text-[10px] text-muted-foreground">{o.type}</span>
                <button onClick={() => onDelete(o.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Reference / Assets panel ----------

export function ReferencePanel({ references, uploading, analyzingRefId, onUploadClick, onSelect, onToggleVisible, onDelete, onAiImport, selectedRefId }: {
  references: any[]; uploading: boolean; analyzingRefId: string | null;
  onUploadClick: () => void; onSelect: (r: any) => void;
  onToggleVisible: (r: any) => void; onDelete: (r: any) => void;
  onAiImport: (id: string) => void; selectedRefId: string | null;
}) {
  return (
    <div className="space-y-3 p-3">
      <Button size="sm" variant="outline" className="w-full" onClick={onUploadClick} disabled={uploading}>
        {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        {uploading ? "Uploading..." : "Upload reference"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Site plans, sketches, aerial photos, or map screenshots. Use AI Import to auto-trace objects.
      </p>
      {references.length === 0 ? (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          No references yet.
        </div>
      ) : references.map((r) => (
        <div key={r.id} className={cn("rounded border bg-background p-2", selectedRefId === r.id && "border-primary ring-1 ring-primary/40")}>
          <div className="mb-1.5 flex items-center gap-1">
            <button onClick={() => onToggleVisible(r)} className="text-muted-foreground hover:text-foreground">
              {r.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => onSelect(r)} className="flex-1 truncate text-left text-xs font-medium hover:underline">
              {r.label ?? "Reference"}
            </button>
            <button onClick={() => onDelete(r)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {r.signed_url ? (
            <button
              onClick={() => onSelect(r)}
              className="mb-1.5 block h-20 w-full overflow-hidden rounded bg-muted"
              style={{ backgroundImage: `url(${r.signed_url})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
              aria-label="Select reference"
            />
          ) : null}
          <Button
            size="sm" variant="secondary" className="w-full h-7 text-xs"
            onClick={() => onAiImport(r.id)}
            disabled={analyzingRefId === r.id}
          >
            {analyzingRefId === r.id ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Analyzing...</>
            ) : (
              <><Sparkles className="mr-1 h-3.5 w-3.5" />AI Import</>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function ReferenceInspector({ reference, onPatch, onDelete, onAiImport, analyzing }: {
  reference: any;
  onPatch: (patch: any) => void;
  onDelete: () => void;
  onAiImport: () => void;
  analyzing: boolean;
}) {
  const t = reference.transform ?? {};
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</div>
        <div className="truncate text-sm font-medium">{reference.label}</div>
      </div>
      <Field label="Opacity">
        <div className="flex items-center gap-2">
          <Slider value={[Math.round((reference.opacity ?? 0.5) * 100)]} onValueChange={(v) => onPatch({ opacity: v[0] / 100 })} max={100} step={5} />
          <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((reference.opacity ?? 0.5) * 100)}%</span>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><NumInput value={t.x ?? 0} onCommit={(v) => onPatch({ transform: { ...t, x: v } })} /></Field>
        <Field label="Y"><NumInput value={t.y ?? 0} onCommit={(v) => onPatch({ transform: { ...t, y: v } })} /></Field>
        <Field label="Width"><NumInput value={t.width ?? 0} onCommit={(v) => onPatch({ transform: { ...t, width: v } })} /></Field>
        <Field label="Height"><NumInput value={t.height ?? 0} onCommit={(v) => onPatch({ transform: { ...t, height: v } })} /></Field>
        <Field label="Rotation°"><NumInput value={t.rotation ?? 0} onCommit={(v) => onPatch({ transform: { ...t, rotation: v } })} /></Field>
      </div>
      <Button className="w-full" onClick={onAiImport} disabled={analyzing}>
        {analyzing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</>) : (<><Sparkles className="mr-2 h-4 w-4" />AI Import objects</>)}
      </Button>
      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete reference
      </Button>
    </div>
  );
}

// ---------- Versions / Templates ----------

export function VersionsPanel({ templates, publishing, restoringId, onPublish, onRestore, onDelete }: {
  templates: any[]; publishing: boolean; restoringId: string | null;
  onPublish: (label?: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <div className="space-y-3 p-3">
      <div className="rounded border bg-background p-2 space-y-2">
        <Label className="text-xs">New version label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Summer 2026 layout" className="h-8 text-xs" />
        <Button size="sm" className="w-full" disabled={publishing} onClick={() => { onPublish(label.trim() || undefined); setLabel(""); }}>
          {publishing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <LayoutTemplate className="mr-1 h-3.5 w-3.5" />}
          Publish current design
        </Button>
      </div>
      {templates.length === 0 ? (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">No published versions yet.</div>
      ) : templates.map((t) => (
        <div key={t.id} className="rounded border bg-background p-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-medium">v{t.version} · {t.label ?? "Untitled"}</div>
              <div className="text-[11px] text-muted-foreground">{t.published_at ? new Date(t.published_at).toLocaleDateString() : ""}</div>
            </div>
            <button onClick={() => onDelete(t.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete version">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {t.description ? <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{t.description}</div> : null}
          <Button size="sm" variant="outline" className="mt-2 h-7 w-full text-xs" disabled={restoringId === t.id} onClick={() => onRestore(t.id)}>
            {restoringId === t.id ? (<><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Restoring…</>) : "Restore to canvas"}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------- History / AI placeholders ----------

export function HistoryPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
      <div className="mb-1 text-sm font-medium">History</div>
      A timeline of every change on this venue will appear here. Click an entry to preview or revert.
    </div>
  );
}

export function AiPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
      <div className="mb-1 text-sm font-medium">AI</div>
      Ask AI to place booths, tent grids, or trace a reference. Proposals will show as a diff you can accept.
    </div>
  );
}

// ---------- ObjectShape (canvas render) ----------

export function ObjectShape({ obj, layerOpacity, selected, zoom, onPointerDown, onResizePointerDown }: {
  obj: any; layerOpacity: number; selected: boolean; zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent, handle: string) => void;
}) {
  const g = obj.geometry ?? {};
  const s = obj.style ?? {};
  const x = g.x ?? 0, y = g.y ?? 0, w = g.w ?? 10, h = g.h ?? 10;
  const rot = g.rotation ?? 0;
  const fill = s.fill ?? "hsl(var(--primary) / 0.2)";
  const stroke = selected ? "hsl(var(--primary))" : (s.stroke ?? "hsl(var(--border))");
  const strokeW = selected ? 2 / zoom : 1 / zoom;
  const transform = rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined;

  const body = obj.shape === "circle" ? (
    <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeW} />
  ) : obj.shape === "text" ? (
    <text x={x} y={y + h / 2} fill={s.color ?? "hsl(var(--foreground))"} fontSize={h}>{obj.name}</text>
  ) : (
    <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeW} rx={obj.type === "tree" ? w / 2 : 0} />
  );

  const handles = ["nw","n","ne","e","se","s","sw","w"];
  const handleSize = 8 / zoom;

  return (
    <g opacity={layerOpacity} transform={transform} style={{ cursor: obj.locked ? "not-allowed" : "move" }}>
      <g onPointerDown={onPointerDown}>{body}</g>
      {obj.type === "booth" && obj.name ? (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, h) * 0.3} fill="hsl(var(--foreground))" pointerEvents="none">
          {obj.name}
        </text>
      ) : null}
      {selected && (
        <>
          {handles.map((hd) => {
            const hx = hd.includes("w") ? x : hd.includes("e") ? x + w : x + w / 2;
            const hy = hd.includes("n") ? y : hd.includes("s") ? y + h : y + h / 2;
            return (
              <rect
                key={hd}
                x={hx - handleSize / 2} y={hy - handleSize / 2}
                width={handleSize} height={handleSize}
                fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1 / zoom}
                style={{ cursor: `${hd}-resize` }}
                onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, hd); }}
              />
            );
          })}
        </>
      )}
    </g>
  );
}

// ---------- helpers ----------

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
export function NumInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <Input
      type="number"
      className="h-8"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = parseFloat(v); if (!Number.isNaN(n) && n !== value) onCommit(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}
export function MetaSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <Label className="text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
export { LIBRARY_CATEGORIES };
export type { LibraryCategory };
