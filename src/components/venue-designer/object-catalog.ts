// Single source of truth for every drawing tool, preset object, and library category.
// Used by the tool strip, left Object Library, Insert menu, and placement logic.

export type ObjectShape = "rect" | "circle" | "text";

export type ObjectDef = {
  type: string;
  shape: ObjectShape;
  label: string;
  defaultLayerKind: string;
  size: { w: number; h: number };
  fill: string;
  stroke: string;
  category: LibraryCategory;
};

export type LibraryCategory =
  | "Booths"
  | "Buildings"
  | "Roads"
  | "Parking"
  | "Utilities"
  | "Landscaping"
  | "Signs"
  | "Furniture"
  | "Custom";

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  "Booths",
  "Buildings",
  "Roads",
  "Parking",
  "Utilities",
  "Landscaping",
  "Signs",
  "Furniture",
  "Custom",
];

const P = "hsl(var(--primary))";

export const OBJECT_CATALOG: ObjectDef[] = [
  // ── Booths / vendor stalls ────────────────────────────────────────────────
  { type: "booth",          shape: "rect",   label: "Booth",           category: "Booths",      defaultLayerKind: "booths",    size: { w: 10, h: 10 }, fill: "hsl(var(--primary) / 0.18)", stroke: P },
  { type: "sponsor_banner", shape: "rect",   label: "Sponsor Banner",  category: "Booths",      defaultLayerKind: "booths",    size: { w: 12, h: 4 },  fill: "#fde68a", stroke: "#b45309" },
  { type: "food_truck",     shape: "rect",   label: "Food Truck",      category: "Booths",      defaultLayerKind: "booths",    size: { w: 22, h: 8 },  fill: "#fecaca", stroke: "#b91c1c" },
  { type: "trailer",        shape: "rect",   label: "Trailer",         category: "Booths",      defaultLayerKind: "booths",    size: { w: 24, h: 8 },  fill: "#e5e7eb", stroke: "#374151" },
  { type: "beer_garden",    shape: "rect",   label: "Beer Garden",     category: "Booths",      defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#fef3c7", stroke: "#a16207" },
  { type: "food_court",     shape: "rect",   label: "Food Court",      category: "Booths",      defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#fed7aa", stroke: "#c2410c" },
  { type: "picnic_area",    shape: "rect",   label: "Picnic Area",     category: "Booths",      defaultLayerKind: "custom",    size: { w: 30, h: 20 }, fill: "#d9f99d", stroke: "#4d7c0f" },

  // ── Buildings / structures ────────────────────────────────────────────────
  { type: "building",       shape: "rect",   label: "Building",        category: "Buildings",   defaultLayerKind: "buildings", size: { w: 40, h: 30 }, fill: "#e5e7eb", stroke: "#4b5563" },
  { type: "stage",          shape: "rect",   label: "Stage",           category: "Buildings",   defaultLayerKind: "buildings", size: { w: 30, h: 20 }, fill: "#c7d2fe", stroke: "#4338ca" },
  { type: "pavilion",       shape: "rect",   label: "Pavilion",        category: "Buildings",   defaultLayerKind: "buildings", size: { w: 30, h: 20 }, fill: "#ddd6fe", stroke: "#6d28d9" },
  { type: "tent",           shape: "rect",   label: "Tent",            category: "Buildings",   defaultLayerKind: "buildings", size: { w: 20, h: 20 }, fill: "#fef9c3", stroke: "#a16207" },
  { type: "restroom",       shape: "rect",   label: "Restroom",        category: "Buildings",   defaultLayerKind: "buildings", size: { w: 15, h: 12 }, fill: "#e0f2fe", stroke: "#0369a1" },
  { type: "ticket",         shape: "rect",   label: "Ticket Booth",    category: "Buildings",   defaultLayerKind: "buildings", size: { w: 10, h: 8 },  fill: "#fee2e2", stroke: "#b91c1c" },
  { type: "info",           shape: "rect",   label: "Info Booth",      category: "Buildings",   defaultLayerKind: "buildings", size: { w: 10, h: 8 },  fill: "#dbeafe", stroke: "#1d4ed8" },
  { type: "registration",   shape: "rect",   label: "Registration",    category: "Buildings",   defaultLayerKind: "buildings", size: { w: 12, h: 8 },  fill: "#e0e7ff", stroke: "#3730a3" },
  { type: "first_aid",      shape: "rect",   label: "First Aid",       category: "Buildings",   defaultLayerKind: "buildings", size: { w: 10, h: 8 },  fill: "#fecaca", stroke: "#dc2626" },
  { type: "security",       shape: "rect",   label: "Security",        category: "Buildings",   defaultLayerKind: "buildings", size: { w: 10, h: 8 },  fill: "#e5e7eb", stroke: "#111827" },
  { type: "atm",            shape: "rect",   label: "ATM",             category: "Buildings",   defaultLayerKind: "buildings", size: { w: 6,  h: 6 },  fill: "#d1fae5", stroke: "#047857" },
  { type: "playground",     shape: "rect",   label: "Playground",      category: "Buildings",   defaultLayerKind: "custom",    size: { w: 30, h: 20 }, fill: "#fbcfe8", stroke: "#be185d" },

  // ── Roads / circulation ──────────────────────────────────────────────────
  { type: "road",           shape: "rect",   label: "Road",            category: "Roads",       defaultLayerKind: "roads",     size: { w: 60, h: 12 }, fill: "#d1d5db", stroke: "#6b7280" },
  { type: "walkway",        shape: "rect",   label: "Walkway",         category: "Roads",       defaultLayerKind: "roads",     size: { w: 40, h: 6 },  fill: "#e5e7eb", stroke: "#9ca3af" },
  { type: "fence",          shape: "rect",   label: "Fence",           category: "Roads",       defaultLayerKind: "roads",     size: { w: 40, h: 1 },  fill: "#78350f", stroke: "#78350f" },
  { type: "gate",           shape: "rect",   label: "Gate",            category: "Roads",       defaultLayerKind: "roads",     size: { w: 8,  h: 2 },  fill: "#a3a3a3", stroke: "#404040" },

  // ── Parking ──────────────────────────────────────────────────────────────
  { type: "parking",        shape: "rect",   label: "Parking Lot",     category: "Parking",     defaultLayerKind: "roads",     size: { w: 60, h: 40 }, fill: "#f3f4f6", stroke: "#6b7280" },

  // ── Utilities ────────────────────────────────────────────────────────────
  { type: "generator",      shape: "rect",   label: "Generator",       category: "Utilities",   defaultLayerKind: "utilities", size: { w: 6,  h: 4 },  fill: "#fde68a", stroke: "#a16207" },
  { type: "electrical",     shape: "rect",   label: "Electrical Panel",category: "Utilities",   defaultLayerKind: "utilities", size: { w: 4,  h: 3 },  fill: "#fef08a", stroke: "#a16207" },
  { type: "water",          shape: "circle", label: "Water Hookup",    category: "Utilities",   defaultLayerKind: "utilities", size: { w: 4,  h: 4 },  fill: "#bae6fd", stroke: "#0369a1" },
  { type: "hydrant",        shape: "circle", label: "Fire Hydrant",    category: "Utilities",   defaultLayerKind: "utilities", size: { w: 3,  h: 3 },  fill: "#ef4444", stroke: "#7f1d1d" },
  { type: "dumpster",       shape: "rect",   label: "Dumpster",        category: "Utilities",   defaultLayerKind: "utilities", size: { w: 6,  h: 4 },  fill: "#4b5563", stroke: "#111827" },

  // ── Landscaping ──────────────────────────────────────────────────────────
  { type: "tree",           shape: "circle", label: "Tree",            category: "Landscaping", defaultLayerKind: "custom",    size: { w: 8,  h: 8 },  fill: "#86efac", stroke: "#166534" },
  { type: "bush",           shape: "circle", label: "Bush",            category: "Landscaping", defaultLayerKind: "custom",    size: { w: 4,  h: 4 },  fill: "#bef264", stroke: "#4d7c0f" },

  // ── Signs ────────────────────────────────────────────────────────────────
  { type: "sign",           shape: "rect",   label: "Sign",            category: "Signs",       defaultLayerKind: "labels",    size: { w: 6,  h: 3 },  fill: "#f9fafb", stroke: "#374151" },
  { type: "arrow",          shape: "rect",   label: "Arrow",           category: "Signs",       defaultLayerKind: "labels",    size: { w: 8,  h: 3 },  fill: "#fef3c7", stroke: "#a16207" },
  { type: "measurement",    shape: "rect",   label: "Measurement",     category: "Signs",       defaultLayerKind: "labels",    size: { w: 20, h: 1 },  fill: "hsl(var(--primary))", stroke: P },

  // ── Furniture ────────────────────────────────────────────────────────────
  { type: "table",          shape: "rect",   label: "Table",           category: "Furniture",   defaultLayerKind: "custom",    size: { w: 6,  h: 3 },  fill: "#fef3c7", stroke: "#a16207" },
  { type: "chair",          shape: "rect",   label: "Chair",           category: "Furniture",   defaultLayerKind: "custom",    size: { w: 2,  h: 2 },  fill: "#fde68a", stroke: "#78350f" },
  { type: "bench",          shape: "rect",   label: "Bench",           category: "Furniture",   defaultLayerKind: "custom",    size: { w: 6,  h: 2 },  fill: "#e7e5e4", stroke: "#78716c" },
];

export const OBJECT_DEF_BY_TYPE: Record<string, ObjectDef> = Object.fromEntries(
  OBJECT_CATALOG.map((o) => [o.type, o])
);

export function catalogByCategory(): Record<LibraryCategory, ObjectDef[]> {
  const acc = {} as Record<LibraryCategory, ObjectDef[]>;
  for (const c of LIBRARY_CATEGORIES) acc[c] = [];
  for (const o of OBJECT_CATALOG) acc[o.category].push(o);
  return acc;
}
