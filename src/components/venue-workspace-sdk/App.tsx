import { useState, useEffect, createContext, useContext, useMemo, useRef, useCallback } from "react";
import {
  MousePointer2, Hand, Square, Pentagon, Minus, Type, LayoutGrid,
  Route, Fence, Building2, ParkingCircle, Mic2, TreePine, Ruler,
  Wand2, ImagePlus, Undo2, Redo2, Save, Play, Search, Bell,
  ChevronRight, ZoomIn, ZoomOut, Grid3x3, Magnet, Layers3,
  ChevronDown, Package, BookTemplate, FolderOpen, Users, CalendarCheck,
  MessageSquare, Sparkles, Eye, EyeOff, Lock, Unlock,
  MoreHorizontal, Zap, Droplets, Star, X, Plus, PanelLeftClose,
  PanelLeftOpen, PanelRightClose, PanelRightOpen,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  SlidersHorizontal, Activity, Trash2, Copy,
  Footprints, Armchair, Circle as CircleIcon, RectangleHorizontal,
  Map as MapIcon, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { fetchSatelliteImageForWorkspace } from "@/lib/workspace-background.functions";
import { VendorPickerDialog } from "./VendorPickerDialog";


// ─── Data context ────────────────────────────────────────────────────────────
type LayerRow = { id: string; name: string; color: string | null; visible: boolean; locked: boolean; kind: string };
type WorkspaceMode = "blank" | "example";
export type WorkspaceSaveState = {
  booths: Booth[];
  objects: PlacedObj[];
  background: { url: string; x: number; y: number; w: number; h: number; opacity: number; locked: boolean; label: string; rotation?: number } | null;
  canvas?: { w: number; h: number };
};
export type WorkspaceCtx = {
  venueName: string;
  eventName: string;
  booths: Booth[] | null;
  layers: LayerRow[] | null;
  /** Placed non-booth objects loaded from persistence. Optional; empty by default. */
  objects?: PlacedObj[] | null;
  /** Initial background layer. */
  initialBackground?: WorkspaceSaveState["background"];
  /** Initial world canvas dimensions (world units). Optional; defaults to 1110×560. */
  initialCanvas?: { w: number; h: number };
  /** Blank is production default; examples must opt in explicitly. */
  workspaceMode?: WorkspaceMode;
  /** Read-only demo mode — disables save/publish. */
  readOnly?: boolean;
  /** Save handler. When provided, receives full workspace snapshot. */
  onSave?: (state: WorkspaceSaveState) => Promise<void> | void;
  onPatchBooth?: (id: string, patch: Partial<Booth> & { staff_notes?: string; vendor_notes?: string }) => void;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  onOpenVendor?: (vendorProfileId: string) => void;
  onLayerToggle?: (id: string, patch: { visible?: boolean; locked?: boolean }) => void;
  /** Organization id — required to enable vendor picker. */
  organizationId?: string;
  /** Assign or clear a vendor for a booth. Pass null to clear. */
  onAssignVendor?: (
    boothSdkId: string,
    args: { vendor_profile_id: string | null; vendor_name: string | null; category?: string | null },
  ) => void;
};
const WorkspaceDataContext = createContext<WorkspaceCtx | null>(null);
export function WorkspaceDataProvider({ value, children }: { value: WorkspaceCtx; children: React.ReactNode }) {
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}
function useWorkspaceCtx(): WorkspaceCtx | null {
  return useContext(WorkspaceDataContext);
}

// ─── Breakpoint ──────────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1100, isDesktop: w >= 1100 };
}

// ─── Types ───────────────────────────────────────────────────────────────────
type BoothStatus = "available" | "reserved" | "paid" | "pending" | "sponsor" | "unavailable";
type Mode = "design" | "reservations" | "operations";
type RentalVariant =
  | "standard_booth"
  | "table_6ft"
  | "table_8ft"
  | "round_table"
  | "food_truck_space";
type Tool =
  | "select" | "pan" | "rect" | "polygon" | "line" | "text"
  | "booth"  | "road" | "walkway" | "fence"  | "building" | "parking"
  | "stage"  | "tree" | "measure" | "ai"    | "image"
  | "table6" | "table8" | "tableRound" | "chair"
  // Extended library kinds
  | "pavilion" | "tent" | "ticket_booth" | "info_booth" | "food_truck"
  | "restroom" | "atm" | "trash" | "bench" | "picnic_table"
  | "electrical" | "generator" | "water_hookup" | "sewer"
  | "oak_tree" | "pine_tree" | "shrub" | "flower_bed"
  | "cocktail_table" | "service_road" | "emergency_lane"
  // Rental Options (all create a Rentable Space / Booth object)
  | "rental_standard" | "rental_table6" | "rental_table8"
  | "rental_round" | "rental_foodtruck"
  // Furniture (non-rentable venue furniture)
  | "furn_table4" | "furn_table6" | "furn_table8" | "furn_tableRound"
  | "furn_cocktail" | "furn_banquet"
  | "furn_folding_chair" | "furn_banquet_chair" | "furn_ceremony_chair" | "furn_bar_stool"
  | "furn_display_table" | "furn_display_rack" | "furn_display_shelf" | "furn_podium"
  | "furn_couch" | "furn_bench" | "furn_picnic";
type Sheet = "objects" | "layers" | "inspector" | null;

interface Booth {
  id: string; row: string; col: number;
  x: number;  y: number;  w: number;  h: number;
  status: BoothStatus;
  vendor?: string; category?: string;
  vendor_profile_id?: string | null;
  price: number; electric: boolean; water: boolean;
  corner: boolean; premium: boolean; size: string;
  variant?: RentalVariant;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  notes?: string;
  tags?: string[];
  layer_id?: string;
}


export interface PlacedObj {
  id: string;
  kind: "tree" | "building" | "stage" | "parking" | "fence" | "rect" | "text"
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
  x: number; y: number; w: number; h: number; label?: string;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  notes?: string;
  tags?: string[];
  layer_id?: string;
  /** Furniture flag — drives inspector variant. Rental Options are Booths, not PlacedObj. */
  furniture?: boolean;
}



// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<BoothStatus, { fill: string; stroke: string; label: string }> = {
  available:   { fill: "#E8F5E9", stroke: "#2E7D32", label: "Available" },
  reserved:    { fill: "#E3F0FF", stroke: "#1565C0", label: "Reserved" },
  paid:        { fill: "#E8F5E9", stroke: "#1B5E20", label: "Paid" },
  pending:     { fill: "#FFF8E1", stroke: "#E65100", label: "Pending" },
  sponsor:     { fill: "#F3E8FF", stroke: "#6A1B9A", label: "Sponsor" },
  unavailable: { fill: "#EEEEEE", stroke: "#9E9E9E", label: "Unavailable" },
};

const CANOPY_COLORS: Record<string, { top: string; mid: string }> = {
  "Produce":  { top: "#1B6B1B", mid: "#256325" },
  "Food":     { top: "#B84000", mid: "#C84C10" },
  "Crafts":   { top: "#1040A0", mid: "#1A52B8" },
  "Art":      { top: "#6A1090", mid: "#7A20A0" },
  "Jewelry":  { top: "#8A6000", mid: "#9A7010" },
  "Beauty":   { top: "#A01860", mid: "#B02870" },
  "Textiles": { top: "#0A6868", mid: "#187878" },
  "Plants":   { top: "#1A7830", mid: "#288840" },
  "Home":     { top: "#4A2890", mid: "#5A38A0" },
  "Sponsor":  { top: "#8B0000", mid: "#A01010" },
};
const DEFAULT_CANOPY = { top: "#3A4A5A", mid: "#4A5A6A" };
const DEFAULT_WORLD_W = 1110, DEFAULT_WORLD_H = 560;
const GRID_SIZE = 12;

// ─── Rental Options registry (extensible: add a variant → renderer picks it up) ─
// px scale roughly ~7 px per foot to match the existing 10×10 booth footprint.
const RENTAL_VARIANTS: Record<RentalVariant, {
  label: string; libraryLabel: string; w: number; h: number;
  sizeLabel: string; defaultPrice: number;
}> = {
  standard_booth:   { label:"Standard Booth",   libraryLabel:"Standard Booth",   w: 70,  h: 70, sizeLabel:"10′ × 10′",     defaultPrice: 150 },
  table_6ft:        { label:"6 Foot Table",     libraryLabel:"6 Foot Table",     w: 42,  h: 18, sizeLabel:"6′ × 2.5′",     defaultPrice: 60  },
  table_8ft:        { label:"8 Foot Table",     libraryLabel:"8 Foot Table",     w: 56,  h: 18, sizeLabel:"8′ × 2.5′",     defaultPrice: 80  },
  round_table:      { label:"Round Table",      libraryLabel:"Round Table",      w: 35,  h: 35, sizeLabel:'60" diameter',  defaultPrice: 75  },
  food_truck_space: { label:"Food Truck Space", libraryLabel:"Food Truck Space", w: 210, h: 84, sizeLabel:"30′ × 12′",     defaultPrice: 400 },
};
const RENTAL_TOOL_BY_VARIANT: Record<RentalVariant, Tool> = {
  standard_booth: "rental_standard", table_6ft: "rental_table6", table_8ft: "rental_table8",
  round_table: "rental_round", food_truck_space: "rental_foodtruck",
};
const RENTAL_VARIANT_BY_TOOL: Partial<Record<Tool, RentalVariant>> = {
  rental_standard: "standard_booth", rental_table6: "table_6ft", rental_table8: "table_8ft",
  rental_round: "round_table", rental_foodtruck: "food_truck_space",
};

// ─── Booth factory (used when the user adds new booths on the canvas) ───────
function makeBooth(id: string, row: string, col: number, x: number, y: number, w: number, h: number, status: BoothStatus, opts: Partial<Booth> = {}): Booth {
  const variant = opts.variant ?? "standard_booth";
  const spec = RENTAL_VARIANTS[variant];
  return { id, row, col, x, y, w, h, status, price: spec.defaultPrice, electric: false, water: false, corner: false, premium: false, size: spec.sizeLabel, variant, ...opts };
}



const LEFT_TOOLS: { id: Tool; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id:"select",   icon:MousePointer2, label:"Select",      shortcut:"V" },
  { id:"pan",      icon:Hand,          label:"Pan",         shortcut:"H" },
  { id:"rect",     icon:Square,        label:"Rectangle",   shortcut:"R" },
  { id:"polygon",  icon:Pentagon,      label:"Polygon" },
  { id:"line",     icon:Minus,         label:"Line",        shortcut:"L" },
  { id:"text",     icon:Type,          label:"Text",        shortcut:"T" },
  { id:"booth",    icon:LayoutGrid,    label:"Booth",       shortcut:"B" },
  { id:"road",     icon:Route,         label:"Road" },
  { id:"walkway",  icon:Footprints,    label:"Walkway" },
  { id:"fence",    icon:Fence,         label:"Fence" },
  { id:"building", icon:Building2,     label:"Building" },
  { id:"parking",  icon:ParkingCircle, label:"Parking" },
  { id:"stage",    icon:Mic2,          label:"Stage" },
  { id:"tree",     icon:TreePine,      label:"Tree" },
  { id:"table6",   icon:RectangleHorizontal, label:"6′ Table" },
  { id:"table8",   icon:RectangleHorizontal, label:"8′ Table" },
  { id:"tableRound", icon:CircleIcon,  label:"Round Table" },
  { id:"chair",    icon:Armchair,      label:"Chair" },
  { id:"measure",  icon:Ruler,         label:"Measure",     shortcut:"M" },
  { id:"ai",       icon:Wand2,         label:"AI Import" },
  { id:"image",    icon:ImagePlus,     label:"Image" },
];
const LEFT_TABS = [
  { id:"objects",      icon:Package,       label:"Objects" },
  { id:"layers",       icon:Layers3,       label:"Layers" },
  { id:"assets",       icon:FolderOpen,    label:"Assets" },
  { id:"templates",    icon:BookTemplate,  label:"Templates" },
  { id:"vendors",      icon:Users,         label:"Vendors" },
  { id:"reservations", icon:CalendarCheck, label:"Reservations" },
  { id:"ai",           icon:Sparkles,      label:"AI" },
  { id:"comments",     icon:MessageSquare, label:"Comments" },
];
const OBJ_CATEGORIES = [
  { label:"Rental Options", items:["Standard Booth","6 Foot Rental Table","8 Foot Rental Table","Round Rental Table","Food Truck Space"] },
  { label:"Structures", items:["Building","Stage","Pavilion","Tent","Ticket Booth","Info Booth"] },
  { label:"Roads",      items:["Main Road","Service Road","Walkway","Emergency Lane"] },
  { label:"Furniture",  items:[
      "4 Foot Table","6 Foot Table","8 Foot Table","Round Table","Cocktail Table","Banquet Table",
      "Folding Chair","Banquet Chair","Ceremony Chair","Bar Stool",
      "Display Table","Display Rack","Display Shelf","Podium",
      "Couch","Bench","Picnic Table",
    ] },
  { label:"Utilities",  items:["Electrical Panel","Generator","Water Hookup","Sewer Access"] },
  { label:"Landscape",  items:["Oak Tree","Pine Tree","Shrub","Flower Bed"] },
  { label:"Amenities",  items:["Restroom","ATM","Trash Station"] },
];


