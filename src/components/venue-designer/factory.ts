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
