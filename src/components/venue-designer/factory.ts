import type { AnyElement, BoothElement, IconKey } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

let boothCounter = 0;
export const resetBoothCounter = (n: number) => { boothCounter = n; };

export function makeBooth(x: number, y: number): BoothElement {
  boothCounter += 1;
  return {
    id: uid(),
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

export function makeShape(kind: "rect" | "circle" | "triangle" | "line", x: number, y: number): AnyElement {
  return {
    id: uid(),
    kind,
    x,
    y,
    w: kind === "line" ? 20 : 12,
    h: kind === "line" ? 0 : 12,
    rotation: 0,
    fill: kind === "line" ? "transparent" : "hsl(var(--muted))",
    stroke: "hsl(var(--foreground))",
    strokeWidth: 1,
    strokeStyle: "solid",
  } as AnyElement;
}

export function makeText(x: number, y: number): AnyElement {
  return {
    id: uid(),
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

export function makeIcon(iconKey: IconKey, x: number, y: number): AnyElement {
  return {
    id: uid(),
    kind: "icon",
    x,
    y,
    w: 8,
    h: 8,
    rotation: 0,
    iconKey,
    tint: "hsl(var(--primary))",
  };
}

type PresetKind = "road" | "walkway" | "building" | "parking" | "measure" | "table" | "chair" | "fence";

const PRESETS: Record<PresetKind, { kind: "rect" | "line"; w: number; h: number; fill: string; stroke: string; strokeWidth: number; strokeStyle: "solid" | "dashed"; name: string }> = {
  road:     { kind: "rect", w: 60, h: 12, fill: "hsl(0 0% 30%)",  stroke: "hsl(0 0% 90%)", strokeWidth: 0.4, strokeStyle: "dashed", name: "Road" },
  walkway:  { kind: "rect", w: 40, h: 6,  fill: "hsl(30 25% 75%)", stroke: "hsl(30 25% 55%)", strokeWidth: 0.3, strokeStyle: "solid", name: "Walkway" },
  building: { kind: "rect", w: 30, h: 20, fill: "hsl(210 15% 55%)", stroke: "hsl(210 20% 30%)", strokeWidth: 0.6, strokeStyle: "solid", name: "Building" },
  parking:  { kind: "rect", w: 40, h: 20, fill: "hsl(0 0% 45%)",  stroke: "hsl(0 0% 90%)",  strokeWidth: 0.4, strokeStyle: "dashed", name: "Parking" },
  measure:  { kind: "line", w: 20, h: 0,  fill: "transparent",     stroke: "hsl(var(--primary))", strokeWidth: 0.4, strokeStyle: "solid", name: "Measurement" },
  table:    { kind: "rect", w: 6,  h: 3,  fill: "hsl(30 40% 65%)", stroke: "hsl(30 40% 35%)", strokeWidth: 0.3, strokeStyle: "solid", name: "Table" },
  chair:    { kind: "rect", w: 2,  h: 2,  fill: "hsl(210 15% 70%)", stroke: "hsl(210 15% 40%)", strokeWidth: 0.2, strokeStyle: "solid", name: "Chair" },
  fence:    { kind: "line", w: 30, h: 0,  fill: "transparent",     stroke: "hsl(30 25% 30%)", strokeWidth: 0.5, strokeStyle: "dashed", name: "Fence" },
};

export function makePreset(kind: PresetKind, x: number, y: number): AnyElement {
  const p = PRESETS[kind];
  return {
    id: uid(),
    kind: p.kind,
    x: x - p.w / 2,
    y: y - Math.max(p.h, 1) / 2,
    w: p.w,
    h: p.h,
    rotation: 0,
    fill: p.fill,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    strokeStyle: p.strokeStyle,
    name: p.name,
  } as AnyElement;
}



export const ICONS: Array<{ key: IconKey; label: string }> = [
  { key: "booth_canopy", label: "Canopy booth" },
  { key: "table", label: "Table" },
  { key: "chair", label: "Chair" },
  { key: "food", label: "Food truck" },
  { key: "tree", label: "Tree" },
  { key: "fence", label: "Fence" },
  { key: "road", label: "Road" },
  { key: "building", label: "Building" },
  { key: "restroom", label: "Restroom" },
  { key: "stage", label: "Stage" },
  { key: "parking", label: "Parking" },
  { key: "entrance", label: "Entrance" },
  { key: "first_aid", label: "First aid" },
  { key: "atm", label: "ATM" },
  { key: "info", label: "Info" },
  { key: "arrow", label: "Arrow" },
];

export function describe(el: AnyElement): string {
  if (el.name) return el.name;
  if (el.kind === "booth") return `Booth ${el.label}`;
  if (el.kind === "text") return `Text: ${el.text.slice(0, 20)}`;
  if (el.kind === "icon") return `Icon: ${el.iconKey}`;
  return el.kind.charAt(0).toUpperCase() + el.kind.slice(1);
}

export { uid };
