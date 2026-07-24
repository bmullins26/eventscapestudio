/* -------------------------------------------------------------------------
 * Developer-only demo layouts.
 *
 * Production code MUST NOT import this file. It is consumed exclusively by
 * `/dev/examples/*` routes to render read-only demonstration workspaces.
 * ---------------------------------------------------------------------- */
import type { WorkspaceCtx, PlacedObj } from "./App";

type Booth = NonNullable<WorkspaceCtx["booths"]>[number];

const ROWS = ["A", "B", "C", "D", "E", "F"];
const COLS = 12;
const W = 72, H = 58, GAP_X = 16, GAP_Y = 40;
const ORIGIN_X = 120, ORIGIN_Y = 120;
const CATEGORIES = ["Food", "Craft", "Retail", "Art", "Wellness", "Sponsor"];
const VENDORS = [
  "Blue Ridge Bakery", "Sunny Farms", "Peak Pottery", "Copper Coffee",
  "Wild Ink Prints", "Trail Tacos", "Riverbend Soap", "Alpine Honey",
  "Cedar & Sage", "Iron Fern Studio", "Golden Hour Jams", "North Star Wax",
];

function statusFor(row: string, col: number): Booth["status"] {
  if (row === "A" && col <= 3) return "sponsor";
  const seed = (row.charCodeAt(0) * 31 + col) % 7;
  if (seed === 0) return "paid";
  if (seed === 1) return "reserved";
  if (seed === 2) return "pending";
  if (seed === 6 && col > 10) return "unavailable";
  return "available";
}

function farmersMarketBooths(): Booth[] {
  const booths: Booth[] = [];
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 1; c <= COLS; c++) {
      const row = ROWS[r];
      const x = ORIGIN_X + (c - 1) * (W + GAP_X);
      const y = ORIGIN_Y + r * (H + GAP_Y);
      const status = statusFor(row, c);
      const corner = c === 1 || c === COLS;
      const premium = row === "A";
      const vIdx = (r * COLS + c) % VENDORS.length;
      const cIdx = (r + c) % CATEGORIES.length;
      booths.push({
        id: `${row}${c}`, row, col: c, x, y, w: W, h: H, status,
        vendor: status === "available" ? undefined : VENDORS[vIdx],
        category: CATEGORIES[cIdx],
        price: premium ? 350 : corner ? 275 : 200,
        electric: c % 2 === 0, water: row === "C" || row === "D",
        corner, premium, size: "10×10",
      });
    }
  }
  return booths;
}

function simpleBoothGrid(rows: number, cols: number, prefix: string, priceBase: number): Booth[] {
  const out: Booth[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const row = String.fromCharCode(65 + r);
      out.push({
        id: `${prefix}-${row}${c}`, row, col: c,
        x: ORIGIN_X + (c - 1) * (W + GAP_X),
        y: ORIGIN_Y + r * (H + GAP_Y),
        w: W, h: H,
        status: c % 3 === 0 ? "paid" : "available",
        category: CATEGORIES[(r + c) % CATEGORIES.length],
        price: priceBase,
        electric: c % 2 === 0, water: false,
        corner: c === 1 || c === cols, premium: r === 0,
        size: "10×10",
      });
    }
  }
  return out;
}

function placed(id: string, kind: PlacedObj["kind"], x: number, y: number, w: number, h: number, label?: string): PlacedObj {
  return { id: `p:${id}`, kind, x, y, w, h, label };
}

const DEFAULT_LAYERS: NonNullable<WorkspaceCtx["layers"]> = [
  { id: "l-booths", name: "Booths",    color: "#1565C0", visible: true, locked: false, kind: "booths" },
  { id: "l-roads",  name: "Roads",     color: "#616161", visible: true, locked: false, kind: "roads" },
  { id: "l-util",   name: "Utilities", color: "#F59E0B", visible: true, locked: false, kind: "utilities" },
  { id: "l-land",   name: "Landscape", color: "#2E7D32", visible: true, locked: false, kind: "landscape" },
  { id: "l-spon",   name: "Sponsors",  color: "#6A1B9A", visible: true, locked: false, kind: "sponsors" },
];

