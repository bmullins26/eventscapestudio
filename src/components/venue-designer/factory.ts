import type { AnyElement, BoothElement, IconElement, IconKey, TextElement } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Mint a stable UUID for a new object. Prefers crypto.randomUUID when
 * available (SSR + modern browsers), falls back to a compact random string.
 * The result is stored on element.objectId and survives label/renumbering.
 */
export function makeObjectId(): string {
  try {
    const g = globalThis as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch { /* ignore */ }
  return `obj_${uid()}${uid()}`;
}

let boothCounter = 0;
export const resetBoothCounter = (n: number) => { boothCounter = n; };

export function makeBooth(x: number, y: number): BoothElement {
  boothCounter += 1;
  return {
    id: uid(),
    objectId: makeObjectId(),
    kind: "booth",
    x,
    y,
    w: 10,
    h: 10,
    rotation: 0,
    label: String(boothCounter),
    price: null,
    amenities: [],
    fill: "hsl(var(--card))",
    stroke: "hsl(var(--primary))",
    strokeWidth: 1,
    strokeStyle: "solid",
    radius: 1,
    fontSize: 3,
    fontWeight: 600,
  };
}

export function makeText(x: number, y: number): TextElement {
  return {
    id: uid(),
    objectId: makeObjectId(),
    kind: "text",
    x,
    y,
    w: 24,
    h: 6,
    rotation: 0,
    text: "Label",
    color: "hsl(var(--foreground))",
    fontSize: 5,
    fontWeight: 600,
  };
}

export function makeIcon(iconKey: IconKey, x: number, y: number): IconElement {
  const label = ICONS.find((i) => i.key === iconKey)?.label ?? "";
  return {
    id: uid(),
    objectId: makeObjectId(),
    kind: "icon",
    x,
    y,
    w: 8,
    h: 8,
    rotation: 0,
    iconKey,
    tint: "hsl(var(--primary))",
    name: label,
  };
}

type PresetKind = "road" | "walkway" | "building" | "parking" | "measure" | "table" | "chair" | "fence";

const PRESETS: Record<PresetKind, { iconKey: IconKey; w: number; h: number; name: string }> = {
  road:     { iconKey: "road",     w: 60, h: 12, name: "Road" },
  walkway:  { iconKey: "walkway",  w: 40, h: 6,  name: "Walkway" },
  building: { iconKey: "building", w: 30, h: 20, name: "Building" },
  parking:  { iconKey: "parking",  w: 40, h: 20, name: "Parking" },
  measure:  { iconKey: "measure",  w: 20, h: 4,  name: "Measurement" },
  table:    { iconKey: "table",    w: 8,  h: 4,  name: "Table" },
  chair:    { iconKey: "chair",    w: 3,  h: 3,  name: "Chair" },
  fence:    { iconKey: "fence",    w: 30, h: 4,  name: "Fence" },
};

export function makePreset(kind: PresetKind, x: number, y: number): IconElement {
  const p = PRESETS[kind];
  return {
    id: uid(),
    objectId: makeObjectId(),
    kind: "icon",
    x: x - p.w / 2,
    y: y - p.h / 2,
    w: p.w,
    h: p.h,
    rotation: 0,
    iconKey: p.iconKey,
    tint: "hsl(var(--foreground))",
    name: p.name,
  };
}

export const ICONS: Array<{ key: IconKey; label: string }> = [
  { key: "booth_canopy", label: "Canopy booth" },
  { key: "table", label: "Table" },
  { key: "chair", label: "Chair" },
  { key: "food", label: "Food truck" },
  { key: "tree", label: "Tree" },
  { key: "fence", label: "Fence" },
  { key: "road", label: "Road" },
  { key: "walkway", label: "Walkway" },
  { key: "building", label: "Building" },
  { key: "restroom", label: "Restroom" },
  { key: "stage", label: "Stage" },
  { key: "parking", label: "Parking" },
  { key: "entrance", label: "Entrance" },
  { key: "first_aid", label: "First aid" },
  { key: "atm", label: "ATM" },
  { key: "info", label: "Info" },
  { key: "arrow", label: "Arrow" },
  { key: "measure", label: "Measurement" },
];

export function describe(el: AnyElement): string {
  if (el.name) return el.name;
  if (el.kind === "booth") return `Booth ${el.label}`;
  if (el.kind === "text") return `Text: ${el.text.slice(0, 20)}`;
  if (el.kind === "icon") return ICONS.find((i) => i.key === el.iconKey)?.label ?? "Icon";
  return "Object";
}

/**
 * Filter out any legacy element kinds (rect/circle/triangle/line) that may
 * exist in previously-saved layouts. Primitives are no longer supported.
 */
export function stripLegacyElements(elements: AnyElement[]): AnyElement[] {
  const allowed = new Set(["booth", "text", "icon"]);
  return elements.filter((e) => allowed.has((e as { kind: string }).kind));
}

/**
 * Backfill objectId on any element loaded from a legacy layout that predates
 * the persistent-object-id migration. Idempotent: elements that already have
 * one are untouched.
 */
export function ensureObjectIds(elements: AnyElement[]): AnyElement[] {
  let mutated = false;
  const next = elements.map((el) => {
    if (el.objectId && typeof el.objectId === "string" && el.objectId.length > 0) return el;
    mutated = true;
    return { ...el, objectId: makeObjectId() } as AnyElement;
  });
  return mutated ? next : elements;
}

export { uid };