// ─── Small deco SVGs ─────────────────────────────────────────────────────────
function TreeSVG({ cx, cy, r = 16 }: { cx:number; cy:number; r?:number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+r*0.3} cy={cy+r*0.4} rx={r*0.85} ry={r*0.55} fill="#000" opacity="0.18"/>
      <circle cx={cx} cy={cy} r={r} fill="#1A5C10"/>
      <circle cx={cx} cy={cy} r={r*0.74} fill="#22750E"/>
      <circle cx={cx-r*0.22} cy={cy-r*0.22} r={r*0.42} fill="#2E9A1A" opacity="0.75"/>
    </g>
  );
}
function ShrubSVG({ cx, cy }: { cx:number; cy:number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+2} cy={cy+3} rx={10} ry={6} fill="#000" opacity="0.14"/>
      <ellipse cx={cx} cy={cy} rx={10} ry={7} fill="#1E6B14"/>
      <ellipse cx={cx-3} cy={cy-2} rx={6} ry={5} fill="#268A1A"/>
      <ellipse cx={cx+4} cy={cy-1} rx={5} ry={4} fill="#2A9620"/>
    </g>
  );
}
function BuildingSVG({ x, y, w, h, label }: { x:number; y:number; w:number; h:number; label:string }) {
  return (
    <g pointerEvents="none">
      <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.2" rx="3"/>
      <rect x={x} y={y} width={w} height={h} fill="#D4CEC8" stroke="#A09A94" strokeWidth="1" rx="3"/>
      <rect x={x+5} y={y+5} width={w-10} height={h-10} fill="#C8C2BC" stroke="#8A8480" strokeWidth="0.8" rx="1"/>
      <text x={x+w/2} y={y+h/2+2} textAnchor="middle" fill="#4A4040" fontSize="7" fontWeight="600" fontFamily="Inter,sans-serif">{label}</text>
    </g>
  );
}
function ParkingLot({ x, y, w, h, label }: { x:number; y:number; w:number; h:number; label:string }) {
  const spaceW = 16;
  const num = Math.floor((w-6)/spaceW);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="#3A3A40" stroke="#4A4A52" strokeWidth="1" rx="2"/>
      {Array.from({length:num+1}).map((_,i)=>(
        <line key={i} x1={x+3+i*spaceW} y1={y+4} x2={x+3+i*spaceW} y2={y+h-4} stroke="#606070" strokeWidth="0.8"/>
      ))}
      <text x={x+w/2} y={y+h/2+3} textAnchor="middle" fill="#7A7A8A" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif" letterSpacing="1">{label}</text>
    </g>
  );
}
function StageSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const backH = Math.round(h*0.25);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={backH} fill="#1A0E2E" stroke="#3B1D72" strokeWidth="1" rx="3"/>
      <rect x={x} y={y+backH} width={w} height={h-backH} fill="#3B2208" stroke="#4A2E10" strokeWidth="1"/>
      <text x={x+w/2} y={y+h*0.6} textAnchor="middle" fill="#92400E" fontSize="10" fontWeight="800" letterSpacing="4" fontFamily="Inter,sans-serif" opacity="0.7">STAGE</text>
    </g>
  );
}

// ─── Roads / Walkways ────────────────────────────────────────────────────────
function RoadSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const horizontal = w >= h;
  const cx = x + w/2, cy = y + h/2;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="#1F1F22" stroke="#0A0A0C" strokeWidth="0.8" rx="1.5"/>
      <rect x={x} y={y} width={w} height={Math.max(1, h*0.15)} fill="#ffffff08"/>
      {horizontal ? (
        <line x1={x+4} y1={cy} x2={x+w-4} y2={cy} stroke="#F5D046" strokeWidth={Math.max(1, h*0.06)} strokeDasharray={`${Math.max(8, w*0.06)} ${Math.max(6, w*0.05)}`} opacity="0.95"/>
      ) : (
        <line x1={cx} y1={y+4} x2={cx} y2={y+h-4} stroke="#F5D046" strokeWidth={Math.max(1, w*0.06)} strokeDasharray={`${Math.max(8, h*0.06)} ${Math.max(6, h*0.05)}`} opacity="0.95"/>
      )}
    </g>
  );
}
function WalkwaySVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const horizontal = w >= h;
  const step = 14;
  const paverId = `paver-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id={paverId} width={step} height={step} patternUnits="userSpaceOnUse">
          <rect width={step} height={step} fill="#C8B98F"/>
          <path d={`M0 0 H${step} M0 ${step} H${step} M0 0 V${step} M${step} 0 V${step}`} stroke="#A99968" strokeWidth="0.6" opacity="0.6"/>
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${paverId})`} stroke="#8A7A55" strokeWidth="0.8" rx="1.5"/>
      {/* subtle center scuff line */}
      {horizontal
        ? <line x1={x+4} y1={y+h/2} x2={x+w-4} y2={y+h/2} stroke="#8A7A55" strokeWidth="0.4" opacity="0.35"/>
        : <line x1={x+w/2} y1={y+4} x2={x+w/2} y2={y+h-4} stroke="#8A7A55" strokeWidth="0.4" opacity="0.35"/>}
    </g>
  );
}

// ─── Tables & Chairs ─────────────────────────────────────────────────────────
function RectTableSVG({ x, y, w, h, label }: { x:number; y:number; w:number; h:number; label?:string }) {
  // Rectangular banquet table with wood top and darker legs
  const legT = Math.max(2, Math.min(w, h) * 0.06);
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.22" rx="2"/>
      <rect x={x} y={y} width={w} height={h} fill="#C69A6B" stroke="#7A4E28" strokeWidth="1" rx="2"/>
      <rect x={x+2} y={y+2} width={w-4} height={h-4} fill="none" stroke="#A87A48" strokeWidth="0.6" rx="1.5" opacity="0.7"/>
      <line x1={x+w*0.5} y1={y+2} x2={x+w*0.5} y2={y+h-2} stroke="#8A5A30" strokeWidth="0.5" opacity="0.5"/>
      {/* legs (corners) */}
      <rect x={x} y={y} width={legT} height={legT} fill="#5A3A1E"/>
      <rect x={x+w-legT} y={y} width={legT} height={legT} fill="#5A3A1E"/>
      <rect x={x} y={y+h-legT} width={legT} height={legT} fill="#5A3A1E"/>
      <rect x={x+w-legT} y={y+h-legT} width={legT} height={legT} fill="#5A3A1E"/>
      {label && <text x={x+w/2} y={y+h/2+2.5} textAnchor="middle" fill="#3B2210" fontSize={Math.min(9, h*0.35)} fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.75">{label}</text>}
    </g>
  );
}
function RoundTableSVG({ x, y, w, h, label }: { x:number; y:number; w:number; h:number; label?:string }) {
  const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2;
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+1.5} cy={cy+2} rx={r} ry={r*0.98} fill="#000" opacity="0.22"/>
      <circle cx={cx} cy={cy} r={r} fill="#C69A6B" stroke="#7A4E28" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={r*0.82} fill="none" stroke="#A87A48" strokeWidth="0.6" opacity="0.7"/>
      <circle cx={cx} cy={cy} r={r*0.14} fill="#5A3A1E" opacity="0.6"/>
      {label && <text x={cx} y={cy+2.5} textAnchor="middle" fill="#3B2210" fontSize={Math.min(9, r*0.55)} fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.75">{label}</text>}
    </g>
  );
}
function ChairSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  // Small chair from above: seat + back bar
  const backH = Math.max(1.5, h*0.22);
  return (
    <g pointerEvents="none">
      <rect x={x+1} y={y+1} width={w} height={h} fill="#000" opacity="0.2" rx="1.5"/>
      <rect x={x} y={y+backH} width={w} height={h-backH} fill="#5A6B7A" stroke="#2E3944" strokeWidth="0.6" rx="1.5"/>
      <rect x={x} y={y} width={w} height={backH} fill="#3E4A56" stroke="#1E2632" strokeWidth="0.5" rx="1"/>
    </g>
  );
}

