/* -------------------------------------------------------------------------
 * Workspace Adapter — the only bridge between EventScape persistence
 * (`venue_layouts.elements: AnyElement[]`) and the Venue Workspace SDK.
 *
 * The SDK must never import Supabase, server functions, or EventScape types.
 * It consumes WorkspaceObject-shaped inputs (booths + placed objects +
 * background) via `WorkspaceDataProvider` and emits the same shape on save.
 *
 * Round-trip contract: fromLayout(toLayout(x)) === x for stable `objectId`s,
 * ordering, and known properties.
 * ---------------------------------------------------------------------- */

// Local, backend-agnostic types (mirrors of SDK shapes; kept here so the SDK
// stays decoupled and the adapter is the only place that touches persistence).
export type BoothStatus =
  | "available" | "reserved" | "paid" | "pending" | "sponsor" | "unavailable";

export interface AdapterBooth {
  id: string;              // stable objectId (uuid) — same as row/col label fallback
  row: string;
  col: number;
  x: number; y: number; w: number; h: number;
  status: BoothStatus;
  vendor?: string;
  vendor_profile_id?: string | null;
  category?: string;
  price: number;
  electric: boolean;
  water: boolean;
  corner: boolean;
  premium: boolean;
  size: string;
  variant?: "standard_booth" | "table_6ft" | "table_8ft" | "round_table" | "food_truck_space";
  rotation?: number;
  locked?: boolean;
  notes?: string;
}

export type PlacedKind =
  | "tree" | "building" | "stage" | "parking" | "fence" | "rect" | "text"
  | "road" | "walkway" | "table6" | "table8" | "tableRound" | "chair"
  | "pavilion" | "tent" | "ticket_booth" | "info_booth" | "food_truck"
  | "restroom" | "atm" | "trash" | "bench" | "picnic_table"
  | "electrical" | "generator" | "water_hookup" | "sewer"
  | "oak_tree" | "pine_tree" | "shrub" | "flower_bed"
  | "cocktail_table" | "service_road" | "emergency_lane"
  // Furniture (non-rentable)
  | "furn_table4" | "furn_banquet" | "furn_folding_chair" | "furn_banquet_chair"
  | "furn_ceremony_chair" | "furn_bar_stool" | "furn_display_table" | "furn_display_rack"
  | "furn_display_shelf" | "furn_podium" | "furn_couch";

export interface AdapterPlaced {
  id: string;              // "p:<uuid>" — prefix required by SDK selection engine
  objectId?: string;       // stable uuid (persisted); derived from id when absent
  kind: PlacedKind;
  x: number; y: number; w: number; h: number;
  label?: string;
  rotation?: number;
  locked?: boolean;
  notes?: string;
  tags?: string[];
  furniture?: boolean;
  meta?: Record<string, unknown>;
}

export interface AdapterBackground {
  url: string;
  x: number; y: number; w: number; h: number;
  opacity: number;
  locked: boolean;
  label: string;
  rotation?: number;
}

export interface WorkspaceCanvas {
  w: number;
  h: number;
}

export interface WorkspaceState {
  booths: AdapterBooth[];
  objects: AdapterPlaced[];
  background: AdapterBackground | null;
  canvas?: WorkspaceCanvas;
}

/** Unified external model — one collection, one shape. */
export interface WorkspaceObject {
  id: string;
  type: "booth" | PlacedKind;
  geometry: { x: number; y: number; w: number; h: number; rotation: number };
  style?: Record<string, unknown>;
  metadata: Record<string, unknown> & { rentable?: boolean };
  layer?: string | null;
  locked?: boolean;
  hidden?: boolean;
}

const RENTABLE: ReadonlySet<string> = new Set<string>([
  "booth", "table6", "table8", "tableRound", "cocktail_table",
  "food_truck", "pavilion", "tent", "ticket_booth", "info_booth",
]);

function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function parseRowCol(label: string): { row: string; col: number } {
  const m = /^([A-Za-z]+)(\d+)/.exec(label ?? "");
  if (m) return { row: m[1], col: Number(m[2]) };
  return { row: label || "?", col: 0 };
}

/* ------------------------------ From persistence ---------------------------- */