export const DEMO_EXAMPLES: Record<string, WorkspaceCtx & { title: string; blurb: string }> = {
  "farmers-market": {
    title: "Farmers Market",
    blurb: "72-booth outdoor market on a 6×12 grid with sponsor row.",
    venueName: "Riverside Fairgrounds",
    eventName: "Summer Farmers Market",
    workspaceMode: "example",
    booths: farmersMarketBooths(),
    objects: [
      placed("tree1", "oak_tree", 40, 60, 60, 60, "Oak"),
      placed("rest1", "restroom", 900, 60, 90, 60, "Restrooms"),
    ],
    layers: DEFAULT_LAYERS,
    readOnly: true,
  },
  "county-fair": {
    title: "County Fair",
    blurb: "Fairground with midway, food court, and vendor rows.",
    venueName: "County Fairgrounds",
    eventName: "Autumn County Fair",
    workspaceMode: "example",
    booths: simpleBoothGrid(4, 10, "cf", 300),
    objects: [
      placed("stage", "stage", 400, 20, 320, 80, "Main Stage"),
      placed("ft1", "food_truck", 120, 460, 100, 60, "Tacos"),
      placed("ft2", "food_truck", 260, 460, 100, 60, "BBQ"),
      placed("park", "parking", 800, 400, 260, 140, "Parking"),
    ],
    layers: DEFAULT_LAYERS,
    readOnly: true,
  },
  "christmas-market": {
    title: "Christmas Market",
    blurb: "Cozy holiday market with pavilions and heated tents.",
    venueName: "Town Square",
    eventName: "Holiday Market",
    workspaceMode: "example",
    booths: simpleBoothGrid(3, 8, "xm", 250),
    objects: [
      placed("pav1", "pavilion", 60, 40, 180, 120, "Warming Pavilion"),
      placed("tree1", "pine_tree", 900, 60, 80, 90, "Tree"),
      placed("tree2", "pine_tree", 40, 400, 80, 90, "Tree"),
    ],
    layers: DEFAULT_LAYERS,
    readOnly: true,
  },
  "trade-show": {
    title: "Trade Show",
    blurb: "Indoor convention floor with double booths and info kiosks.",
    venueName: "Convention Center Hall B",
    eventName: "Spring Trade Show",
    workspaceMode: "example",
    booths: simpleBoothGrid(5, 10, "ts", 500),
    objects: [
      placed("info", "info_booth", 500, 20, 80, 60, "Info"),
      placed("tick", "ticket_booth", 620, 20, 80, 60, "Registration"),
    ],
    layers: DEFAULT_LAYERS,
    readOnly: true,
  },
  "music-festival": {
    title: "Music Festival",
    blurb: "Two stages, food trucks, sponsor tents.",
    venueName: "Riverside Park",
    eventName: "Summer Music Festival",
    workspaceMode: "example",
    booths: simpleBoothGrid(2, 8, "mf", 400),
    objects: [
      placed("stage-main", "stage", 120, 20, 400, 100, "Main Stage"),
      placed("stage-side", "stage", 600, 20, 260, 80, "Side Stage"),
      placed("ft1", "food_truck", 120, 460, 100, 60, "Tacos"),
      placed("ft2", "food_truck", 260, 460, 100, 60, "Pizza"),
      placed("ft3", "food_truck", 400, 460, 100, 60, "BBQ"),
      placed("tent1", "tent", 800, 400, 180, 120, "Sponsor Tent"),
    ],
    layers: DEFAULT_LAYERS,
    readOnly: true,
  },
};

export type DemoExampleId = keyof typeof DEMO_EXAMPLES;