// ─── Extended library glyphs (all unique) ────────────────────────────────────
function PavilionSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const roofH = Math.max(6, h*0.32);
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.2" rx="3"/>
      <path d={`M${x} ${y+roofH} L${x+w/2} ${y} L${x+w} ${y+roofH} Z`} fill="#8B2A2A" stroke="#5A1717" strokeWidth="1"/>
      <rect x={x} y={y+roofH} width={w} height={h-roofH} fill="#F1E6D3" stroke="#8A7A55" strokeWidth="1"/>
      {[0.2,0.5,0.8].map((f,i)=><rect key={i} x={x+w*f-1.5} y={y+roofH} width="3" height={h-roofH} fill="#7A5A3A"/>)}
      <text x={x+w/2} y={y+roofH+ (h-roofH)/2 +3} textAnchor="middle" fill="#6B4A2A" fontSize="7" fontWeight="700" fontFamily="Inter,sans-serif" letterSpacing="1">PAVILION</text>
    </g>
  );
}
function TentSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const cx = x + w/2;
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+2} cy={y+h+1} rx={w/2} ry="3" fill="#000" opacity="0.2"/>
      <path d={`M${x} ${y+h} L${cx} ${y} L${x+w} ${y+h} Z`} fill="#E7E2D6" stroke="#8A7A55" strokeWidth="1"/>
      <line x1={cx} y1={y} x2={cx} y2={y+h} stroke="#8A7A55" strokeWidth="0.6" opacity="0.6"/>
      <path d={`M${x+w*0.35} ${y+h} L${cx} ${y+h*0.55} L${x+w*0.65} ${y+h}`} fill="#B8AE95" stroke="#8A7A55" strokeWidth="0.6"/>
    </g>
  );
}
function TicketBoothSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.2" rx="2"/>
      <rect x={x} y={y} width={w} height={h} fill="#F3C74B" stroke="#8A6510" strokeWidth="1" rx="2"/>
      <rect x={x} y={y} width={w} height={Math.max(6,h*0.22)} fill="#8A1A1A"/>
      <rect x={x+w*0.15} y={y+h*0.4} width={w*0.7} height={h*0.28} fill="#1F1F22" rx="1"/>
      <text x={x+w/2} y={y+h*0.6} textAnchor="middle" fill="#F3C74B" fontSize={Math.min(8, h*0.28)} fontWeight="800" fontFamily="Inter,sans-serif">TICKETS</text>
      <circle cx={x+w*0.5} cy={y+h*0.82} r={Math.min(3, h*0.09)} fill="#8A1A1A"/>
    </g>
  );
}
function InfoBoothSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.2" rx="2"/>
      <rect x={x} y={y} width={w} height={h} fill="#1E88E5" stroke="#0D47A1" strokeWidth="1" rx="2"/>
      <rect x={x+w*0.1} y={y+h*0.28} width={w*0.8} height={h*0.5} fill="#E3F2FD" rx="1"/>
      <circle cx={x+w/2} cy={y+h*0.44} r={Math.min(3.5, h*0.12)} fill="#1E88E5"/>
      <text x={x+w/2} y={y+h*0.48} textAnchor="middle" fill="#fff" fontSize={Math.min(6, h*0.2)} fontWeight="800">i</text>
      <text x={x+w/2} y={y+h*0.7} textAnchor="middle" fill="#0D47A1" fontSize={Math.min(6, h*0.18)} fontWeight="700" fontFamily="Inter,sans-serif">INFO</text>
    </g>
  );
}
function FoodTruckSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  // Side-view truck: cab + box + awning + wheels
  const cabW = w*0.28;
  const bodyX = x+cabW;
  const bodyW = w-cabW;
  const wheelR = Math.min(h*0.14, w*0.05);
  const bodyH = h*0.68;
  return (
    <g pointerEvents="none">
      <ellipse cx={x+w/2+2} cy={y+h+1} rx={w/2} ry="2" fill="#000" opacity="0.2"/>
      {/* Awning */}
      <path d={`M${bodyX} ${y+h*0.18} L${x+w} ${y+h*0.18} L${x+w-4} ${y+h*0.30} L${bodyX+4} ${y+h*0.30} Z`} fill="#D94A3C" stroke="#7A1F17" strokeWidth="0.6"/>
      {[0.15,0.35,0.55,0.75].map((f,i)=><rect key={i} x={bodyX + bodyW*f} y={y+h*0.18} width={bodyW*0.08} height={h*0.12} fill="#F4C24A"/>)}
      {/* Box body */}
      <rect x={bodyX} y={y+h*0.30} width={bodyW} height={bodyH-h*0.12} fill="#F5F0E6" stroke="#7A6A4A" strokeWidth="1" rx="2"/>
      {/* Service window */}
      <rect x={bodyX+bodyW*0.15} y={y+h*0.38} width={bodyW*0.55} height={h*0.28} fill="#1F1F22" rx="1"/>
      <text x={bodyX+bodyW*0.42} y={y+h*0.56} textAnchor="middle" fill="#F4C24A" fontSize={Math.min(7, h*0.2)} fontWeight="800" fontFamily="Inter,sans-serif">FOOD</text>
      {/* Cab */}
      <path d={`M${x} ${y+h*0.42} L${x+cabW*0.2} ${y+h*0.28} L${bodyX} ${y+h*0.28} L${bodyX} ${y+h*0.88} L${x} ${y+h*0.88} Z`} fill="#C0392B" stroke="#7A1F17" strokeWidth="1"/>
      <path d={`M${x+cabW*0.1} ${y+h*0.34} L${bodyX-2} ${y+h*0.34} L${bodyX-2} ${y+h*0.52} L${x+cabW*0.05} ${y+h*0.52} Z`} fill="#BEE1F5" stroke="#7A1F17" strokeWidth="0.6"/>
      {/* Wheels */}
      <circle cx={x+cabW*0.5} cy={y+h*0.9} r={wheelR} fill="#111"/>
      <circle cx={x+cabW*0.5} cy={y+h*0.9} r={wheelR*0.4} fill="#555"/>
      <circle cx={x+w*0.8} cy={y+h*0.9} r={wheelR} fill="#111"/>
      <circle cx={x+w*0.8} cy={y+h*0.9} r={wheelR*0.4} fill="#555"/>
    </g>
  );
}
function RestroomSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const half = w/2;
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.22" rx="2"/>
      <rect x={x} y={y} width={half} height={h} fill="#1E88E5" stroke="#0D47A1" strokeWidth="1" rx="2"/>
      <rect x={x+half} y={y} width={half} height={h} fill="#E91E63" stroke="#880E4F" strokeWidth="1" rx="2"/>
      <text x={x+half/2} y={y+h*0.62} textAnchor="middle" fill="#fff" fontSize={Math.min(10, h*0.4)} fontWeight="800">♂</text>
      <text x={x+half+half/2} y={y+h*0.62} textAnchor="middle" fill="#fff" fontSize={Math.min(10, h*0.4)} fontWeight="800">♀</text>
    </g>
  );
}
function AtmSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.22" rx="2"/>
      <rect x={x} y={y} width={w} height={h} fill="#37474F" stroke="#1B2A32" strokeWidth="1" rx="2"/>
      <rect x={x+w*0.15} y={y+h*0.15} width={w*0.7} height={h*0.35} fill="#0F1720" rx="1"/>
      <rect x={x+w*0.2} y={y+h*0.22} width={w*0.6} height={h*0.2} fill="#4FC3F7"/>
      <rect x={x+w*0.18} y={y+h*0.62} width={w*0.28} height={h*0.08} fill="#90A4AE"/>
      <rect x={x+w*0.55} y={y+h*0.62} width={w*0.28} height={h*0.08} fill="#90A4AE"/>
      <text x={x+w/2} y={y+h*0.9} textAnchor="middle" fill="#4FC3F7" fontSize={Math.min(7, h*0.22)} fontWeight="800" fontFamily="Inter,sans-serif">ATM</text>
    </g>
  );
}
function TrashSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x+w/2+1} cy={y+h+1} rx={w/2} ry="2" fill="#000" opacity="0.22"/>
      <rect x={x+w*0.1} y={y+h*0.18} width={w*0.8} height={h*0.78} fill="#2E7D32" stroke="#1B4A1D" strokeWidth="1" rx="2"/>
      <rect x={x} y={y+h*0.05} width={w} height={h*0.16} fill="#1B4A1D" rx="2"/>
      <rect x={x+w*0.35} y={y-2} width={w*0.3} height="3" fill="#1B4A1D" rx="1"/>
      {[0.3,0.5,0.7].map((f,i)=><line key={i} x1={x+w*0.2} y1={y+h*f} x2={x+w*0.8} y2={y+h*f} stroke="#1B4A1D" strokeWidth="0.5" opacity="0.5"/>)}
    </g>
  );
}
function BenchSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+1} y={y+1} width={w} height={h} fill="#000" opacity="0.2" rx="1.5"/>
      <rect x={x} y={y+h*0.25} width={w} height={h*0.5} fill="#8B5A2B" stroke="#4A2E10" strokeWidth="0.8" rx="1"/>
      <rect x={x} y={y+h*0.25} width={w} height="1.2" fill="#6A3E1A"/>
      <rect x={x+w*0.05} y={y+h*0.75} width={w*0.06} height={h*0.22} fill="#3A2410"/>
      <rect x={x+w*0.89} y={y+h*0.75} width={w*0.06} height={h*0.22} fill="#3A2410"/>
    </g>
  );
}
function PicnicTableSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const benchH = h*0.18;
  return (
    <g pointerEvents="none">
      <rect x={x+1} y={y+1} width={w} height={h} fill="#000" opacity="0.2" rx="1.5"/>
      <rect x={x} y={y} width={w} height={benchH} fill="#8B5A2B" stroke="#4A2E10" strokeWidth="0.6" rx="1"/>
      <rect x={x} y={y+h-benchH} width={w} height={benchH} fill="#8B5A2B" stroke="#4A2E10" strokeWidth="0.6" rx="1"/>
      <rect x={x} y={y+benchH+2} width={w} height={h-benchH*2-4} fill="#A87A48" stroke="#4A2E10" strokeWidth="0.8" rx="1"/>
      {[0.25,0.5,0.75].map((f,i)=><line key={i} x1={x} y1={y+benchH+2+(h-benchH*2-4)*f} x2={x+w} y2={y+benchH+2+(h-benchH*2-4)*f} stroke="#7A4E28" strokeWidth="0.4"/>)}
    </g>
  );
}
function ElectricalSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+1} y={y+1} width={w} height={h} fill="#000" opacity="0.2" rx="1.5"/>
      <rect x={x} y={y} width={w} height={h} fill="#FDD835" stroke="#8A6510" strokeWidth="1" rx="1.5"/>
      <path d={`M${x+w*0.55} ${y+h*0.15} L${x+w*0.30} ${y+h*0.55} L${x+w*0.5} ${y+h*0.55} L${x+w*0.40} ${y+h*0.9} L${x+w*0.72} ${y+h*0.45} L${x+w*0.52} ${y+h*0.45} Z`} fill="#1F1F22"/>
    </g>
  );
}
function GeneratorSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+2} y={y+2} width={w} height={h} fill="#000" opacity="0.22" rx="2"/>
      <rect x={x} y={y} width={w} height={h} fill="#455A64" stroke="#1B2A32" strokeWidth="1" rx="2"/>
      <rect x={x+w*0.08} y={y+h*0.15} width={w*0.84} height={h*0.4} fill="#263238" rx="1"/>
      {[0.2,0.35,0.5,0.65,0.8].map((f,i)=><line key={i} x1={x+w*f} y1={y+h*0.2} x2={x+w*f} y2={y+h*0.5} stroke="#0F1720" strokeWidth="1"/>)}
      <circle cx={x+w*0.25} cy={y+h*0.75} r={Math.min(3, h*0.1)} fill="#F44336"/>
      <rect x={x+w*0.45} y={y+h*0.7} width={w*0.35} height={h*0.15} fill="#0F1720"/>
      <text x={x+w/2} y={y+h*0.98} textAnchor="middle" fill="#B0BEC5" fontSize={Math.min(5, h*0.15)} fontWeight="700" fontFamily="Inter,sans-serif">GEN</text>
    </g>
  );
}
function WaterHookupSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2;
  return (
    <g pointerEvents="none">
      <circle cx={cx+1} cy={cy+1.5} r={r} fill="#000" opacity="0.22"/>
      <circle cx={cx} cy={cy} r={r} fill="#0288D1" stroke="#01579B" strokeWidth="1"/>
      <path d={`M${cx} ${cy-r*0.55} Q${cx+r*0.55} ${cy} ${cx} ${cy+r*0.5} Q${cx-r*0.55} ${cy} ${cx} ${cy-r*0.55} Z`} fill="#BAE6FD"/>
      <text x={cx} y={cy+r*0.85} textAnchor="middle" fill="#fff" fontSize={Math.min(5, r*0.5)} fontWeight="800" fontFamily="Inter,sans-serif">H₂O</text>
    </g>
  );
}
function SewerSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2;
  return (
    <g pointerEvents="none">
      <circle cx={cx+1} cy={cy+1.5} r={r} fill="#000" opacity="0.22"/>
      <circle cx={cx} cy={cy} r={r} fill="#5D4037" stroke="#2E1A0E" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={r*0.75} fill="none" stroke="#2E1A0E" strokeWidth="0.6"/>
      {Array.from({length:8}).map((_,i)=>{
        const a = (i/8)*Math.PI*2;
        return <line key={i} x1={cx+Math.cos(a)*r*0.35} y1={cy+Math.sin(a)*r*0.35} x2={cx+Math.cos(a)*r*0.7} y2={cy+Math.sin(a)*r*0.7} stroke="#2E1A0E" strokeWidth="0.8"/>;
      })}
      <text x={cx} y={cy+2} textAnchor="middle" fill="#EFE0D4" fontSize={Math.min(4, r*0.4)} fontWeight="800" fontFamily="Inter,sans-serif">SEWER</text>
    </g>
  );
}
function OakTreeSVG({ cx, cy, r }: { cx:number; cy:number; r:number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+r*0.35} cy={cy+r*0.4} rx={r*0.95} ry={r*0.55} fill="#000" opacity="0.2"/>
      <circle cx={cx-r*0.35} cy={cy-r*0.1} r={r*0.7} fill="#2E5D1B"/>
      <circle cx={cx+r*0.35} cy={cy-r*0.15} r={r*0.65} fill="#3A7020"/>
      <circle cx={cx+r*0.05} cy={cy-r*0.45} r={r*0.55} fill="#48892A"/>
      <circle cx={cx-r*0.1} cy={cy+r*0.25} r={r*0.5} fill="#2E5D1B"/>
    </g>
  );
}
function PineTreeSVG({ cx, cy, r }: { cx:number; cy:number; r:number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+r*0.3} cy={cy+r*0.75} rx={r*0.8} ry={r*0.22} fill="#000" opacity="0.2"/>
      <polygon points={`${cx},${cy-r} ${cx-r*0.85},${cy+r*0.1} ${cx+r*0.85},${cy+r*0.1}`} fill="#1E4A14"/>
      <polygon points={`${cx},${cy-r*0.55} ${cx-r*0.7},${cy+r*0.45} ${cx+r*0.7},${cy+r*0.45}`} fill="#276218"/>
      <polygon points={`${cx},${cy-r*0.1} ${cx-r*0.55},${cy+r*0.75} ${cx+r*0.55},${cy+r*0.75}`} fill="#307A1E"/>
      <rect x={cx-r*0.12} y={cy+r*0.7} width={r*0.24} height={r*0.28} fill="#5A3A1E"/>
    </g>
  );
}
function FlowerBedSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  return (
    <g pointerEvents="none">
      <rect x={x+1} y={y+1} width={w} height={h} fill="#000" opacity="0.2" rx={Math.min(w,h)*0.3}/>
      <rect x={x} y={y} width={w} height={h} fill="#6B3A1A" stroke="#3E2010" strokeWidth="0.8" rx={Math.min(w,h)*0.3}/>
      {Array.from({length: Math.max(3, Math.floor(w*h/300))}).map((_,i)=>{
        const fx = x + 4 + (i * 11) % Math.max(1, w-8);
        const fy = y + 4 + Math.floor((i*11)/Math.max(1, w-8))*10 % Math.max(1, h-8);
        const col = ["#E91E63","#F4C24A","#FFF","#8E24AA","#F06292"][i%5];
        return <g key={i}>
          <circle cx={fx} cy={fy} r="2.2" fill={col}/>
          <circle cx={fx} cy={fy} r="0.9" fill="#F4C24A"/>
        </g>;
      })}
    </g>
  );
}
function CocktailTableSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2;
  return (
    <g pointerEvents="none">
      <ellipse cx={cx+1.5} cy={cy+2} rx={r} ry={r*0.9} fill="#000" opacity="0.22"/>
      <circle cx={cx} cy={cy} r={r} fill="#1F1F22" stroke="#0A0A0C" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={r*0.55} fill="#F5F1E6" stroke="#A89A70" strokeWidth="0.6"/>
      <circle cx={cx} cy={cy} r={r*0.12} fill="#1F1F22"/>
      <text x={cx} y={cy+r*0.85} textAnchor="middle" fill="#F5F1E6" fontSize={Math.min(4.5, r*0.4)} fontWeight="700" fontFamily="Inter,sans-serif">HI-TOP</text>
    </g>
  );
}