export function fromLayout(elements: Array<Record<string, unknown>> | null | undefined, settings?: Record<string, unknown> | null): WorkspaceState {
  const els = Array.isArray(elements) ? elements : [];
  const booths: AdapterBooth[] = [];
  const objects: AdapterPlaced[] = [];

  for (const el of els) {
    const kind = String(el.kind ?? "");
    const objectId = String(el.objectId ?? el.id ?? uuid());
    const x = Number(el.x ?? 0);
    const y = Number(el.y ?? 0);
    const w = Number(el.w ?? 0);
    const h = Number(el.h ?? 0);

    if (kind === "booth") {
      const label = String(el.label ?? el.name ?? "");
      const { row, col } = parseRowCol(label);
      booths.push({
        id: objectId,
        row,
        col,
        x, y, w, h,
        status: (el.status as BoothStatus | undefined) ?? "available",
        vendor: (el.vendor as string | undefined) ?? undefined,
        vendor_profile_id: (el.vendor_profile_id as string | null | undefined) ?? null,
        category: (el.category as string | undefined) ?? undefined,
        price: Number(el.price ?? 0),
        electric: Boolean(el.isElectric ?? el.electric),
        water: Boolean(el.isWater ?? el.water),
        corner: Boolean(el.isCorner ?? el.corner),
        premium: Boolean(el.isPremium ?? el.premium),
        size: String(el.size ?? `${Math.round(w)}′×${Math.round(h)}′`),
        variant: (el.variant as AdapterBooth["variant"]) ?? undefined,
        rotation: Number(el.rotation ?? 0),
        locked: Boolean(el.locked),
        notes: (el.notes as string | undefined) ?? undefined,
      });
      continue;
    }

    // Everything else = placed object. The SDK's own kind is stored in
    // meta.placedKind when the legacy element used kind:"icon".
    const placedKind: PlacedKind = (kind === "placed"
      ? (el.placedKind as PlacedKind)
      : (kind === "icon" ? ((el.iconKey as PlacedKind) ?? "tree") : (kind as PlacedKind))) ?? "tree";

    objects.push({
      id: `p:${objectId}`,
      objectId,
      kind: placedKind,
      x, y, w, h,
      label: (el.name as string | undefined) ?? (el.label as string | undefined) ?? undefined,
      rotation: Number(el.rotation ?? 0),
      locked: Boolean(el.locked),
      notes: (el.notes as string | undefined) ?? undefined,
      tags: Array.isArray(el.tags) ? (el.tags as string[]) : undefined,
      furniture: Boolean(el.furniture),
      meta: (el.meta as Record<string, unknown> | undefined) ?? undefined,
    });
  }

  const bgSrc = (settings?.background ?? null) as Record<string, unknown> | null;
  const background: AdapterBackground | null = bgSrc
    ? {
        url: String(bgSrc.url ?? ""),
        x: Number(bgSrc.x ?? 0),
        y: Number(bgSrc.y ?? 0),
        w: Number(bgSrc.w ?? 0),
        h: Number(bgSrc.h ?? 0),
        opacity: Number(bgSrc.opacity ?? 0.9),
        locked: Boolean(bgSrc.locked),
        label: String(bgSrc.label ?? bgSrc.attribution ?? "Background"),
        rotation: Number(bgSrc.rotation ?? 0),
      }
    : null;

  const canvasSrc = (settings?.canvas ?? null) as Record<string, unknown> | null;
  const canvas: WorkspaceCanvas | undefined = canvasSrc && (canvasSrc.w || canvasSrc.h)
    ? { w: Number(canvasSrc.w ?? 1110), h: Number(canvasSrc.h ?? 560) }
    : undefined;

  return { booths, objects, background, canvas };
}

/* ------------------------------- To persistence ----------------------------- */

export function toLayout(state: WorkspaceState): {
  elements: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
} {
  const elements: Array<Record<string, unknown>> = [];

  for (const b of state.booths) {
    elements.push({
      id: b.id,
      objectId: b.id,
      kind: "booth",
      x: b.x, y: b.y, w: b.w, h: b.h,
      rotation: b.rotation ?? 0,
      label: `${b.row}${b.col || ""}`,
      name: `${b.row}${b.col || ""}`,
      status: b.status,
      price: b.price,
      category: b.category ?? null,
      isElectric: b.electric,
      isWater: b.water,
      isCorner: b.corner,
      isPremium: b.premium,
      size: b.size,
      variant: b.variant ?? null,
      locked: b.locked ?? false,
      notes: b.notes ?? null,
    });
  }

  for (const o of state.objects) {
    const oid = o.objectId ?? o.id.replace(/^p:/, "") ?? uuid();
    elements.push({
      id: oid,
      objectId: oid,
      kind: "placed",
      placedKind: o.kind,
      x: o.x, y: o.y, w: o.w, h: o.h,
      rotation: o.rotation ?? 0,
      name: o.label ?? "",
      locked: o.locked ?? false,
      notes: o.notes ?? null,
      tags: o.tags ?? [],
      furniture: o.furniture ?? false,
      meta: o.meta ?? {},
    });
  }

  const settings: Record<string, unknown> = {};
  if (state.background) settings.background = { ...state.background };
  if (state.canvas) settings.canvas = { ...state.canvas };

  return { elements, settings };
}

/* ---------------------- Unified WorkspaceObject projection ------------------ */

export function toWorkspaceObjects(state: WorkspaceState): WorkspaceObject[] {
  const out: WorkspaceObject[] = [];
  for (const b of state.booths) {
    out.push({
      id: b.id,
      type: "booth",
      geometry: { x: b.x, y: b.y, w: b.w, h: b.h, rotation: b.rotation ?? 0 },
      metadata: {
        rentable: true,
        row: b.row, col: b.col,
        status: b.status, price: b.price, category: b.category ?? null,
        vendor: b.vendor ?? null,
        electric: b.electric, water: b.water, corner: b.corner, premium: b.premium,
        size: b.size,
      },
    });
  }
  for (const o of state.objects) {
    out.push({
      id: o.objectId ?? o.id.replace(/^p:/, ""),
      type: o.kind,
      geometry: { x: o.x, y: o.y, w: o.w, h: o.h, rotation: o.rotation ?? 0 },
      metadata: { rentable: RENTABLE.has(o.kind), label: o.label ?? "", ...(o.meta ?? {}) },
    });
  }
  return out;
}
