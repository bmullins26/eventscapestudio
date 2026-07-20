import type { WorkspaceCtx } from "./App";

const ROWS = ["A", "B", "C", "D", "E", "F"];
const COLS = 12;
const W = 72;
const H = 58;
const GAP_X = 16;
const GAP_Y = 40;
const ORIGIN_X = 120;
const ORIGIN_Y = 120;

const CATEGORIES = ["Food", "Craft", "Retail", "Art", "Wellness", "Sponsor"];
const VENDORS = [
  "Blue Ridge Bakery", "Sunny Farms", "Peak Pottery", "Copper Coffee",
  "Wild Ink Prints", "Trail Tacos", "Riverbend Soap", "Alpine Honey",
  "Cedar & Sage", "Iron Fern Studio", "Golden Hour Jams", "North Star Wax",
];

function statusFor(row: string, col: number): "available" | "reserved" | "paid" | "pending" | "sponsor" | "unavailable" {
  if (row === "A" && col <= 3) return "sponsor";
  const seed = (row.charCodeAt(0) * 31 + col) % 7;
  if (seed === 0) return "paid";
  if (seed === 1) return "reserved";
  if (seed === 2) return "pending";
  if (seed === 6 && col > 10) return "unavailable";
  return "available";
}

function buildBooths() {
  const booths = [];
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
        id: `${row}${c}`,
        row, col: c,
        x, y, w: W, h: H,
        status,
        vendor: status === "available" ? undefined : VENDORS[vIdx],
        category: CATEGORIES[cIdx],
        price: premium ? 350 : corner ? 275 : 200,
        electric: c % 2 === 0,
        water: row === "C" || row === "D",
        corner,
        premium,
        size: "10×10",
      });
    }
  }
  return booths;
}

export const DEMO_WORKSPACE_CTX: WorkspaceCtx = {
  venueName: "Riverside Fairgrounds",
  eventName: "Summer Market 2025",
  booths: buildBooths() as WorkspaceCtx["booths"],
  layers: [
    { id: "l-booths",  name: "Booths",     color: "#1565C0", visible: true, locked: false, kind: "booths" },
    { id: "l-roads",   name: "Roads",      color: "#616161", visible: true, locked: false, kind: "roads" },
    { id: "l-util",    name: "Utilities",  color: "#F59E0B", visible: true, locked: false, kind: "utilities" },
    { id: "l-land",    name: "Landscape",  color: "#2E7D32", visible: true, locked: false, kind: "landscape" },
    { id: "l-spon",    name: "Sponsors",   color: "#6A1B9A", visible: true, locked: false, kind: "sponsors" },
  ],
};