// ─── Rentable Space SVG (interactive) ───────────────────────────────────────
// Every rental variant renders through this component so status color, selection,
// utilities, price, and vendor labels stay consistent across booth/table/food-truck.
function BoothShape({
  booth, isSel, isPrimary, onPointerDownBody, onPointerDownHandle,
}: {
  booth: Booth; isSel: boolean; isPrimary: boolean;
  onPointerDownBody: (e: React.PointerEvent, id: string) => void;
  onPointerDownHandle: (e: React.PointerEvent, id: string, handle: string) => void;
}) {
  const { x, y, w, h, id, vendor, category, status, electric, water, premium } = booth;
  const variant: RentalVariant = booth.variant ?? "standard_booth";
  const sc = STATUS_COLORS[status];
  const cp = CANOPY_COLORS[category ?? ""] ?? DEFAULT_CANOPY;
  const cx = x + w/2, cy = y + h/2;
  const round = variant === "round_table";
  const strokeColor = isSel ? "#3B82F6" : sc.stroke;
  const strokeW = isSel ? 2.5 : 1.4;
  const idLabel = vendor && vendor.length ? (vendor.length>16?vendor.slice(0,15)+"…":vendor) : id;

  // Shared status-colored reservable frame — communicates "rentable" for every variant.
  const frame = round ? (
    <ellipse cx={cx} cy={cy} rx={w/2} ry={h/2}
      fill={status==="unavailable"?"#D0CCC8":sc.fill}
      stroke={strokeColor} strokeWidth={strokeW}
      strokeDasharray={status==="available" ? "4 3" : undefined}
      onPointerDown={(e)=>onPointerDownBody(e, id)}/>
  ) : (
    <rect x={x} y={y} width={w} height={h} rx="3"
      fill={status==="unavailable"?"#D0CCC8":sc.fill}
      stroke={strokeColor} strokeWidth={strokeW}
      strokeDasharray={status==="available" ? "4 3" : undefined}
      onPointerDown={(e)=>onPointerDownBody(e, id)}/>
  );

  // Variant-specific inner glyph (visual difference only — behavior is identical).
  let glyph: React.ReactNode = null;
  if (variant === "standard_booth") {
    const cH = Math.max(10, Math.round(h * 0.33));
    glyph = (
      <g pointerEvents="none">
        <defs>
          <linearGradient id={`c-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cp.top}/>
            <stop offset="100%" stopColor={cp.mid}/>
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={w} height={cH} fill={`url(#c-${id})`} rx="3"/>
        <text x={cx} y={y+cH*0.72} textAnchor="middle" fill="white"
          fontSize={Math.min(10, cH*0.7)} fontWeight="700" fontFamily="Inter,sans-serif"
          style={{filter:"drop-shadow(0 1px 1px rgba(0,0,0,0.6))"}}>{id}</text>
      </g>
    );
  } else if (variant === "table_6ft" || variant === "table_8ft") {
    const label = variant === "table_6ft" ? "6′" : "8′";
    glyph = (
      <g pointerEvents="none">
        <rect x={x+3} y={y+3} width={w-6} height={h-6} rx="2"
          fill="#C69A6B" stroke="#7A4E28" strokeWidth="0.8" opacity="0.95"/>
        <line x1={x+w*0.5} y1={y+4} x2={x+w*0.5} y2={y+h-4} stroke="#8A5A30" strokeWidth="0.5" opacity="0.5"/>
        <text x={cx} y={cy+2.5} textAnchor="middle" fill="#3B2210"
          fontSize={Math.min(9, h*0.45)} fontWeight="700" fontFamily="Inter,sans-serif">{label}</text>
      </g>
    );
  } else if (variant === "round_table") {
    const r = Math.min(w,h)/2;
    glyph = (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={r*0.78} fill="#C69A6B" stroke="#7A4E28" strokeWidth="0.8"/>
        <circle cx={cx} cy={cy} r={r*0.14} fill="#5A3A1E" opacity="0.6"/>
        <text x={cx} y={cy+2.5} textAnchor="middle" fill="#3B2210"
          fontSize={Math.min(8, r*0.5)} fontWeight="700" fontFamily="Inter,sans-serif">60″</text>
      </g>
    );
  } else if (variant === "food_truck_space") {
    // Parking-style striped stall for a food truck.
    const stripes = 6;
    glyph = (
      <g pointerEvents="none">
        {Array.from({length: stripes}).map((_,i)=>(
          <line key={i}
            x1={x + (w * (i+1))/(stripes+1)} y1={y+4}
            x2={x + (w * (i+1))/(stripes+1)} y2={y+h-4}
            stroke={sc.stroke} strokeWidth="0.6" opacity="0.35"/>
        ))}
        <rect x={x+w*0.18} y={y+h*0.28} width={w*0.64} height={h*0.44} rx="2"
          fill="#F5F1E6" stroke="#8A6510" strokeWidth="1"/>
        <rect x={x+w*0.18} y={y+h*0.28} width={w*0.16} height={h*0.44} fill="#8A1A1A" rx="2"/>
        <circle cx={x+w*0.30} cy={y+h*0.75} r={Math.min(4, h*0.09)} fill="#1F1F22"/>
        <circle cx={x+w*0.70} cy={y+h*0.75} r={Math.min(4, h*0.09)} fill="#1F1F22"/>
        <text x={cx} y={cy+2.5} textAnchor="middle" fill="#3B2210"
          fontSize={Math.min(10, h*0.22)} fontWeight="800" fontFamily="Inter,sans-serif" letterSpacing="1">FOOD TRUCK</text>
      </g>
    );
  }

  // Label + footer bar (id/vendor + price) — placed just outside the frame so it never occludes tiny variants.
  const footerY = y + h + 8;
  const rot = booth.rotation ?? 0;
  return (
    <g
      style={{cursor: isSel ? "move" : "pointer"}}
      transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
    >
      {!round && <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.18" rx="3" pointerEvents="none"/>}
      {frame}
      {glyph}
      {premium && !round && <polygon points={`${x+w-14},${y} ${x+w},${y} ${x+w},${y+14}`} fill="#F59E0B" opacity="0.9" pointerEvents="none"/>}
      {status!=="available" && !round && <rect x={x} y={y} width={4} height={h} fill={sc.stroke} rx="2" opacity="0.85" pointerEvents="none"/>}
      <text x={x} y={footerY} fill={sc.stroke} fontSize={Math.max(6.5, Math.min(9, w*0.12))} fontFamily="Inter,sans-serif" fontWeight="700" pointerEvents="none">
        {idLabel}
      </text>
      <text x={x+w} y={footerY} textAnchor="end" fill={sc.stroke} fontSize={Math.max(6.5, Math.min(9, w*0.12))} fontFamily="Inter,sans-serif" fontWeight="700" pointerEvents="none">
        ${booth.price}
      </text>
      {electric && <g transform={`translate(${x+6},${y+h-10})`} pointerEvents="none"><circle r="4.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8"/><text textAnchor="middle" y="1.8" fill="#92400E" fontSize="5.5" fontWeight="700">⚡</text></g>}
      {water && <g transform={`translate(${x+(electric?17:6)},${y+h-10})`} pointerEvents="none"><circle r="4.5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="0.8"/><text textAnchor="middle" y="1.8" fill="#0369A1" fontSize="5.5">💧</text></g>}
      {isSel && isPrimary && ([
        ["nw",0,0],["n",0.5,0],["ne",1,0],["e",1,0.5],["se",1,1],["s",0.5,1],["sw",0,1],["w",0,0.5],
      ] as const).map(([hName,ox,oy])=>(
        <rect key={hName}
          x={x+ox*w-4} y={y+oy*h-4} width={8} height={8}
          fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1.5}
          style={{cursor: hName==="n"||hName==="s"?"ns-resize":hName==="e"||hName==="w"?"ew-resize":(hName==="ne"||hName==="sw")?"nesw-resize":"nwse-resize"}}
          onPointerDown={(e)=>onPointerDownHandle(e, id, hName)}
        />
      ))}
      {isSel && isPrimary && (
        <g pointerEvents="all">
          <line x1={cx} y1={y} x2={cx} y2={y-14} stroke="#3B82F6" strokeWidth={1} />
          <circle cx={cx} cy={y-18} r={5} fill="white" stroke="#3B82F6" strokeWidth={1.5}
            style={{cursor:"grab"}}
            onPointerDown={(e)=>onPointerDownHandle(e, id, "rotate")}/>
        </g>
      )}
    </g>
  );

}

// ─── Blank canvas chrome (non-interactive, never creates venue objects) ──────
function CanvasChrome({ showGrid, worldW, worldH }: { showGrid: boolean; worldW: number; worldH: number }) {
  const W = worldW, H = worldH;
  const rulerSize = 24;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="workspace-grid-minor" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="var(--color-foreground)" strokeWidth="0.35" opacity="0.12"/>
        </pattern>
        <pattern id="workspace-grid-major" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="var(--color-foreground)" strokeWidth="0.7" opacity="0.18"/>
        </pattern>
      </defs>
      <rect width={W} height={H} fill="var(--color-background)"/>
      {showGrid && (
        <>
          <rect width={W} height={H} fill="url(#workspace-grid-minor)"/>
          <rect width={W} height={H} fill="url(#workspace-grid-major)"/>
        </>
      )}
      <rect width={W} height={rulerSize} fill="var(--color-card)" opacity="0.86"/>
      <rect width={rulerSize} height={H} fill="var(--color-card)" opacity="0.86"/>
      {Array.from({ length: Math.floor(W / GRID_SIZE) + 1 }).map((_, i) => {
        const x = i * GRID_SIZE;
        const major = i % 5 === 0;
        return <line key={`rt-${i}`} x1={x} y1={rulerSize} x2={x} y2={major ? 7 : 14} stroke="var(--color-foreground)" strokeWidth={major ? 0.8 : 0.45} opacity={major ? 0.42 : 0.24}/>;
      })}
      {Array.from({ length: Math.floor(H / GRID_SIZE) + 1 }).map((_, i) => {
        const y = i * GRID_SIZE;
        const major = i % 5 === 0;
        return <line key={`rl-${i}`} x1={rulerSize} y1={y} x2={major ? 7 : 14} y2={y} stroke="var(--color-foreground)" strokeWidth={major ? 0.8 : 0.45} opacity={major ? 0.42 : 0.24}/>;
      })}
    </g>
  );
}

function PlacedObjSVG({ o, isSel, onPointerDownBody, onPointerDownHandle }: {
  o: PlacedObj; isSel: boolean;
  onPointerDownBody: (e: React.PointerEvent, id: string) => void;
  onPointerDownHandle: (e: React.PointerEvent, id: string, h: string) => void;
}) {
  const stroke = isSel ? "#3B82F6" : "#8A8A8A";
  const sw = isSel ? 2 : 1;
  const cx = o.x + o.w/2, cy = o.y + o.h/2;
  const rot = o.rotation ?? 0;
  return (
    <g style={{cursor: isSel?"move":"pointer"}} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
      {/* Invisible hit surface — inner glyphs use pointerEvents="none" for perf */}
      <rect
        x={o.x} y={o.y} width={Math.max(o.w, 1)} height={Math.max(o.h, 1)}
        fill="transparent"
        onPointerDown={(e)=>onPointerDownBody(e, o.id)}
      />

      {o.kind === "tree" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <TreeSVG cx={o.x+o.w/2} cy={o.y+o.h/2} r={Math.min(o.w,o.h)/2}/>
        </g>
      )}
      {o.kind === "building" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <BuildingSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "BUILDING"}/>
        </g>
      )}
      {o.kind === "stage" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <StageSVG x={o.x} y={o.y} w={o.w} h={o.h}/>
        </g>
      )}
      {o.kind === "parking" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <ParkingLot x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "PARKING"}/>
        </g>
      )}
      {o.kind === "fence" && (
        <line x1={o.x} y1={o.y+o.h/2} x2={o.x+o.w} y2={o.y+o.h/2}
          stroke="#78716C" strokeWidth={3} strokeDasharray="4 3"
          onPointerDown={(e)=>onPointerDownBody(e, o.id)}/>
      )}
      {o.kind === "rect" && (
        <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#ffffff10" stroke={stroke} strokeWidth={sw} rx={3}
          onPointerDown={(e)=>onPointerDownBody(e, o.id)}/>
      )}
      {o.kind === "text" && (
        <text x={o.x} y={o.y+o.h*0.7} fill="#fff" fontSize={Math.max(10, o.h*0.6)} fontFamily="Inter,sans-serif"
          onPointerDown={(e)=>onPointerDownBody(e, o.id)}>{o.label ?? "Text"}</text>
      )}
      {o.kind === "road" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <RoadSVG x={o.x} y={o.y} w={o.w} h={o.h}/>
        </g>
      )}
      {o.kind === "walkway" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <WalkwaySVG x={o.x} y={o.y} w={o.w} h={o.h}/>
        </g>
      )}
      {o.kind === "table6" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <RectTableSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "6′"}/>
        </g>
      )}
      {o.kind === "table8" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <RectTableSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "8′"}/>
        </g>
      )}
      {o.kind === "tableRound" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <RoundTableSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "60″"}/>
        </g>
      )}
      {o.kind === "chair" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <ChairSVG x={o.x} y={o.y} w={o.w} h={o.h}/>
        </g>
      )}
      {o.kind === "pavilion" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><PavilionSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "tent" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><TentSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "ticket_booth" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><TicketBoothSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "info_booth" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><InfoBoothSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "food_truck" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><FoodTruckSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "restroom" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><RestroomSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "atm" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><AtmSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "trash" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><TrashSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "bench" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><BenchSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "picnic_table" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><PicnicTableSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "electrical" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><ElectricalSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "generator" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><GeneratorSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "water_hookup" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><WaterHookupSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "sewer" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><SewerSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "oak_tree" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><OakTreeSVG cx={o.x+o.w/2} cy={o.y+o.h/2} r={Math.min(o.w,o.h)/2}/></g>)}
      {o.kind === "pine_tree" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><PineTreeSVG cx={o.x+o.w/2} cy={o.y+o.h/2} r={Math.min(o.w,o.h)/2}/></g>)}
      {o.kind === "shrub" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><ShrubSVG cx={o.x+o.w/2} cy={o.y+o.h/2}/></g>)}
      {o.kind === "flower_bed" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><FlowerBedSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "cocktail_table" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><CocktailTableSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "service_road" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><RoadSVG x={o.x} y={o.y} w={o.w} h={o.h}/></g>)}
      {o.kind === "emergency_lane" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#8B1A1A" stroke="#4A0E0E" strokeWidth="1" rx="1.5"/>
          <text x={o.x+o.w/2} y={o.y+o.h*0.62} textAnchor="middle" fill="#FDD835" fontSize={Math.min(8, o.h*0.5)} fontWeight="800" letterSpacing="2" fontFamily="Inter,sans-serif">EMERGENCY</text>
        </g>
      )}

      {/* Furniture (non-rentable) — reuse existing SVGs; add lightweight variants for the rest */}
      {o.kind === "furn_table4" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><RectTableSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "4′"}/></g>)}
      {o.kind === "furn_banquet" && (<g onPointerDown={(e)=>onPointerDownBody(e, o.id)}><RectTableSVG x={o.x} y={o.y} w={o.w} h={o.h} label={o.label ?? "Banquet"}/></g>)}
      {(o.kind === "furn_folding_chair" || o.kind === "furn_banquet_chair" || o.kind === "furn_ceremony_chair" || o.kind === "furn_bar_stool") && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <ChairSVG x={o.x} y={o.y} w={o.w} h={o.h}/>
        </g>
      )}
      {(o.kind === "furn_display_table" || o.kind === "furn_display_rack" || o.kind === "furn_display_shelf") && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx="1.5" fill="#E7E2D6" stroke="#7A4E28" strokeWidth="0.8"/>
          <text x={o.x+o.w/2} y={o.y+o.h*0.65} textAnchor="middle" fill="#3B2210" fontSize={Math.min(8, o.h*0.55)} fontWeight="700" fontFamily="Inter,sans-serif">{o.label ?? "Display"}</text>
        </g>
      )}
      {o.kind === "furn_podium" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <rect x={o.x+o.w*0.15} y={o.y} width={o.w*0.7} height={o.h} rx="1.5" fill="#4B5563" stroke="#1F2937" strokeWidth="0.8"/>
          <rect x={o.x} y={o.y+o.h*0.75} width={o.w} height={o.h*0.25} rx="1" fill="#374151"/>
        </g>
      )}
      {o.kind === "furn_couch" && (
        <g onPointerDown={(e)=>onPointerDownBody(e, o.id)}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx="4" fill="#8B7355" stroke="#4A3A28" strokeWidth="0.8"/>
          <rect x={o.x+3} y={o.y+3} width={o.w-6} height={o.h*0.45} rx="3" fill="#A88E6F"/>
          <rect x={o.x+3} y={o.y+o.h*0.55} width={(o.w-8)/2} height={o.h*0.4} rx="2" fill="#B89A7B"/>
          <rect x={o.x+o.w/2+1} y={o.y+o.h*0.55} width={(o.w-8)/2} height={o.h*0.4} rx="2" fill="#B89A7B"/>
        </g>
      )}


      {isSel && (
        <>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="#3B82F6" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none"/>
          {(["nw","ne","se","sw"] as const).map((hn)=>{
            const map = { nw:[0,0], ne:[1,0], se:[1,1], sw:[0,1] } as const;
            const [ox,oy] = map[hn];
            return <rect key={hn} x={o.x+ox*o.w-4} y={o.y+oy*o.h-4} width={8} height={8}
              fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1.5}
              style={{cursor: (hn==="ne"||hn==="sw")?"nesw-resize":"nwse-resize"}}
              onPointerDown={(e)=>onPointerDownHandle(e, o.id, hn)}/>;
          })}
          <line x1={o.x+o.w/2} y1={o.y} x2={o.x+o.w/2} y2={o.y-14} stroke="#3B82F6" strokeWidth={1} pointerEvents="none"/>
          <circle cx={o.x+o.w/2} cy={o.y-18} r={5} fill="white" stroke="#3B82F6" strokeWidth={1.5}
            style={{cursor:"grab"}}
            onPointerDown={(e)=>onPointerDownHandle(e, o.id, "rotate")}/>
        </>
      )}
    </g>
  );
}

