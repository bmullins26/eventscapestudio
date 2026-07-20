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
} from "lucide-react";
import { toast } from "sonner";

// ─── Data context ────────────────────────────────────────────────────────────
type LayerRow = { id: string; name: string; color: string | null; visible: boolean; locked: boolean; kind: string };
export type WorkspaceCtx = {
  venueName: string;
  eventName: string;
  booths: Booth[] | null;
  layers: LayerRow[] | null;
  onPatchBooth?: (id: string, patch: Partial<Booth> & { staff_notes?: string; vendor_notes?: string }) => void;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  onOpenVendor?: (vendorProfileId: string) => void;
  onLayerToggle?: (id: string, patch: { visible?: boolean; locked?: boolean }) => void;
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
type Tool =
  | "select" | "pan" | "rect" | "polygon" | "line" | "text"
  | "booth"  | "road" | "walkway" | "fence"  | "building" | "parking"
  | "stage"  | "tree" | "measure" | "ai"    | "image"
  | "table6" | "table8" | "tableRound" | "chair";
type Sheet = "objects" | "layers" | "inspector" | null;

interface Booth {
  id: string; row: string; col: number;
  x: number;  y: number;  w: number;  h: number;
  status: BoothStatus;
  vendor?: string; category?: string;
  price: number; electric: boolean; water: boolean;
  corner: boolean; premium: boolean; size: string;
}

interface PlacedObj {
  id: string;
  kind: "tree" | "building" | "stage" | "parking" | "fence" | "rect" | "text"
      | "road" | "walkway" | "table6" | "table8" | "tableRound" | "chair";
  x: number; y: number; w: number; h: number; label?: string;
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
const WORLD_W = 1110, WORLD_H = 560;
const GRID_SIZE = 12;

// ─── Demo data (fallback) ────────────────────────────────────────────────────
function makeBooth(id: string, row: string, col: number, x: number, y: number, w: number, h: number, status: BoothStatus, opts: Partial<Booth> = {}): Booth {
  return { id, row, col, x, y, w, h, status, price: 150, electric: false, water: false, corner: false, premium: false, size: `${w}′×${h}′`, ...opts };
}
const DEMO_BOOTHS: Booth[] = [
  makeBooth("A1","A",1, 90,78,72,58,"paid",{vendor:"Sunrise Farms",category:"Produce",price:175,electric:true}),
  makeBooth("A2","A",2,168,78,72,58,"paid",{vendor:"Blue Ridge Honey",category:"Food",price:150}),
  makeBooth("A3","A",3,246,78,72,58,"paid",{vendor:"The Pottery Barn",category:"Crafts",price:150,electric:true}),
  makeBooth("A4","A",4,324,78,72,58,"reserved",{vendor:"Wildflower Soaps",category:"Beauty",price:150}),
  makeBooth("A5","A",5,402,78,72,58,"paid",{vendor:"Ironwood Forge",category:"Art",price:200,corner:true,premium:true}),
  makeBooth("A6","A",6,480,78,72,58,"available"),
  makeBooth("A7","A",7,558,78,72,58,"available"),
  makeBooth("A8","A",8,636,78,72,58,"pending",{vendor:"Maple Creek Syrups",category:"Food",water:true}),
  makeBooth("B1","B",1, 90,148,72,58,"paid",{vendor:"Prairie Wind Candles",category:"Home"}),
  makeBooth("B2","B",2,168,148,72,58,"available"),
  makeBooth("B3","B",3,246,148,72,58,"paid",{vendor:"Cedar & Stone",category:"Jewelry",electric:true}),
  makeBooth("B4","B",4,324,148,72,58,"reserved",{vendor:"Good Earth Nursery",category:"Plants",water:true}),
  makeBooth("C1","C",1, 90,314,72,58,"paid",{vendor:"Copper Kettle Co",category:"Food",electric:true,water:true}),
  makeBooth("C2","C",2,168,314,72,58,"paid",{vendor:"Summit Woodcraft",category:"Crafts"}),
  makeBooth("D1","D",1, 90,384,72,58,"paid",{vendor:"Blue Sky Ceramics",category:"Art"}),
  makeBooth("D2","D",2,168,384,72,58,"sponsor",{vendor:"Valley Credit Union",category:"Sponsor",price:500,premium:true}),
];

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
  { label:"Booths",     items:["Standard Booth","Corner Booth","Double Booth","Food Booth","Sponsor Booth"] },
  { label:"Structures", items:["Building","Stage","Pavilion","Tent","Ticket Booth","Info Booth"] },
  { label:"Roads",      items:["Main Road","Service Road","Walkway","Emergency Lane"] },
  { label:"Seating",    items:["6′ Table","8′ Table","Round Table","Chair","Cocktail Table"] },
  { label:"Utilities",  items:["Electrical Panel","Generator","Water Hookup","Sewer Access"] },
  { label:"Landscape",  items:["Oak Tree","Pine Tree","Shrub","Flower Bed"] },
  { label:"Amenities",  items:["Restroom","ATM","Trash Station","Bench","Picnic Table"] },
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

// ─── Booth SVG (interactive) ─────────────────────────────────────────────────
function BoothShape({
  booth, isSel, isPrimary, onPointerDownBody, onPointerDownHandle,
}: {
  booth: Booth; isSel: boolean; isPrimary: boolean;
  onPointerDownBody: (e: React.PointerEvent, id: string) => void;
  onPointerDownHandle: (e: React.PointerEvent, id: string, handle: string) => void;
}) {
  const { x, y, w, h, id, vendor, category, status, electric, water, premium } = booth;
  const sc = STATUS_COLORS[status];
  const cp = CANOPY_COLORS[category ?? ""] ?? DEFAULT_CANOPY;
  const cH = Math.round(h * 0.33);
  return (
    <g style={{cursor: isSel ? "move" : "pointer"}}>
      <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.2" rx="3"/>
      <rect
        x={x} y={y} width={w} height={h}
        fill={status==="unavailable"?"#D0CCC8":sc.fill}
        stroke={isSel?"#3B82F6":sc.stroke}
        strokeWidth={isSel?2.5:1} rx="3"
        onPointerDown={(e)=>onPointerDownBody(e, id)}
      />
      <defs>
        <linearGradient id={`c-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cp.top}/>
          <stop offset="100%" stopColor={cp.mid}/>
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={cH} fill={`url(#c-${id})`} rx="3" pointerEvents="none"/>
      {premium && <polygon points={`${x+w-14},${y} ${x+w},${y} ${x+w},${y+14}`} fill="#F59E0B" opacity="0.9" pointerEvents="none"/>}
      {status!=="available" && <rect x={x} y={y} width={4} height={h} fill={sc.stroke} rx="2" opacity="0.85" pointerEvents="none"/>}
      <text x={x+w/2} y={y+cH*0.7} textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Inter,sans-serif" pointerEvents="none" style={{filter:"drop-shadow(0 1px 1px rgba(0,0,0,0.6))"}}>{id}</text>
      {vendor ? (
        <text x={x+5} y={y+cH+13} fill="#1A1410" fontSize="6" fontFamily="Inter,sans-serif" fontWeight="600" pointerEvents="none">
          {vendor.length>13?vendor.slice(0,12)+"…":vendor}
        </text>
      ) : (
        <text x={x+w/2} y={y+cH+18} textAnchor="middle" fill="#6B7280" fontSize="6.5" fontFamily="Inter,sans-serif" fontStyle="italic" pointerEvents="none">Available</text>
      )}
      <text x={x+w-4} y={y+cH+14} textAnchor="end" fill={sc.stroke} fontSize="6" fontFamily="Inter,sans-serif" fontWeight="700" pointerEvents="none">${booth.price}</text>
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
    </g>
  );
}

// ─── Chrome (non-interactive art) ────────────────────────────────────────────
function CanvasChrome({ showGrid }: { showGrid: boolean }) {
  const W = WORLD_W, H = WORLD_H;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="grass" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#3A5E28"/>
          <line x1="0" y1="3" x2="3" y2="6" stroke="#344F22" strokeWidth="0.5" opacity="0.4"/>
        </pattern>
        <pattern id="griddots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.7" fill="#ffffff14"/>
          <circle cx="24" cy="24" r="0.7" fill="#ffffff14"/>
        </pattern>
        <pattern id="gravel" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#B8A882"/>
          <circle cx="2" cy="2" r="0.8" fill="#A89870" opacity="0.4"/>
        </pattern>
        <pattern id="asphalt" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#2A2A2E"/>
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grass)"/>
      {showGrid && <rect width={W} height={H} fill="url(#griddots)"/>}
      <rect x="5" y="5" width={W-10} height={H-10} fill="none" stroke="#8B9E7A" strokeWidth="2.5" strokeDasharray="8 5" rx="4" opacity="0.7"/>
      <ParkingLot x={10} y={10} w={72} h={58} label="PARKING"/>
      <ParkingLot x={W-82} y={10} w={72} h={58} label="PARKING"/>
      <StageSVG x={12} y={82} w={70} h={230}/>
      <BuildingSVG x={W-90} y={82} w={78} h={68} label="REGISTRATION"/>
      <BuildingSVG x={W-90} y={160} w={78} h={52} label="INFO BOOTH"/>
      <rect x={82} y={248} width={W-180} height={55} fill="url(#gravel)"/>
      <text x={(82+W-98)/2} y={278} textAnchor="middle" fill="#A09070" fontSize="8.5" letterSpacing="6" fontFamily="Inter,sans-serif" fontWeight="500">MAIN AISLE</text>
      <rect x={870} y={10} width={38} height={H-20} fill="url(#asphalt)"/>
      <TreeSVG cx={44} cy={54} r={14}/><TreeSVG cx={W-44} cy={54} r={14}/>
      <TreeSVG cx={46} cy={H-50} r={14}/><TreeSVG cx={W-46} cy={H-50} r={14}/>
      {["A","B","C","D"].map((row,i)=>{
        const yPos=[92,162,328,398][i];
        return <text key={row} x={82} y={yPos} textAnchor="middle" fill="#8A9E7A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.6">{row}</text>;
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
  return (
    <g style={{cursor: isSel?"move":"pointer"}}>
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
          <span className="text-xs font-semibold text-foreground">Booth {booth.id}{count>1 && ` +${count-1}`}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{background:c.fill, color:c.stroke, borderColor:c.stroke+"60"}}>{c.label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{booth.w}′×{booth.h}′ · {booth.category||"Unassigned"}</p>
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
      <Section label="Vendor">
        {booth.vendor ? (
          <><Row label="Business" value={booth.vendor}/><Row label="Category" value={booth.category||"—"}/></>
        ) : (
          <button className="w-full text-xs text-primary border border-dashed border-primary/30 rounded py-2 hover:bg-primary/10" onClick={()=>toast.message("Vendor picker coming soon")}>+ Assign Vendor</button>
        )}
      </Section>
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
  const [open, setOpen] = useState<string[]>(["Booths"]);
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

  // Booth state (editable copy of ctx.booths)
  const [booths, setBooths] = useState<Booth[]>(() => ctx?.booths ?? DEMO_BOOTHS);
  useEffect(()=>{ if (ctx?.booths) setBooths(ctx.booths); }, [ctx?.booths]);

  const [placed, setPlaced] = useState<PlacedObj[]>([]);

  // Selection: set of ids (both booths and placed objects share id space; placed ids prefixed "p:")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

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
    | { kind: "marquee"; start: {x:number;y:number}; end: {x:number;y:number}; add: boolean }
    | { kind: "pan"; startClient: {x:number;y:number}; startPan: {x:number;y:number} };
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
    if (tool === "booth") {
      const w = 72, h = 58;
      const nextIdx = booths.length + 1;
      const id = `NB${nextIdx}`;
      const nb: Booth = makeBooth(id, "N", nextIdx, snap(wx - w/2), snap(wy - h/2), w, h, "available");
      setBooths(bs => [...bs, nb]);
      setSelectedIds(new Set([id])); setPrimaryId(id);
      setDirty(d=>{const n=new Set(d);n.add(id);return n;});
      toast.success(`Added booth ${id}`);
      setActiveTool("select");
      return;
    }
    const kindMap: Record<string, PlacedObj["kind"]> = {
      tree:"tree", building:"building", stage:"stage", parking:"parking", fence:"fence",
      rect:"rect", text:"text", road:"road", walkway:"walkway",
      table6:"table6", table8:"table8", tableRound:"tableRound", chair:"chair",
    };
    const kind = kindMap[tool]; if (!kind) { toast.message(`Tool "${tool}" — click canvas to place`); return; }
    const defaults: Record<string,{w:number;h:number;label?:string}> = {
      tree:{w:32,h:32}, building:{w:90,h:60,label:"BUILDING"}, stage:{w:120,h:60}, parking:{w:80,h:60,label:"PARKING"},
      fence:{w:120,h:8}, rect:{w:80,h:60}, text:{w:80,h:20,label:"Text"},
      road:{w:160,h:28}, walkway:{w:120,h:20},
      // Tables in feet: 6ft x 2.5ft, 8ft x 2.5ft, round 5ft; chairs ~1.5ft square.
      table6:{w:60,h:25,label:"6′"}, table8:{w:80,h:25,label:"8′"},
      tableRound:{w:50,h:50,label:"60″"}, chair:{w:14,h:14},
    };
    const d = defaults[tool] ?? { w:60,h:40 };
    const id = `p:${Date.now().toString(36)}`;
    const obj: PlacedObj = { id, kind, x: snap(wx - d.w/2), y: snap(wy - d.h/2), w: d.w, h: d.h, label: d.label };
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
      const map: Record<string, Tool> = { v:"select", h:"pan", b:"booth", m:"measure", r:"rect", l:"line", t:"text" };
      const tool = map[e.key.toLowerCase()];
      if (tool) setActiveTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    const first = sorted[0], last = sorted[sorted.length-1];
    const start = axis==="x" ? first.x + first.w/2 : first.y + first.h/2;
    const end = axis==="x" ? last.x + last.w/2 : last.y + last.h/2;
    const step = (end - start) / (sorted.length - 1);
    sorted.forEach((it, i) => {
      if (i === 0 || i === sorted.length-1) return;
      const target = start + step*i;
      const nx = axis==="x" ? target - it.w/2 : it.x;
      const ny = axis==="y" ? target - it.h/2 : it.y;
      setObjPos(it.id, snap(nx), snap(ny));
    });
  };

  // Save
  const handleSave = () => {
    if (!ctx?.onPatchBooth) { toast.success("Layout saved"); setDirty(new Set()); return; }
    if (!dirty.size) { toast.message("Nothing changed"); return; }
    dirty.forEach(id => {
      const b = booths.find(x=>x.id===id); if (!b) return;
      ctx.onPatchBooth?.(id, { x: b.x, y: b.y, w: b.w, h: b.h, status: b.status, price: b.price, electric: b.electric, water: b.water, corner: b.corner, premium: b.premium });
    });
    toast.success(`Saved ${dirty.size} change${dirty.size===1?"":"s"}`);
    setDirty(new Set());
  };

  const primaryBooth = primaryId && !primaryId.startsWith("p:") ? booths.find(b=>b.id===primaryId) ?? null : null;
  const patchPrimary = (patch: Partial<Booth>) => {
    if (!primaryId) return;
    pushHistory();
    setBooths(bs=>bs.map(b=>b.id===primaryId?{...b,...patch}:b));
    setDirty(d=>{const n=new Set(d);n.add(primaryId);return n;});
  };

  // Onboard library click -> switch tool
  const onLibraryPick = (item: string) => {
    const lower = item.toLowerCase();
    if (lower.includes("booth")) setActiveTool("booth");
    else if (lower.includes("tree")) setActiveTool("tree");
    else if (lower.includes("build")) setActiveTool("building");
    else if (lower.includes("stage")) setActiveTool("stage");
    else if (lower.includes("park")) setActiveTool("parking");
    else if (lower.includes("road") || lower.includes("walk")) setActiveTool("road");
    else if (lower.includes("fence")) setActiveTool("fence");
    else setActiveTool("rect");
    toast.message(`Click the canvas to place: ${item}`);
  };

  const closeSheet = () => setSheet(null);

  const cursorForTool =
    activeTool === "pan" ? "grab" :
    activeTool === "select" ? "default" :
    "crosshair";

  return (
    <div className="flex flex-col w-screen bg-background text-foreground overflow-hidden select-none" style={{fontFamily:"Inter,sans-serif",fontSize:13,height:"100dvh"}}>
      {/* TOP BAR */}
      <header className="h-11 flex items-center gap-0 border-b border-border bg-card shrink-0 px-3 z-30">
        <div className="flex items-center gap-2 pr-3 border-r border-border mr-3 shrink-0">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center shrink-0"><Layers3 size={12} className="text-white"/></div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap hidden sm:inline">EventScape</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2 sm:mr-3 min-w-0 overflow-hidden">
          <span className="hidden sm:inline shrink-0">{ctx?.venueName ?? "Riverside Fairgrounds"}</span>
          <ChevronRight size={12} className="hidden sm:inline shrink-0"/>
          <span className="text-foreground font-medium truncate">{ctx?.eventName ?? "Summer Market 2025"}</span>
        </div>
        <div className="hidden md:flex items-center gap-0.5 bg-secondary rounded p-0.5 mr-4 shrink-0">
          {(["design","reservations","operations"] as Mode[]).map((m)=>(
            <button key={m} onClick={()=>setMode(m)} className={`px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${mode===m?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>{m}</button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-0.5 mr-3 shrink-0">
          <TBtn icon={Undo2} label="Undo (⌘Z)" onClick={undo}/>
          <TBtn icon={Redo2} label="Redo (⌘⇧Z)" onClick={redo}/>
        </div>
        <div className="flex-1"/>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex items-center gap-1.5 bg-input rounded px-2.5 py-1 mr-2">
            <Search size={11} className="text-muted-foreground"/>
            <span className="text-[11px] text-muted-foreground">Search or ⌘K</span>
          </div>
          <TBtn icon={Bell} label="Notifications" onClick={()=>toast.message("No new notifications")}/>
          <TBtn icon={Sparkles} label="AI" accent onClick={()=>toast.message("AI panel coming soon")}/>
          <button onClick={handleSave} className="hidden sm:flex items-center gap-1.5 text-[11px] bg-secondary border border-border text-foreground px-2.5 py-1.5 rounded hover:bg-muted transition-colors shrink-0">
            <Save size={11}/> Save{dirty.size?` (${dirty.size})`:""}
          </button>
          <button onClick={()=>toast.success("Publishing…")} className="flex items-center gap-1.5 text-[11px] bg-primary text-primary-foreground px-2.5 py-1.5 rounded hover:opacity-90 shrink-0">
            <Play size={11}/>
            <span className="hidden sm:inline">Publish</span>
          </button>
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center ml-1 shrink-0">
            <span className="text-[10px] font-semibold text-primary">JK</span>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left toolbar */}
        <div className="hidden md:flex w-11 flex-col items-center py-2 gap-0.5 bg-card border-r border-border shrink-0 overflow-y-auto z-20" style={{scrollbarWidth:"none"}}>
          {LEFT_TOOLS.map((t,i)=>(
            <div key={t.id} className="flex flex-col items-center w-full">
              {(i===2||i===6||i===13) && <div className="w-6 h-px bg-border my-1"/>}
              <button title={`${t.label}${t.shortcut?` (${t.shortcut})`:""}`} onClick={()=>setActiveTool(t.id)}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${activeTool===t.id?"bg-primary/20 text-primary":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <t.icon size={15} strokeWidth={1.5}/>
              </button>
            </div>
          ))}
        </div>

        {/* Left sidebar */}
        {(isDesktop || (isTablet && leftOpen)) && (
          <div className="w-56 flex-col bg-card border-r border-border shrink-0 z-20 hidden md:flex">
            <div className="flex overflow-x-auto border-b border-border" style={{scrollbarWidth:"none"}}>
              {LEFT_TABS.map((tab)=>(
                <button key={tab.id} title={tab.label} onClick={()=>setActiveTab(tab.id)}
                  className={`flex items-center justify-center shrink-0 w-10 h-9 transition-colors ${activeTab===tab.id?"text-primary border-b-2 border-primary":"text-muted-foreground hover:text-foreground"}`}>
                  <tab.icon size={14} strokeWidth={1.5}/>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab==="objects" && <ObjectLibrary onPick={onLibraryPick}/>}
              {activeTab==="layers"  && <LayersPanel/>}
              {activeTab!=="objects" && activeTab!=="layers" && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4">
                  <Package size={24} strokeWidth={1.5}/>
                  <p className="text-xs text-center capitalize">{LEFT_TABS.find(t=>t.id===activeTab)?.label} panel — coming soon</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CENTER CANVAS */}
        <div className="flex-1 relative overflow-hidden bg-[#111113] min-w-0">
          {/* Tablet toggles */}
          {isTablet && (
            <>
              <button onClick={()=>setLeftOpen(v=>!v)} className="absolute left-2 top-2 z-20 w-8 h-8 bg-card border border-border rounded flex items-center justify-center shadow-md">
                {leftOpen?<PanelLeftClose size={14} className="text-muted-foreground"/>:<PanelLeftOpen size={14} className="text-muted-foreground"/>}
              </button>
              <button onClick={()=>setRightOpen(v=>!v)} className="absolute right-2 top-2 z-20 w-8 h-8 bg-card border border-border rounded flex items-center justify-center shadow-md">
                {rightOpen?<PanelRightClose size={14} className="text-muted-foreground"/>:<PanelRightOpen size={14} className="text-muted-foreground"/>}
              </button>
            </>
          )}

          {/* Floating alignment bar */}
          {selectedIds.size >= 2 && !isMobile && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1">
              <TBtn icon={AlignLeft} label="Align left" onClick={()=>alignAll((r,g)=>({x:g.x}))}/>
              <TBtn icon={AlignCenter} label="Align center H" onClick={()=>alignAll((r,g)=>({x:g.x+(g.w-r.w)/2}))}/>
              <TBtn icon={AlignRight} label="Align right" onClick={()=>alignAll((r,g)=>({x:g.x+g.w-r.w}))}/>
              <div className="w-px h-4 bg-border mx-1"/>
              <TBtn icon={AlignStartVertical} label="Align top" onClick={()=>alignAll((r,g)=>({y:g.y}))}/>
              <TBtn icon={AlignCenterVertical} label="Align center V" onClick={()=>alignAll((r,g)=>({y:g.y+(g.h-r.h)/2}))}/>
              <TBtn icon={AlignEndVertical} label="Align bottom" onClick={()=>alignAll((r,g)=>({y:g.y+g.h-r.h}))}/>
              <div className="w-px h-4 bg-border mx-1"/>
              <TBtn icon={AlignHorizontalDistributeCenter} label="Distribute H" onClick={()=>distribute("x")}/>
              <TBtn icon={AlignVerticalDistributeCenter} label="Distribute V" onClick={()=>distribute("y")}/>
              <div className="w-px h-4 bg-border mx-1"/>
              <TBtn icon={Copy} label="Duplicate (⌘D)" onClick={duplicateSelection}/>
              <TBtn icon={Trash2} label="Delete" onClick={deleteSelection}/>
              <TBtn icon={X} label="Clear" onClick={()=>{setSelectedIds(new Set()); setPrimaryId(null);}}/>
            </div>
          )}

          {/* Canvas */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
              className="w-full h-full"
              style={{cursor: cursorForTool, touchAction: "none"}}
              onPointerDown={onSvgPointerDown}
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerCancel={onSvgPointerUp}
              onWheel={(e)=>{
                if (!e.ctrlKey && !e.metaKey) return;
                e.preventDefault();
                const delta = -e.deltaY * 0.002;
                setZoom(z => Math.min(4, Math.max(0.25, z * (1 + delta))));
              }}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                <CanvasChrome showGrid={showGrid}/>
                {placed.map(p => (
                  <PlacedObjSVG key={p.id} o={p} isSel={selectedIds.has(p.id)}
                    onPointerDownBody={onPointerDownBoothBody}
                    onPointerDownHandle={onPointerDownHandle}/>
                ))}
                {booths.map(b => (
                  <BoothShape key={b.id} booth={b}
                    isSel={selectedIds.has(b.id)}
                    isPrimary={primaryId === b.id}
                    onPointerDownBody={onPointerDownBoothBody}
                    onPointerDownHandle={onPointerDownHandle}/>
                ))}
                {marquee && (
                  <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
                    fill="#3B82F620" stroke="#3B82F6" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none"/>
                )}
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className="absolute bottom-14 md:bottom-10 left-3 z-10 bg-card/85 backdrop-blur-sm border border-border/50 rounded px-2.5 py-1.5">
            <Legend booths={booths}/>
          </div>

          {/* Zoom (mobile floating) */}
          {isMobile && (
            <div className="absolute bottom-14 right-3 z-10 flex flex-col gap-1">
              <button onClick={()=>setZoom(z=>Math.min(4,z+0.25))} className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center shadow-md"><ZoomIn size={18}/></button>
              <button onClick={()=>setZoom(z=>Math.max(0.25,z-0.25))} className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center shadow-md"><ZoomOut size={18}/></button>
            </div>
          )}

          {/* Tool hint */}
          {activeTool !== "select" && activeTool !== "pan" && (
            <div className="absolute top-2 right-2 z-10 bg-primary/15 text-primary text-[11px] px-2 py-1 rounded border border-primary/30">
              Click canvas to place: {LEFT_TOOLS.find(t=>t.id===activeTool)?.label} · Esc to cancel
            </div>
          )}
        </div>

        {/* RIGHT inspector */}
        {!isMobile && (isDesktop || (isTablet && rightOpen)) && (
          <div className="w-64 flex-col bg-card border-l border-border shrink-0 z-20 hidden md:flex">
            <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
              <span className="text-[11px] font-semibold text-foreground">Inspector</span>
              <SlidersHorizontal size={13} className="text-muted-foreground"/>
            </div>
            <InspectorContent
              booth={primaryBooth}
              count={selectedIds.size}
              onPatch={patchPrimary}
              onDelete={deleteSelection}
              onDuplicate={duplicateSelection}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <footer className="hidden md:flex h-7 items-center gap-4 px-3 bg-card border-t border-border shrink-0 z-20">
        <div className="flex items-center gap-1">
          <button onClick={()=>setZoom(z=>Math.max(0.25,z-0.1))} className="hover:text-foreground text-muted-foreground"><ZoomOut size={12}/></button>
          <span className="text-[10px] text-muted-foreground w-12 text-center" style={{fontFamily:"JetBrains Mono,monospace"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(4,z+0.1))} className="hover:text-foreground text-muted-foreground"><ZoomIn size={12}/></button>
          <button onClick={()=>{setZoom(1); setPan({x:0,y:0});}} className="text-[10px] text-muted-foreground hover:text-foreground ml-1">Fit</button>
        </div>
        <div className="w-px h-3 bg-border"/>
        <SToggle label="Grid" active={showGrid} onClick={()=>setShowGrid(v=>!v)} icon={Grid3x3}/>
        <SToggle label="Snap" active={snapEnabled} onClick={()=>setSnapEnabled(v=>!v)} icon={Magnet}/>
        <div className="w-px h-3 bg-border"/>
        {selectedIds.size
          ? <span className="text-[10px] text-primary">{selectedIds.size} selected</span>
          : <span className="text-[10px] text-muted-foreground">{booths.length} booths · {placed.length} objects</span>}
        <div className="flex-1"/>
        <div className="flex items-center gap-1"><Activity size={11} className="text-green-500"/><span className="text-[10px] text-muted-foreground">AI Ready</span></div>
        <div className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${dirty.size?"bg-amber-500":"bg-green-500"}`}/><span className="text-[10px] text-muted-foreground">{dirty.size?"Unsaved":"Saved"}</span></div>
      </footer>

      {/* Mobile dock + sheets */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border">
        <div className="flex justify-center gap-1 px-4 pt-2">
          {(["design","reservations","operations"] as Mode[]).map((m)=>(
            <button key={m} onClick={()=>setMode(m)} className={`flex-1 py-1 rounded text-[10px] capitalize font-medium transition-colors ${mode===m?"bg-primary/20 text-primary":"text-muted-foreground"}`}>{m}</button>
          ))}
        </div>
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          {([{id:"select",icon:MousePointer2,label:"Select"},{id:"pan",icon:Hand,label:"Pan"},{id:"booth",icon:LayoutGrid,label:"Booth"},{id:"measure",icon:Ruler,label:"Measure"}] as {id:Tool;icon:React.ElementType;label:string}[]).map((t)=>(
            <button key={t.id} onClick={()=>setActiveTool(t.id)} className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl transition-colors ${activeTool===t.id?"bg-primary/15 text-primary":"text-muted-foreground"}`}>
              <t.icon size={20} strokeWidth={1.5}/><span className="text-[9px]">{t.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-border mx-1"/>
          <button onClick={()=>setSheet("objects")} className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl text-muted-foreground"><Package size={20}/><span className="text-[9px]">Objects</span></button>
          <button onClick={()=>setSheet("layers")} className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl text-muted-foreground"><Layers3 size={20}/><span className="text-[9px]">Layers</span></button>
        </div>
      </div>
      <BottomSheet open={sheet==="objects"} title="Object Library" onClose={closeSheet}><ObjectLibrary onPick={(i)=>{onLibraryPick(i); closeSheet();}}/></BottomSheet>
      <BottomSheet open={sheet==="layers"} title="Layers" onClose={closeSheet}><LayersPanel/></BottomSheet>
      <BottomSheet open={sheet==="inspector"} title={primaryBooth?`Booth ${primaryBooth.id}`:"Inspector"} onClose={closeSheet}>
        <InspectorContent booth={primaryBooth} count={selectedIds.size} onPatch={patchPrimary} onDelete={deleteSelection} onDuplicate={duplicateSelection}/>
      </BottomSheet>
    </div>
  );
}