// ─── UI Fragments ────────────────────────────────────────────────────────────
function Section({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2" style={{fontFamily:"JetBrains Mono,monospace"}}>{label}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
function Row({ label, value, colored }: { label:string; value:string; colored?:string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium" style={{color:colored||"var(--foreground)"}}>{value}</span>
    </div>
  );
}
function Toggle({ label, icon:Icon, active, onClick }: { label:string; icon:React.ElementType; active:boolean; onClick?: ()=>void }) {
  return (
    <button className="flex items-center justify-between w-full" onClick={onClick} type="button">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={active?"text-primary":"text-muted-foreground"}/>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className={`w-6 h-3.5 rounded-full transition-colors ${active?"bg-primary":"bg-muted"}`}>
        <div className={`w-2.5 h-2.5 mt-0.5 rounded-full bg-white transition-transform ${active?"translate-x-3":"translate-x-0.5"}`}/>
      </div>
    </button>
  );
}

// ─── Vendor section (inside Inspector) ──────────────────────────────────────
function VendorInspectorSection({
  booth,
  onPatch,
}: {
  booth: Booth;
  onPatch?: (patch: Partial<Booth>) => void;
}) {
  const ctx = useWorkspaceCtx();
  const [open, setOpen] = useState(false);
  // Vendor picker is available whenever we know the organization.
  // In Event Mode the parent wires onAssignVendor to persist an event
  // reservation; in Venue Mode we simply record a Venue Assignment on the
  // booth (persisted through the workspace save/onPatch pipeline).
  const canPick = !!ctx?.organizationId;
  const clearAssignment = () => {
    ctx?.onAssignVendor?.(booth.id, { vendor_profile_id: null, vendor_name: null });
    onPatch?.({ vendor: undefined, vendor_profile_id: null, status: "available" });
    toast.success("Vendor removed");
  };

  return (
    <>
      <Section label="Vendor">
        {booth.vendor ? (
          <>
            <Row label="Business" value={booth.vendor} />
            <Row label="Category" value={booth.category || "—"} />
            {canPick && (
              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={() => setOpen(true)}
                  className="flex-1 text-[11px] py-1.5 rounded border border-border text-foreground bg-secondary hover:bg-muted"
                >
                  Change
                </button>
                <button
                  onClick={clearAssignment}
                  className="flex-1 text-[11px] py-1.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            className="w-full text-xs text-primary border border-dashed border-primary/30 rounded py-2 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canPick}
            onClick={() => {
              if (!canPick) return;
              setOpen(true);
            }}
          >
            + Assign Vendor
          </button>
        )}
      </Section>
      {canPick && (
        <VendorPickerDialog
          open={open}
          onOpenChange={setOpen}
          organizationId={ctx!.organizationId!}
          currentVendorName={booth.vendor ?? null}
          onSelect={(v) => {
            const category = v.categories[0] ?? booth.category ?? null;
            ctx?.onAssignVendor?.(booth.id, {
              vendor_profile_id: v.vendor_profile_id,
              vendor_name: v.business_name,
              category,
            });
            onPatch?.({
              vendor: v.business_name,
              vendor_profile_id: v.vendor_profile_id,
              category: category ?? undefined,
              status: "reserved",
            });
            toast.success(`Assigned ${v.business_name}`);
          }}
        />
      )}
    </>
  );
}


// ─── Inspector ───────────────────────────────────────────────────────────────
function InspectorContent({
  booth, count, onPatch, onDelete, onDuplicate,
}: {
  booth: Booth|null; count: number;
  onPatch?: (patch: Partial<Booth>)=>void;
  onDelete?: ()=>void;
  onDuplicate?: ()=>void;
}) {
  if (!booth) return (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-8 h-full">
      <SlidersHorizontal size={28} strokeWidth={1.5}/>
      <p className="text-xs text-center">Select an object on the map to inspect</p>
    </div>
  );
  const c = STATUS_COLORS[booth.status];
  return (
    <div className="overflow-y-auto" style={{scrollbarWidth:"none"}}>
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">{(booth.variant && RENTAL_VARIANTS[booth.variant]?.label) || "Rentable Space"} · {booth.id}{count>1 && ` +${count-1}`}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{background:c.fill, color:c.stroke, borderColor:c.stroke+"60"}}>{c.label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{(booth.variant && RENTAL_VARIANTS[booth.variant]?.sizeLabel) || `${booth.w}′×${booth.h}′`} · {booth.category||"Unassigned"}</p>

      </div>
      <Section label="Status">
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(STATUS_COLORS) as BoothStatus[]).map((s)=>(
            <button key={s} onClick={()=>onPatch?.({status:s})}
              className={`text-[10px] px-1.5 py-1 rounded border ${booth.status===s?"border-primary text-foreground bg-primary/10":"border-border text-muted-foreground hover:bg-secondary"}`}>
              {STATUS_COLORS[s].label}
            </button>
          ))}
        </div>
      </Section>
      <VendorInspectorSection booth={booth} onPatch={onPatch} />

      <Section label="Reservation">
        <Row label="Price" value={`$${booth.price}`}/>
        <input type="number" defaultValue={booth.price} onBlur={(e)=>{
          const v = Number(e.currentTarget.value); if (!isNaN(v)) onPatch?.({price:v});
        }} className="w-full text-[11px] bg-input rounded px-2 py-1 text-foreground border border-border/50"/>
      </Section>
      <Section label="Position">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-[9px] text-muted-foreground mb-0.5">X</p><input defaultValue={booth.x} onBlur={(e)=>onPatch?.({x:Number(e.currentTarget.value)||0})} className="w-full text-[11px] bg-input rounded px-2 py-1 text-foreground border border-border/50"/></div>
          <div><p className="text-[9px] text-muted-foreground mb-0.5">Y</p><input defaultValue={booth.y} onBlur={(e)=>onPatch?.({y:Number(e.currentTarget.value)||0})} className="w-full text-[11px] bg-input rounded px-2 py-1 text-foreground border border-border/50"/></div>
          <div><p className="text-[9px] text-muted-foreground mb-0.5">W</p><input defaultValue={booth.w} onBlur={(e)=>onPatch?.({w:Number(e.currentTarget.value)||1})} className="w-full text-[11px] bg-input rounded px-2 py-1 text-foreground border border-border/50"/></div>
          <div><p className="text-[9px] text-muted-foreground mb-0.5">H</p><input defaultValue={booth.h} onBlur={(e)=>onPatch?.({h:Number(e.currentTarget.value)||1})} className="w-full text-[11px] bg-input rounded px-2 py-1 text-foreground border border-border/50"/></div>
        </div>
      </Section>
      <Section label="Utilities">
        <Toggle label="Electric" icon={Zap} active={booth.electric} onClick={()=>onPatch?.({electric:!booth.electric})}/>
        <Toggle label="Water" icon={Droplets} active={booth.water} onClick={()=>onPatch?.({water:!booth.water})}/>
        <Toggle label="Corner" icon={Square} active={booth.corner} onClick={()=>onPatch?.({corner:!booth.corner})}/>
        <Toggle label="Premium" icon={Star} active={booth.premium} onClick={()=>onPatch?.({premium:!booth.premium})}/>
      </Section>
      <div className="p-3 flex flex-col gap-1.5">
        <button onClick={onDuplicate} className="w-full text-xs py-2 bg-secondary text-secondary-foreground rounded hover:bg-muted flex items-center justify-center gap-1.5"><Copy size={12}/> Duplicate</button>
        <button onClick={onDelete} className="w-full text-xs py-2 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 flex items-center justify-center gap-1.5"><Trash2 size={12}/> Delete</button>
      </div>
    </div>
  );
}

// ─── Object Library ──────────────────────────────────────────────────────────
function ObjectLibrary({ onPick }: { onPick: (item: string) => void }) {
  const [open, setOpen] = useState<string[]>(["Rental Options"]);
  const toggle = (l:string) => setOpen(o=>o.includes(l)?o.filter(x=>x!==l):[...o,l]);
  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{scrollbarWidth:"none"}}>
      <div className="px-3 py-2 sticky top-0 bg-card z-10 border-b border-border">
        <div className="flex items-center gap-2 bg-input rounded px-2 py-1.5">
          <Search size={11} className="text-muted-foreground shrink-0"/>
          <input placeholder="Search objects…" className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"/>
        </div>
      </div>
      {OBJ_CATEGORIES.map((cat)=>(
        <div key={cat.label} className="border-b border-border">
          <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50" onClick={()=>toggle(cat.label)}>
            <span className="text-[11px] font-medium text-foreground">{cat.label}</span>
            <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open.includes(cat.label)?"":"-rotate-90"}`}/>
          </button>
          {open.includes(cat.label) && (
            <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
              {cat.items.map((item)=>(
                <button key={item} onClick={()=>onPick(item)}
                  className="flex flex-col items-center gap-1 p-2 rounded bg-secondary/50 hover:bg-secondary border border-border/40 transition-colors">
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <LayoutGrid size={14} className="text-muted-foreground"/>
                  </div>
                  <span className="text-[9px] text-center text-muted-foreground leading-tight">{item}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Layers Panel ────────────────────────────────────────────────────────────
function LayersPanel() {
  const ctx = useWorkspaceCtx();
  const [local, setLocal] = useState(ctx?.layers ?? []);
  useEffect(()=>{ setLocal(ctx?.layers ?? []); },[ctx?.layers]);
  const toggleVis = (id:string, visible: boolean) => { setLocal(l=>l.map(x=>x.id===id?{...x,visible}:x)); ctx?.onLayerToggle?.(id,{visible}); };
  const toggleLock = (id:string, locked: boolean) => { setLocal(l=>l.map(x=>x.id===id?{...x,locked}:x)); ctx?.onLayerToggle?.(id,{locked}); };
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border">
        <span className="text-[11px] font-medium text-foreground">Layers</span>
      </div>
      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>
        {local.length === 0 && <div className="p-4 text-[11px] text-muted-foreground">No layers</div>}
        {local.map((layer)=>(
          <div key={layer.id} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 group border-b border-border/40">
            <div className="w-2 h-2 rounded-full shrink-0" style={{background: layer.color ?? "#888"}}/>
            <span className={`flex-1 text-[11px] ${layer.visible?"text-foreground":"text-muted-foreground line-through"}`}>{layer.name}</span>
            <button onClick={()=>toggleVis(layer.id, !layer.visible)} className="p-1">
              {layer.visible?<Eye size={12} className="text-muted-foreground"/>:<EyeOff size={12} className="text-muted-foreground"/>}
            </button>
            <button onClick={()=>toggleLock(layer.id, !layer.locked)} className="p-1">
              {layer.locked?<Lock size={12} className="text-muted-foreground"/>:<Unlock size={12} className="text-muted-foreground"/>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ booths }: { booths: Booth[] }) {
  const counts: Record<BoothStatus,number> = { available:0,reserved:0,paid:0,pending:0,sponsor:0,unavailable:0 };
  booths.forEach(b=>counts[b.status]++);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {(Object.entries(STATUS_COLORS) as [BoothStatus, typeof STATUS_COLORS[BoothStatus]][]).map(([st,c])=>(
        <div key={st} className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm border" style={{background:c.fill, borderColor:c.stroke}}/>
          <span className="text-[10px] text-muted-foreground capitalize">{c.label} <span className="text-foreground/60">{counts[st]}</span></span>
        </div>
      ))}
    </div>
  );
}

// ─── Bottom sheet & mobile dock (unchanged look) ─────────────────────────────
function BottomSheet({ open, title, onClose, children }: { open:boolean; title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose}/>}
      <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${open?"translate-y-0":"translate-y-full"}`} style={{maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
        <div className="flex flex-col items-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30"/>
          <div className="flex items-center justify-between w-full px-4 pt-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary"><X size={14} className="text-muted-foreground"/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>{children}</div>
      </div>
    </>
  );
}

function TBtn({ icon:Icon, label, accent, onClick }: { icon:React.ElementType; label:string; accent?:boolean; onClick?: ()=>void }) {
  return (
    <button title={label} onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${accent?"text-primary hover:bg-primary/10":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      <Icon size={14} strokeWidth={1.5}/>
    </button>
  );
}
function SToggle({ label, active, onClick, icon:Icon }: { label:string; active:boolean; onClick:()=>void; icon:React.ElementType }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 text-[10px] transition-colors ${active?"text-primary":"text-muted-foreground hover:text-foreground"}`}>
      <Icon size={11}/>{label}
    </button>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function WorkspaceApp() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const ctx = useWorkspaceCtx();

  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeTab, setActiveTab] = useState("objects");
  const [mode, setMode] = useState<Mode>("design");
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);

  const workspaceMode: WorkspaceMode = ctx?.workspaceMode ?? "blank";

  // Booth state (editable copy of ctx.booths). NEVER fall back to demo data —
  // an empty venue must render an empty canvas. Example data is only used when a
  // caller explicitly passes it via WorkspaceDataProvider in example mode.
  const [booths, setBooths] = useState<Booth[]>(() => ctx?.booths ?? []);
  useEffect(()=>{ setBooths(ctx?.booths ?? []); }, [ctx?.booths]);


  const [placed, setPlaced] = useState<PlacedObj[]>(() => ctx?.objects ?? []);
  useEffect(() => { setPlaced(ctx?.objects ?? []); }, [ctx?.objects]);

  // Background (image upload or satellite map). Rendered behind everything.
  type Background = { url: string; x: number; y: number; w: number; h: number; opacity: number; locked: boolean; label: string; rotation?: number } | null;
  const bgStorageKey = `ws-bg::${ctx?.venueName ?? "default"}::${ctx?.eventName ?? "default"}`;
  const [background, setBackground] = useState<Background>(() => ctx?.initialBackground ?? null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>(() => ctx?.initialCanvas ?? { w: DEFAULT_WORLD_W, h: DEFAULT_WORLD_H });
  useEffect(() => { if (ctx?.initialCanvas) setCanvasSize(ctx.initialCanvas); }, [ctx?.initialCanvas]);
  const WORLD_W = canvasSize.w;
  const WORLD_H = canvasSize.h;
  const bgLoadedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Production blank workspaces are persistence-backed. Do not hydrate any
    // implicit browser fallback that could make a new venue look pre-populated.
    if (ctx?.initialBackground !== undefined) {
      setBackground(ctx?.initialBackground ?? null);
      bgLoadedRef.current = true;
      return;
    }
    if (workspaceMode === "blank") {
      setBackground(null);
      bgLoadedRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(bgStorageKey);
      if (raw) setBackground(JSON.parse(raw));
    } catch { /* ignore */ }
    bgLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgStorageKey, ctx?.initialBackground, workspaceMode]);
  useEffect(() => {
    if (!bgLoadedRef.current || typeof window === "undefined") return;
    if (ctx?.onSave || workspaceMode === "blank") return; // blank/persisted workspaces don't shadow with localStorage
    try {
      if (background) window.localStorage.setItem(bgStorageKey, JSON.stringify(background));
      else window.localStorage.removeItem(bgStorageKey);
    } catch { /* ignore quota */ }
  }, [background, bgStorageKey, ctx?.onSave, workspaceMode]);

  const [bgPanelOpen, setBgPanelOpen] = useState(false);
  const [bgAddress, setBgAddress] = useState("");
  const [bgLoading, setBgLoading] = useState(false);
  const fetchSatFn = useServerFn(fetchSatelliteImageForWorkspace);

  const placeBackground = (url: string, label: string) => {
    const w = Math.round(WORLD_W * 0.75);
    const h = w;
    setBackground({
      url,
      x: (WORLD_W - w) / 2,
      y: (WORLD_H - h) / 2,
      w, h,
      opacity: 0.9,
      locked: false,
      label,
    });
  };
  const onUploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        placeBackground(reader.result, file.name);
        toast.success(`Added ${file.name} as background`);
      }
    };
    reader.readAsDataURL(file);
  };
  const onFetchSatellite = async () => {
    if (!bgAddress.trim()) { toast.error("Enter an address"); return; }
    setBgLoading(true);
    try {
      const res = await fetchSatFn({ data: { address: bgAddress.trim() } });
      placeBackground(res.dataUrl, res.address);
      toast.success(`Loaded satellite for ${res.address}`);
      setBgAddress("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Satellite load failed");
    } finally {
      setBgLoading(false);
    }
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (!background || background.locked) return;
    if (activeTool !== "select") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    gestureRef.current = { kind: "bg-drag", startWorld: clientToWorld(e.clientX, e.clientY), orig: { x: background.x, y: background.y } };
  };
  const onBgHandlePointerDown = (e: React.PointerEvent, handle: string) => {
    if (!background || background.locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (handle === "rotate") {
      const center = { x: background.x + background.w/2, y: background.y + background.h/2 };
      const w = clientToWorld(e.clientX, e.clientY);
      const startAngle = Math.atan2(w.y - center.y, w.x - center.x) * 180/Math.PI;
      gestureRef.current = { kind: "bg-rotate", center, startAngle, origRot: background.rotation ?? 0 };
      return;
    }
    gestureRef.current = { kind: "bg-resize", handle, startWorld: clientToWorld(e.clientX, e.clientY), orig: { x: background.x, y: background.y, w: background.w, h: background.h } };
  };



  // Selection: set of ids (both booths and placed objects share id space; placed ids prefixed "p:")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // ─── Unsaved-changes / session protection ─────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const initialSigRef = useRef<string | null>(null);
  const currentSig = useMemo(
    () => JSON.stringify({ b: booths, p: placed, bg: background, cv: canvasSize }),
    [booths, placed, background, canvasSize],
  );
  useEffect(() => {
    // Hydrate baseline after the first render receives ctx.
    if (initialSigRef.current === null) {
      initialSigRef.current = currentSig;
      return;
    }
    if (currentSig !== initialSigRef.current && saveStatus !== "saving") {
      setSaveStatus("dirty");
    }
  }, [currentSig, saveStatus]);
  // Reset baseline whenever the incoming ctx changes (fresh load).
  useEffect(() => {
    initialSigRef.current = null;
    setSaveStatus("saved");
  }, [ctx?.venueName, ctx?.eventName, ctx?.booths, ctx?.objects]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  // Undo/redo
  type Snapshot = { booths: Booth[]; placed: PlacedObj[] };
  const historyRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const pushHistory = useCallback(() => {
    historyRef.current.push({ booths: booths.map(b=>({...b})), placed: placed.map(p=>({...p})) });
    if (historyRef.current.length > 100) historyRef.current.shift();
    futureRef.current = [];
  }, [booths, placed]);
  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) { toast.message("Nothing to undo"); return; }
    futureRef.current.push({ booths: booths.map(b=>({...b})), placed: placed.map(p=>({...p})) });
    setBooths(prev.booths); setPlaced(prev.placed);
  }, [booths, placed]);
  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) { toast.message("Nothing to redo"); return; }
    historyRef.current.push({ booths: booths.map(b=>({...b})), placed: placed.map(p=>({...p})) });
    setBooths(next.booths); setPlaced(next.placed);
  }, [booths, placed]);

  // Zoom / pan (viewport transform, world coords stay 0..W/H)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const clientToWorld = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x:0, y:0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom };
  }, [pan, zoom]);

  const snap = useCallback((v: number) => snapEnabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : Math.round(v), [snapEnabled]);

  // Gestures
  type Gesture =
    | { kind: "idle" }
    | { kind: "drag"; startWorld: {x:number;y:number}; origMap: Map<string, {x:number;y:number}>; hasMoved: boolean }
    | { kind: "resize"; id: string; handle: string; startWorld: {x:number;y:number}; orig: {x:number;y:number;w:number;h:number} }
    | { kind: "rotate"; id: string; center: {x:number;y:number}; startAngle: number; origRot: number }
    | { kind: "marquee"; start: {x:number;y:number}; end: {x:number;y:number}; add: boolean }
    | { kind: "pan"; startClient: {x:number;y:number}; startPan: {x:number;y:number} }
    | { kind: "bg-drag"; startWorld: {x:number;y:number}; orig: {x:number;y:number} }
    | { kind: "bg-resize"; handle: string; startWorld: {x:number;y:number}; orig: {x:number;y:number;w:number;h:number} }
    | { kind: "bg-rotate"; center: {x:number;y:number}; startAngle: number; origRot: number };
  const gestureRef = useRef<Gesture>({ kind: "idle" });
  const [marquee, setMarquee] = useState<null | {x:number;y:number;w:number;h:number}>(null);

  const getObj = useCallback((id: string) => {
    if (id.startsWith("p:")) { const o = placed.find(p=>p.id===id); return o ? { x:o.x, y:o.y, w:o.w, h:o.h } : null; }
    const b = booths.find(x=>x.id===id); return b ? { x:b.x, y:b.y, w:b.w, h:b.h } : null;
  }, [booths, placed]);
  const setObjPos = (id: string, x: number, y: number) => {
    if (id.startsWith("p:")) setPlaced(ps=>ps.map(p=>p.id===id?{...p,x,y}:p));
    else { setBooths(bs=>bs.map(b=>b.id===id?{...b,x,y}:b)); setDirty(d=>{const n=new Set(d);n.add(id);return n;}); }
  };
  const setObjRect = (id: string, x:number,y:number,w:number,h:number) => {
    if (id.startsWith("p:")) setPlaced(ps=>ps.map(p=>p.id===id?{...p,x,y,w,h}:p));
    else { setBooths(bs=>bs.map(b=>b.id===id?{...b,x,y,w,h}:b)); setDirty(d=>{const n=new Set(d);n.add(id);return n;}); }
  };

  // Booth pointer down (body)
  const onPointerDownBoothBody = (e: React.PointerEvent, id: string) => {
    if (activeTool !== "select") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    let nextSel = selectedIds;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      nextSel = new Set(selectedIds);
      if (nextSel.has(id)) nextSel.delete(id); else nextSel.add(id);
    } else if (!selectedIds.has(id)) {
      nextSel = new Set([id]);
    }
    setSelectedIds(nextSel);
    setPrimaryId(id);
    if (isMobile) setSheet("inspector");
    const startWorld = clientToWorld(e.clientX, e.clientY);
    const origMap = new Map<string, {x:number;y:number}>();
    nextSel.forEach(sid => { const o = getObj(sid); if (o) origMap.set(sid, {x:o.x, y:o.y}); });
    pushHistory();
    gestureRef.current = { kind: "drag", startWorld, origMap, hasMoved: false };
  };
  const onPointerDownHandle = (e: React.PointerEvent, id: string, handle: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const o = getObj(id); if (!o) return;
    pushHistory();
    if (handle === "rotate") {
      const center = { x: o.x + o.w/2, y: o.y + o.h/2 };
      const w = clientToWorld(e.clientX, e.clientY);
      const startAngle = Math.atan2(w.y - center.y, w.x - center.x) * 180/Math.PI;
      const origRot = id.startsWith("p:")
        ? (placed.find(p=>p.id===id)?.rotation ?? 0)
        : (booths.find(b=>b.id===id)?.rotation ?? 0);
      gestureRef.current = { kind: "rotate", id, center, startAngle, origRot };
      return;
    }
    gestureRef.current = { kind: "resize", id, handle, startWorld: clientToWorld(e.clientX, e.clientY), orig: {...o} };
  };

  // SVG background pointer down (marquee or pan or place)
  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const w = clientToWorld(e.clientX, e.clientY);
    if (activeTool === "pan" || e.button === 1 || e.altKey) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      gestureRef.current = { kind: "pan", startClient: { x: e.clientX, y: e.clientY }, startPan: { ...pan } };
      return;
    }
    if (activeTool === "select") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      gestureRef.current = { kind: "marquee", start: w, end: w, add: e.shiftKey||e.metaKey||e.ctrlKey };
      setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) { setSelectedIds(new Set()); setPrimaryId(null); }
      return;
    }
    // Placement tools
    placeObjectAt(activeTool, w.x, w.y);
  };

  const placeObjectAt = (tool: Tool, wx: number, wy: number) => {
    pushHistory();
    // Rental Options — all placements create a Rentable Space (Booth object).
    const rentalVariant: RentalVariant | undefined =
      tool === "booth" ? "standard_booth" : RENTAL_VARIANT_BY_TOOL[tool];
    if (rentalVariant) {
      const spec = RENTAL_VARIANTS[rentalVariant];
      const nextIdx = booths.length + 1;
      const id = `NB${nextIdx}`;
      const nb: Booth = makeBooth(id, "N", nextIdx, snap(wx - spec.w/2), snap(wy - spec.h/2), spec.w, spec.h, "available", { variant: rentalVariant });
      setBooths(bs => [...bs, nb]);
      setSelectedIds(new Set([id])); setPrimaryId(id);
      setDirty(d=>{const n=new Set(d);n.add(id);return n;});
      toast.success(`Added ${spec.label} ${id}`);
      setActiveTool("select");
      return;
    }

    // Furniture tools → placed objects with furniture=true (non-rentable).
    const furnitureKindMap: Partial<Record<Tool, PlacedObj["kind"]>> = {
      furn_table4:"furn_table4", furn_table6:"table6", furn_table8:"table8", furn_tableRound:"tableRound",
      furn_cocktail:"cocktail_table", furn_banquet:"furn_banquet",
      furn_folding_chair:"furn_folding_chair", furn_banquet_chair:"furn_banquet_chair",
      furn_ceremony_chair:"furn_ceremony_chair", furn_bar_stool:"furn_bar_stool",
      furn_display_table:"furn_display_table", furn_display_rack:"furn_display_rack",
      furn_display_shelf:"furn_display_shelf", furn_podium:"furn_podium",
      furn_couch:"furn_couch", furn_bench:"bench", furn_picnic:"picnic_table",
    };

    const kindMap: Record<string, PlacedObj["kind"]> = {
      tree:"tree", building:"building", stage:"stage", parking:"parking", fence:"fence",
      rect:"rect", text:"text", road:"road", walkway:"walkway",
      table6:"table6", table8:"table8", tableRound:"tableRound", chair:"chair",
      pavilion:"pavilion", tent:"tent", ticket_booth:"ticket_booth", info_booth:"info_booth", food_truck:"food_truck",
      restroom:"restroom", atm:"atm", trash:"trash", bench:"bench", picnic_table:"picnic_table",
      electrical:"electrical", generator:"generator", water_hookup:"water_hookup", sewer:"sewer",
      oak_tree:"oak_tree", pine_tree:"pine_tree", shrub:"shrub", flower_bed:"flower_bed",
      cocktail_table:"cocktail_table", service_road:"service_road", emergency_lane:"emergency_lane",
      ...(furnitureKindMap as Record<string, PlacedObj["kind"]>),
    };
    const kind = kindMap[tool]; if (!kind) { toast.message(`Tool "${tool}" — click canvas to place`); return; }
    const defaults: Record<string,{w:number;h:number;label?:string}> = {
      tree:{w:32,h:32}, building:{w:90,h:60,label:"BUILDING"}, stage:{w:120,h:60}, parking:{w:80,h:60,label:"PARKING"},
      fence:{w:120,h:8}, rect:{w:80,h:60}, text:{w:80,h:20,label:"Text"},
      road:{w:160,h:28}, walkway:{w:120,h:20},
      table6:{w:60,h:25,label:"6′"}, table8:{w:80,h:25,label:"8′"},
      tableRound:{w:50,h:50,label:"60″"}, chair:{w:14,h:14},
      pavilion:{w:140,h:80}, tent:{w:80,h:70}, ticket_booth:{w:60,h:50}, info_booth:{w:56,h:50},
      food_truck:{w:110,h:50}, restroom:{w:70,h:50}, atm:{w:36,h:44}, trash:{w:24,h:28},
      bench:{w:48,h:16}, picnic_table:{w:70,h:36},
      electrical:{w:28,h:28}, generator:{w:60,h:40}, water_hookup:{w:26,h:26}, sewer:{w:26,h:26},
      oak_tree:{w:44,h:44}, pine_tree:{w:36,h:44}, shrub:{w:24,h:20}, flower_bed:{w:60,h:24},
      cocktail_table:{w:28,h:28},
      service_road:{w:120,h:22}, emergency_lane:{w:160,h:22},
      // Furniture defaults
      furn_table4:{w:42,h:18,label:"4′"}, furn_table6:{w:60,h:18,label:"6′"}, furn_table8:{w:80,h:18,label:"8′"},
      furn_tableRound:{w:50,h:50,label:'60"'}, furn_cocktail:{w:28,h:28}, furn_banquet:{w:96,h:34,label:"Banquet"},
      furn_folding_chair:{w:14,h:14}, furn_banquet_chair:{w:14,h:14},
      furn_ceremony_chair:{w:14,h:14}, furn_bar_stool:{w:14,h:14},
      furn_display_table:{w:60,h:22,label:"Display"}, furn_display_rack:{w:36,h:16,label:"Rack"},
      furn_display_shelf:{w:60,h:14,label:"Shelf"}, furn_podium:{w:22,h:22,label:"Podium"},
      furn_couch:{w:70,h:26,label:"Couch"}, furn_bench:{w:48,h:16}, furn_picnic:{w:70,h:36},
    };

    const d = defaults[tool] ?? { w:60,h:40 };
    const id = `p:${Date.now().toString(36)}`;
    const isFurniture = tool.startsWith("furn_");
    const obj: PlacedObj = { id, kind, x: snap(wx - d.w/2), y: snap(wy - d.h/2), w: d.w, h: d.h, label: d.label, rotation: 0, furniture: isFurniture };
    setPlaced(ps => [...ps, obj]);
    setSelectedIds(new Set([id])); setPrimaryId(id);
    toast.success(`Placed ${tool}`);
    setActiveTool("select");
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    if (g.kind === "idle") return;
    if (g.kind === "pan") {
      const dx = e.clientX - g.startClient.x, dy = e.clientY - g.startClient.y;
      setPan({ x: g.startPan.x + dx, y: g.startPan.y + dy });
      return;
    }
    const w = clientToWorld(e.clientX, e.clientY);
    if (g.kind === "drag") {
      const dx = w.x - g.startWorld.x, dy = w.y - g.startWorld.y;
      g.origMap.forEach((orig, id) => {
        setObjPos(id, snap(orig.x + dx), snap(orig.y + dy));
      });
      g.hasMoved = true;
    } else if (g.kind === "resize") {
      const dx = w.x - g.startWorld.x, dy = w.y - g.startWorld.y;
      let { x, y, w: ww, h: hh } = g.orig;
      if (g.handle.includes("e")) ww = Math.max(12, g.orig.w + dx);
      if (g.handle.includes("s")) hh = Math.max(12, g.orig.h + dy);
      if (g.handle.includes("w")) { const nx = Math.min(g.orig.x + dx, g.orig.x + g.orig.w - 12); ww = g.orig.w + (g.orig.x - nx); x = nx; }
      if (g.handle.includes("n")) { const ny = Math.min(g.orig.y + dy, g.orig.y + g.orig.h - 12); hh = g.orig.h + (g.orig.y - ny); y = ny; }
      setObjRect(g.id, snap(x), snap(y), snap(ww), snap(hh));
    } else if (g.kind === "bg-drag") {
      const dx = w.x - g.startWorld.x, dy = w.y - g.startWorld.y;
      setBackground(b => b ? { ...b, x: g.orig.x + dx, y: g.orig.y + dy } : b);
    } else if (g.kind === "bg-resize") {
      const dx = w.x - g.startWorld.x, dy = w.y - g.startWorld.y;
      let { x, y, w: ww, h: hh } = g.orig;
      if (g.handle.includes("e")) ww = Math.max(20, g.orig.w + dx);
      if (g.handle.includes("s")) hh = Math.max(20, g.orig.h + dy);
      if (g.handle.includes("w")) { const nx = Math.min(g.orig.x + dx, g.orig.x + g.orig.w - 20); ww = g.orig.w + (g.orig.x - nx); x = nx; }
      if (g.handle.includes("n")) { const ny = Math.min(g.orig.y + dy, g.orig.y + g.orig.h - 20); hh = g.orig.h + (g.orig.y - ny); y = ny; }
      setBackground(b => b ? { ...b, x, y, w: ww, h: hh } : b);
    } else if (g.kind === "bg-rotate") {
      const cur = Math.atan2(w.y - g.center.y, w.x - g.center.x) * 180/Math.PI;
      let next = g.origRot + (cur - g.startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      next = ((next % 360) + 360) % 360;
      setBackground(b => b ? { ...b, rotation: next } : b);
    } else if (g.kind === "rotate") {
      const cur = Math.atan2(w.y - g.center.y, w.x - g.center.x) * 180/Math.PI;
      let next = g.origRot + (cur - g.startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      next = ((next % 360) + 360) % 360;
      if (g.id.startsWith("p:")) setPlaced(ps=>ps.map(p=>p.id===g.id?{...p,rotation:next}:p));
      else { setBooths(bs=>bs.map(b=>b.id===g.id?{...b,rotation:next}:b)); setDirty(d=>{const n=new Set(d);n.add(g.id);return n;}); }
    } else if (g.kind === "marquee") {
      const x = Math.min(g.start.x, w.x), y = Math.min(g.start.y, w.y);
      const mw = Math.abs(w.x - g.start.x), mh = Math.abs(w.y - g.start.y);
      setMarquee({ x, y, w: mw, h: mh });
      g.end = w;
    }

  };
  const onSvgPointerUp = () => {
    const g = gestureRef.current;
    if (g.kind === "marquee" && marquee) {
      const inside = new Set<string>(g.add ? Array.from(selectedIds) : []);
      const box = marquee;
      booths.forEach(b => { if (b.x < box.x+box.w && b.x+b.w > box.x && b.y < box.y+box.h && b.y+b.h > box.y) inside.add(b.id); });
      placed.forEach(p => { if (p.x < box.x+box.w && p.x+p.w > box.x && p.y < box.y+box.h && p.y+p.h > box.y) inside.add(p.id); });
      setSelectedIds(inside);
      setPrimaryId(inside.size ? Array.from(inside)[0] : null);
      setMarquee(null);
    }
    if (g.kind === "drag" && !g.hasMoved) {
      // click without drag: keep selection as set
    }
    gestureRef.current = { kind: "idle" };
  };

  // Keyboard
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === "a") { e.preventDefault(); const all = new Set<string>([...booths.map(b=>b.id), ...placed.map(p=>p.id)]); setSelectedIds(all); setPrimaryId(all.size?Array.from(all)[0]:null); return; }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelection(); return; }
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); handleSave(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (selectedIds.size) { e.preventDefault(); deleteSelection(); } return; }
      if (e.key === "Escape") { setSelectedIds(new Set()); setPrimaryId(null); return; }
      if (!meta && e.key.toLowerCase() === "r" && selectedIds.size) {
        e.preventDefault();
        pushHistory();
        const step = e.shiftKey ? -15 : 15;
        selectedIds.forEach(id => {
          if (id.startsWith("p:")) setPlaced(ps=>ps.map(p=>p.id===id?{...p, rotation: (((p.rotation ?? 0) + step) % 360 + 360) % 360}:p));
          else { setBooths(bs=>bs.map(b=>b.id===id?{...b, rotation: (((b.rotation ?? 0) + step) % 360 + 360) % 360}:b)); setDirty(d=>{const n=new Set(d);n.add(id);return n;}); }
        });
        return;
      }
      const map: Record<string, Tool> = { v:"select", h:"pan", b:"booth", m:"measure" };
      const tool = map[e.key.toLowerCase()];
      if (tool) setActiveTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleSave = async () => {
    if (ctx?.onSave) {
      setSaveStatus("saving");
      try {
        await ctx.onSave({
          booths,
          objects: placed,
          background,
          canvas: canvasSize,
        });
        setSaveStatus("saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
        setSaveStatus("dirty");
      }
      return;
    }

    if (workspaceMode === "blank") {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saved");
  };

  const duplicateSelection = () => {
    if (!selectedIds.size) return;
    pushHistory();
    const newIds: string[] = [];
    const newBooths: Booth[] = [];
    const newPlaced: PlacedObj[] = [];
    selectedIds.forEach(id => {
      if (id.startsWith("p:")) {
        const o = placed.find(p=>p.id===id); if (!o) return;
        const nid = `p:${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
        newPlaced.push({ ...o, id: nid, x: o.x + 20, y: o.y + 20 });
        newIds.push(nid);
      } else {
        const b = booths.find(x=>x.id===id); if (!b) return;
        const nid = `${b.id}·${Math.random().toString(36).slice(2,4)}`;
        newBooths.push({ ...b, id: nid, x: b.x + 20, y: b.y + 20 });
        newIds.push(nid);
        setDirty(d=>{const n=new Set(d);n.add(nid);return n;});
      }
    });
    setBooths(bs => [...bs, ...newBooths]);
    setPlaced(ps => [...ps, ...newPlaced]);
    setSelectedIds(new Set(newIds));
    setPrimaryId(newIds[0] ?? null);
    toast.success(`Duplicated ${newIds.length}`);
  };
  const deleteSelection = () => {
    if (!selectedIds.size) return;
    pushHistory();
    setBooths(bs => bs.filter(b => !selectedIds.has(b.id)));
    setPlaced(ps => ps.filter(p => !selectedIds.has(p.id)));
    toast.success(`Deleted ${selectedIds.size}`);
    setSelectedIds(new Set()); setPrimaryId(null);
  };

  // Alignment / distribute
  const selectedBooths = useMemo(() => booths.filter(b => selectedIds.has(b.id)), [booths, selectedIds]);
  const selectedPlaced = useMemo(() => placed.filter(p => selectedIds.has(p.id)), [placed, selectedIds]);
  const alignAll = (fn: (rect: {x:number;y:number;w:number;h:number}, group: {x:number;y:number;w:number;h:number}) => {x?:number;y?:number}) => {
    const items = [...selectedBooths, ...selectedPlaced];
    if (items.length < 2) return;
    pushHistory();
    const minX = Math.min(...items.map(i=>i.x));
    const maxX = Math.max(...items.map(i=>i.x+i.w));
    const minY = Math.min(...items.map(i=>i.y));
    const maxY = Math.max(...items.map(i=>i.y+i.h));
    const group = { x:minX, y:minY, w:maxX-minX, h:maxY-minY };
    items.forEach(it => {
      const patch = fn({x:it.x,y:it.y,w:it.w,h:it.h}, group);
      const nx = patch.x ?? it.x, ny = patch.y ?? it.y;
      setObjPos(it.id, nx, ny);
    });
  };
  const distribute = (axis: "x" | "y") => {
    const items = [...selectedBooths, ...selectedPlaced];
    if (items.length < 3) { toast.message("Select 3+ to distribute"); return; }
    pushHistory();
    const sorted = [...items].sort((a,b)=> axis==="x" ? (a.x+a.w/2)-(b.x+b.w/2) : (a.y+a.h/2)-(b.y+b.h/2));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstC = axis === "x" ? first.x + first.w / 2 : first.y + first.h / 2;
    const lastC = axis === "x" ? last.x + last.w / 2 : last.y + last.h / 2;
    const step = (lastC - firstC) / (sorted.length - 1);
    sorted.forEach((item, i) => {
      if (i === 0 || i === sorted.length - 1) return;
      const target = firstC + step * i;
      const nx = axis === "x" ? target - item.w / 2 : item.x;
      const ny = axis === "y" ? target - item.h / 2 : item.y;
      setObjPos(item.id, nx, ny);
    });
  };
}

