import { useState, useEffect, createContext, useContext, useMemo } from "react";
import {
  MousePointer2, Hand, Square, Pentagon, Minus, Type, LayoutGrid,
  Route, Fence, Building2, ParkingCircle, Mic2, TreePine, Ruler,
  Wand2, ImagePlus, Undo2, Redo2, Save, Play, Search, Bell,
  ChevronRight, ZoomIn, ZoomOut, Grid3x3, Magnet, Layers3,
  ChevronDown, Package, BookTemplate, FolderOpen, Users, CalendarCheck,
  MessageSquare, Sparkles, Eye, EyeOff, Lock, Unlock, ChevronUp,
  MoreHorizontal, Zap, Droplets, Star, X, Plus, PanelLeftClose,
  PanelLeftOpen, PanelRightClose, PanelRightOpen,
  AlignLeft, SlidersHorizontal, Activity, Map,
} from "lucide-react";

// ─── Data context (real booths from Supabase; falls back to demo data) ──────
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

// ─── Breakpoint Hook ──────────────────────────────────────────────────────────



function useBreakpoint() {
  const [w, setW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1100, isDesktop: w >= 1100 };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type BoothStatus = "available" | "reserved" | "paid" | "pending" | "sponsor" | "unavailable";
type Mode       = "design" | "reservations" | "operations";
type Tool       =
  | "select" | "pan" | "rect" | "polygon" | "line" | "text"
  | "booth"  | "road" | "walkway" | "fence"  | "building" | "parking"
  | "stage"  | "tree" | "measure" | "ai"    | "image";
type Sheet = "objects" | "layers" | "inspector" | null;

interface Booth {
  id: string; row: string; col: number;
  x: number;  y: number;  w: number;  h: number;
  status: BoothStatus;
  vendor?: string; category?: string;
  price: number; electric: boolean; water: boolean;
  corner: boolean; premium: boolean; size: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Data ────────────────────────────────────────────────────────────────────

function makeBooth(
  id: string, row: string, col: number,
  x: number, y: number, w: number, h: number,
  status: BoothStatus, opts: Partial<Booth> = {}
): Booth {
  return {
    id, row, col, x, y, w, h, status,
    price: 150, electric: false, water: false,
    corner: false, premium: false, size: `${w}′×${h}′`,
    ...opts,
  };
}

const BOOTHS: Booth[] = [
  makeBooth("A1",  "A", 1,  90,  78,72,58,"paid",       {vendor:"Sunrise Farms",       category:"Produce",  price:175,electric:true}),
  makeBooth("A2",  "A", 2, 168,  78,72,58,"paid",       {vendor:"Blue Ridge Honey",    category:"Food",     price:150}),
  makeBooth("A3",  "A", 3, 246,  78,72,58,"paid",       {vendor:"The Pottery Barn",    category:"Crafts",   price:150,electric:true}),
  makeBooth("A4",  "A", 4, 324,  78,72,58,"reserved",   {vendor:"Wildflower Soaps",    category:"Beauty",   price:150}),
  makeBooth("A5",  "A", 5, 402,  78,72,58,"paid",       {vendor:"Ironwood Forge",      category:"Art",      price:200,corner:true,premium:true}),
  makeBooth("A6",  "A", 6, 480,  78,72,58,"available",  {price:150}),
  makeBooth("A7",  "A", 7, 558,  78,72,58,"available",  {price:150}),
  makeBooth("A8",  "A", 8, 636,  78,72,58,"pending",    {vendor:"Maple Creek Syrups",  category:"Food",     price:150,water:true}),
  makeBooth("A9",  "A", 9, 714,  78,72,58,"paid",       {vendor:"Artisan Thread Co",   category:"Textiles", price:150}),
  makeBooth("A10", "A",10, 792,  78,72,58,"sponsor",    {vendor:"First National Bank", category:"Sponsor",  price:500,premium:true}),

  makeBooth("B1",  "B", 1,  90, 148,72,58,"paid",       {vendor:"Prairie Wind Candles",category:"Home",     price:150}),
  makeBooth("B2",  "B", 2, 168, 148,72,58,"available",  {price:150}),
  makeBooth("B3",  "B", 3, 246, 148,72,58,"paid",       {vendor:"Cedar & Stone",       category:"Jewelry",  price:175,electric:true}),
  makeBooth("B4",  "B", 4, 324, 148,72,58,"reserved",   {vendor:"Good Earth Nursery",  category:"Plants",   price:150,water:true}),
  makeBooth("B5",  "B", 5, 402, 148,72,58,"paid",       {vendor:"Harvest Moon Jam",    category:"Food",     price:150}),
  makeBooth("B6",  "B", 6, 480, 148,72,58,"paid",       {vendor:"Threadbare Studio",   category:"Crafts",   price:150}),
  makeBooth("B7",  "B", 7, 558, 148,72,58,"available",  {price:150}),
  makeBooth("B8",  "B", 8, 636, 148,72,58,"available",  {price:150}),
  makeBooth("B9",  "B", 9, 714, 148,72,58,"pending",    {vendor:"Oak & Ember",         category:"Food",     price:175,electric:true}),
  makeBooth("B10", "B",10, 792, 148,72,58,"paid",       {vendor:"Valley Glass Art",    category:"Art",      price:200,corner:true}),

  makeBooth("C1",  "C", 1,  90, 314,72,58,"paid",       {vendor:"Copper Kettle Co",    category:"Food",     price:150,electric:true,water:true}),
  makeBooth("C2",  "C", 2, 168, 314,72,58,"paid",       {vendor:"Summit Woodcraft",    category:"Crafts",   price:150}),
  makeBooth("C3",  "C", 3, 246, 314,72,58,"available",  {price:150}),
  makeBooth("C4",  "C", 4, 324, 314,72,58,"reserved",   {vendor:"River Stone Pottery", category:"Art",      price:175}),
  makeBooth("C5",  "C", 5, 402, 314,72,58,"paid",       {vendor:"Wild Roots Farm",     category:"Produce",  price:150,water:true}),
  makeBooth("C6",  "C", 6, 480, 314,72,58,"paid",       {vendor:"Ember & Ash Sauce",   category:"Food",     price:150}),
  makeBooth("C7",  "C", 7, 558, 314,72,58,"available",  {price:150}),
  makeBooth("C8",  "C", 8, 636, 314,72,58,"paid",       {vendor:"Clover Lane Honey",   category:"Food",     price:150}),
  makeBooth("C9",  "C", 9, 714, 314,72,58,"unavailable",{price:150}),
  makeBooth("C10", "C",10, 792, 314,72,58,"paid",       {vendor:"Thistle & Thread",    category:"Textiles", price:175,corner:true}),

  makeBooth("D1",  "D", 1,  90, 384,72,58,"paid",       {vendor:"Blue Sky Ceramics",   category:"Art",      price:150}),
  makeBooth("D2",  "D", 2, 168, 384,72,58,"sponsor",    {vendor:"Valley Credit Union", category:"Sponsor",  price:500,premium:true}),
  makeBooth("D3",  "D", 3, 246, 384,72,58,"available",  {price:150}),
  makeBooth("D4",  "D", 4, 324, 384,72,58,"paid",       {vendor:"Mossy Oak Soap",      category:"Beauty",   price:150}),
  makeBooth("D5",  "D", 5, 402, 384,72,58,"reserved",   {vendor:"Pinecone Press",      category:"Art",      price:150}),
  makeBooth("D6",  "D", 6, 480, 384,72,58,"paid",       {vendor:"Harvest Table",       category:"Food",     price:175,electric:true}),
  makeBooth("D7",  "D", 7, 558, 384,72,58,"available",  {price:150}),
  makeBooth("D8",  "D", 8, 636, 384,72,58,"paid",       {vendor:"Fernwood Candles",    category:"Home",     price:150}),
  makeBooth("D9",  "D", 9, 714, 384,72,58,"pending",    {vendor:"Mountain Made",       category:"Crafts",   price:150}),
  makeBooth("D10", "D",10, 792, 384,72,58,"paid",       {vendor:"Stonebridge Forge",   category:"Art",      price:200,corner:true,premium:true}),
];

const LEFT_TOOLS: { id: Tool; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id:"select",   icon:MousePointer2, label:"Select",      shortcut:"V" },
  { id:"pan",      icon:Hand,          label:"Pan",         shortcut:"H" },
  { id:"rect",     icon:Square,        label:"Rectangle",   shortcut:"R" },
  { id:"polygon",  icon:Pentagon,      label:"Polygon",     shortcut:"P" },
  { id:"line",     icon:Minus,         label:"Line",        shortcut:"L" },
  { id:"text",     icon:Type,          label:"Text",        shortcut:"T" },
  { id:"booth",    icon:LayoutGrid,    label:"Booth",       shortcut:"B" },
  { id:"road",     icon:Route,         label:"Road",        shortcut:"O" },
  { id:"fence",    icon:Fence,         label:"Fence" },
  { id:"building", icon:Building2,     label:"Building" },
  { id:"parking",  icon:ParkingCircle, label:"Parking" },
  { id:"stage",    icon:Mic2,          label:"Stage" },
  { id:"tree",     icon:TreePine,      label:"Tree" },
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
  { label:"Roads",      items:["Main Road","Service Road","Walkway","Emergency Lane","Fire Lane"] },
  { label:"Utilities",  items:["Electrical Panel","Generator","Water Hookup","Sewer Access"] },
  { label:"Landscape",  items:["Oak Tree","Pine Tree","Shrub","Flower Bed","Grass Area","Water Feature"] },
  { label:"Amenities",  items:["Restroom","ATM","Trash Station","Bench","Picnic Table","Lighting Pole"] },
  { label:"Emergency",  items:["First Aid","Security Post","ADA Route","Emergency Exit"] },
];

const LAYERS_DATA = [
  { id:"ref",      label:"Reference",   visible:true,  locked:true,  color:"#888" },
  { id:"bldg",     label:"Buildings",   visible:true,  locked:false, color:"#60A5FA" },
  { id:"roads",    label:"Roads",       visible:true,  locked:false, color:"#78716C" },
  { id:"parking",  label:"Parking",     visible:true,  locked:false, color:"#94A3B8" },
  { id:"utils",    label:"Utilities",   visible:false, locked:false, color:"#FCD34D" },
  { id:"land",     label:"Landscaping", visible:true,  locked:false, color:"#4ADE80" },
  { id:"booths",   label:"Booths",      visible:true,  locked:false, color:"#F97316" },
  { id:"sponsors", label:"Sponsors",    visible:true,  locked:false, color:"#C084FC" },
  { id:"labels",   label:"Labels",      visible:true,  locked:false, color:"#F9FAFB" },
];

// ─── SVG Object Components ────────────────────────────────────────────────────

function TreeSVG({ cx, cy, r = 16 }: { cx:number; cy:number; r?:number }) {
  return (
    <g>
      <ellipse cx={cx+r*0.3} cy={cy+r*0.4} rx={r*0.85} ry={r*0.55} fill="#000" opacity="0.18"/>
      <circle cx={cx} cy={cy} r={r} fill="#1A5C10"/>
      <circle cx={cx} cy={cy} r={r*0.74} fill="#22750E"/>
      <circle cx={cx-r*0.22} cy={cy-r*0.22} r={r*0.42} fill="#2E9A1A" opacity="0.75"/>
      <circle cx={cx-r*0.14} cy={cy-r*0.28} r={r*0.16} fill="#3EBF24" opacity="0.5"/>
    </g>
  );
}

function ShrubSVG({ cx, cy }: { cx:number; cy:number }) {
  return (
    <g>
      <ellipse cx={cx+2} cy={cy+3} rx={10} ry={6} fill="#000" opacity="0.14"/>
      <ellipse cx={cx} cy={cy} rx={10} ry={7} fill="#1E6B14"/>
      <ellipse cx={cx-3} cy={cy-2} rx={6} ry={5} fill="#268A1A"/>
      <ellipse cx={cx+4} cy={cy-1} rx={5} ry={4} fill="#2A9620"/>
      <circle cx={cx-2} cy={cy-4} r={3} fill="#32A825" opacity="0.6"/>
    </g>
  );
}

function BoothSVG({
  booth, selected, onSelect,
}: { booth:Booth; selected:string|null; onSelect:(id:string)=>void }) {
  const { x, y, w, h, id, vendor, category, status, electric, water, premium } = booth;
  const isSel = selected === id;
  const sc  = STATUS_COLORS[status];
  const cp  = CANOPY_COLORS[category ?? ""] ?? DEFAULT_CANOPY;
  const cH  = Math.round(h * 0.33);

  return (
    <g style={{cursor:"pointer"}} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
      <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.2" rx="3"/>
      <rect x={x} y={y} width={w} height={h}
        fill={status==="unavailable"?"#D0CCC8":sc.fill}
        stroke={isSel?"#3B82F6":sc.stroke}
        strokeWidth={isSel?2.5:1} rx="3"/>
      <defs>
        <linearGradient id={`c-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cp.top}/>
          <stop offset="100%" stopColor={cp.mid}/>
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={cH} fill={`url(#c-${id})`} rx="3"/>
      <rect x={x} y={y+cH-2} width={w} height={3} fill="#00000030"/>
      {[0.2,0.4,0.6,0.8].map((p,i)=>(
        <line key={i} x1={x+w*p} y1={y} x2={x+w*p} y2={y+cH} stroke="#ffffff12" strokeWidth="3"/>
      ))}
      {Array.from({length:Math.floor(w/12)}).map((_,i)=>(
        <path key={i}
          d={`M${x+i*12} ${y+cH} Q${x+i*12+6} ${y+cH+5} ${x+i*12+12} ${y+cH}`}
          fill={cp.mid} stroke={cp.top} strokeWidth="0.5"/>
      ))}
      {premium && (
        <polygon points={`${x+w-14},${y} ${x+w},${y} ${x+w},${y+14}`} fill="#F59E0B" opacity="0.9"/>
      )}
      {status!=="available" && (
        <rect x={x} y={y} width={4} height={h} fill={sc.stroke} rx="2" opacity="0.85"/>
      )}
      <text x={x+w/2} y={y+cH*0.66} textAnchor="middle"
        fill="white" fontSize="8.5" fontWeight="700" fontFamily="Inter,sans-serif"
        style={{filter:"drop-shadow(0 1px 1px rgba(0,0,0,0.6))"}}>
        {id}
      </text>
      {vendor ? (
        <text x={x+5} y={y+cH+13} fill="#1A1410" fontSize="6" fontFamily="Inter,sans-serif" fontWeight="600">
          {vendor.length>13?vendor.slice(0,12)+"…":vendor}
        </text>
      ) : (
        <text x={x+w/2} y={y+cH+18} textAnchor="middle"
          fill="#6B7280" fontSize="6.5" fontFamily="Inter,sans-serif" fontStyle="italic">
          Available
        </text>
      )}
      {category && (
        <text x={x+5} y={y+cH+24} fill="#6B7280" fontSize="5.5" fontFamily="Inter,sans-serif">
          {category}
        </text>
      )}
      <text x={x+w-4} y={y+cH+14} textAnchor="end"
        fill={sc.stroke} fontSize="6" fontFamily="Inter,sans-serif" fontWeight="700">
        ${booth.price}
      </text>
      <rect x={x+w/2-11} y={y+h-2} width={22} height={4} fill="#4A6B38" rx="1"/>
      <line x1={x+w/2-11} y1={y+h-2} x2={x+w/2-11} y2={y+h+2} stroke="#8B9E7A" strokeWidth="1"/>
      <line x1={x+w/2+11} y1={y+h-2} x2={x+w/2+11} y2={y+h+2} stroke="#8B9E7A" strokeWidth="1"/>
      {electric && (
        <g transform={`translate(${x+6},${y+h-10})`}>
          <circle r="4.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8"/>
          <text textAnchor="middle" y="1.8" fill="#92400E" fontSize="5.5" fontWeight="700">⚡</text>
        </g>
      )}
      {water && (
        <g transform={`translate(${x+(electric?17:6)},${y+h-10})`}>
          <circle r="4.5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="0.8"/>
          <text textAnchor="middle" y="1.8" fill="#0369A1" fontSize="5.5">💧</text>
        </g>
      )}
      {isSel && [
        [0,0],[0.5,0],[1,0],[1,0.5],[1,1],[0.5,1],[0,1],[0,0.5],
      ].map(([ox,oy],i)=>(
        <rect key={i}
          x={x+ox*w-3.5} y={y+oy*h-3.5}
          width={7} height={7}
          fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1.5}/>
      ))}
    </g>
  );
}

function FoodTruckSVG({ x, y, w=80, h=45, label }: {
  x:number; y:number; w?:number; h?:number; label:string;
}) {
  const cabW = w*0.26;
  return (
    <g>
      <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.22" rx="4"/>
      <rect x={x} y={y} width={w} height={h} fill="#F5F0E8" stroke="#A09080" strokeWidth="1" rx="3"/>
      <rect x={x} y={y} width={cabW} height={h} fill="#D4C8B8" stroke="#A09080" strokeWidth="0.8" rx="3"/>
      <rect x={x+4} y={y+5} width={cabW-10} height={h*0.38} fill="#B8D8F0" stroke="#90B8D8" strokeWidth="0.5" rx="2"/>
      <rect x={x+cabW+6} y={y+8} width={w-cabW-14} height={h*0.42} fill="#A8C8E8" stroke="#7AA8C8" strokeWidth="0.8" rx="2"/>
      <rect x={x+cabW+2} y={y-8} width={w-cabW-8} height={10} fill="#CC4410" stroke="#AA3000" strokeWidth="0.8" rx="2"/>
      {[0.25,0.5,0.75].map((p,i)=>(
        <line key={i}
          x1={x+cabW+2+(w-cabW-10)*p} y1={y-8}
          x2={x+cabW+2+(w-cabW-10)*p} y2={y+2}
          stroke="#AA3000" strokeWidth="2.5" opacity="0.5"/>
      ))}
      {[0.18,0.78].map((p,i)=>(
        <g key={i}>
          <rect x={x+w*p-7} y={y+h-3} width={14} height={8} fill="#333" rx="3"/>
          <rect x={x+w*p-4} y={y+h-1} width={8} height={4} fill="#555" rx="2"/>
        </g>
      ))}
      <text x={x+cabW+(w-cabW)/2} y={y+h*0.72} textAnchor="middle"
        fill="#2D2010" fontSize="6" fontWeight="600" fontFamily="Inter,sans-serif">
        {label}
      </text>
    </g>
  );
}

function ParkingLot({ x, y, w, h, label }: {
  x:number; y:number; w:number; h:number; label:string;
}) {
  const spaceW = 16;
  const num = Math.floor((w-6)/spaceW);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#3A3A40" stroke="#4A4A52" strokeWidth="1" rx="2"/>
      {Array.from({length:num+1}).map((_,i)=>(
        <line key={i} x1={x+3+i*spaceW} y1={y+4} x2={x+3+i*spaceW} y2={y+h-4} stroke="#606070" strokeWidth="0.8"/>
      ))}
      <path d={`M${x+w/2-6} ${y+h-2} L${x+w/2} ${y+h+6} L${x+w/2+6} ${y+h-2}`} fill="#22C55E" opacity="0.7"/>
      <text x={x+w/2} y={y+h/2+3} textAnchor="middle"
        fill="#7A7A8A" fontSize="8" fontWeight="600" fontFamily="Inter,sans-serif" letterSpacing="1">
        {label}
      </text>
    </g>
  );
}

function StageSVG({ x, y, w, h }: { x:number; y:number; w:number; h:number }) {
  const backH = Math.round(h*0.25);
  const floorH = Math.round(h*0.6);
  const lipH = Math.round(h*0.1);
  return (
    <g>
      <rect x={x+4} y={y+4} width={w} height={h} fill="#000" opacity="0.25" rx="4"/>
      <rect x={x} y={y} width={w} height={backH} fill="#1A0E2E" stroke="#3B1D72" strokeWidth="1" rx="3"/>
      <text x={x+w/2} y={y+backH*0.62} textAnchor="middle"
        fill="#6D28D9" fontSize="7" letterSpacing="3" fontFamily="Inter,sans-serif" fontWeight="600">BACKSTAGE</text>
      <rect x={x+2} y={y+2} width={10} height={backH-3} fill="#2D0A50" opacity="0.5" rx="1"/>
      <rect x={x+w-12} y={y+2} width={10} height={backH-3} fill="#2D0A50" opacity="0.5" rx="1"/>
      <rect x={x} y={y+backH} width={w} height={floorH} fill="#3B2208" stroke="#4A2E10" strokeWidth="1"/>
      {Array.from({length:9}).map((_,i)=>(
        <line key={i} x1={x} y1={y+backH+(floorH/9)*i} x2={x+w} y2={y+backH+(floorH/9)*i}
          stroke="#4A2E10" strokeWidth="0.8"/>
      ))}
      <rect x={x} y={y+backH+floorH} width={w} height={lipH} fill="#4A3010" stroke="#5A4020" strokeWidth="0.8"/>
      {[x+3, x+w-19].map((sx,i)=>(
        <g key={i}>
          <rect x={sx} y={y+backH+floorH*0.35} width={16} height={floorH*0.55}
            fill="#111" stroke="#2A2A2A" strokeWidth="0.8" rx="2"/>
          {[0.25,0.55,0.8].map((_,j)=>(
            <circle key={j} cx={sx+8} cy={y+backH+floorH*0.35+floorH*0.55*_} r={4}
              fill="#1A1A1A" stroke="#333" strokeWidth="0.5"/>
          ))}
        </g>
      ))}
      {[0.1,0.25,0.4,0.6,0.75,0.9].map((p,i)=>(
        <g key={i}>
          <circle cx={x+w*p} cy={y+backH+4} r={3.5} fill="#1A1A00" stroke="#555" strokeWidth="0.5"/>
          <circle cx={x+w*p} cy={y+backH+4} r={2} fill="#FDE68A" opacity="0.8"/>
        </g>
      ))}
      {[0,4,8].map((dy,i)=>(
        <rect key={i}
          x={x+w/2-(16-i*2)} y={y+backH+floorH+lipH-1+dy}
          width={(16-i*2)*2} height={5}
          fill={`hsl(30,40%,${15+i*5}%)`} stroke="#4A3010" strokeWidth="0.5"/>
      ))}
      <text x={x+w/2} y={y+backH+floorH*0.52} textAnchor="middle"
        fill="#92400E" fontSize="10" fontWeight="800" letterSpacing="4"
        fontFamily="Inter,sans-serif" opacity="0.7">STAGE</text>
    </g>
  );
}

function BuildingSVG({ x, y, w, h, label }: {
  x:number; y:number; w:number; h:number; label:string;
}) {
  const inset = 5;
  return (
    <g>
      <rect x={x+3} y={y+3} width={w} height={h} fill="#000" opacity="0.2" rx="3"/>
      <rect x={x} y={y} width={w} height={h} fill="#D4CEC8" stroke="#A09A94" strokeWidth="1" rx="3"/>
      <rect x={x+inset} y={y+inset} width={w-inset*2} height={h-inset*2}
        fill="#C8C2BC" stroke="#8A8480" strokeWidth="0.8" rx="1"/>
      <line x1={x+w/2} y1={y+inset+2} x2={x+w/2} y2={y+h-inset-2}
        stroke="#B0AAA4" strokeWidth="1.5" strokeDasharray="3 3"/>
      <rect x={x+w/2-5} y={y+h-inset-10} width={10} height={10}
        fill="#8A7A6A" stroke="#6A5A4A" strokeWidth="0.5" rx="1"/>
      {w>50 && <>
        <rect x={x+inset+4} y={y+inset+6} width={10} height={8}
          fill="#B8D8F0" stroke="#90B0D0" strokeWidth="0.5" rx="1"/>
        <rect x={x+w-inset-14} y={y+inset+6} width={10} height={8}
          fill="#B8D8F0" stroke="#90B0D0" strokeWidth="0.5" rx="1"/>
      </>}
      <text x={x+w/2} y={y+h/2+2} textAnchor="middle"
        fill="#4A4040" fontSize="7" fontWeight="600" fontFamily="Inter,sans-serif">
        {label}
      </text>
    </g>
  );
}

function RestroomSVG({ x, y }: { x:number; y:number }) {
  return (
    <g>
      <rect x={x+2} y={y+2} width={46} height={36} fill="#000" opacity="0.15" rx="3"/>
      <rect x={x} y={y} width={46} height={36} fill="#E8F0F8" stroke="#7090C0" strokeWidth="1" rx="3"/>
      <rect x={x+4} y={y+4} width={38} height={28} fill="#D8E8F4" stroke="#8AA0CC" strokeWidth="0.5" rx="1"/>
      <line x1={x+23} y1={y} x2={x+23} y2={y+36} stroke="#7090C0" strokeWidth="0.8"/>
      <text x={x+11} y={y+22} textAnchor="middle" fill="#3060A0" fontSize="11">♂</text>
      <text x={x+34} y={y+22} textAnchor="middle" fill="#A03060" fontSize="11">♀</text>
    </g>
  );
}

function FirstAidSVG({ x, y }: { x:number; y:number }) {
  return (
    <g>
      <rect x={x+2} y={y+2} width={36} height={36} fill="#000" opacity="0.15" rx="3"/>
      <rect x={x} y={y} width={36} height={36} fill="#FEE2E2" stroke="#DC2626" strokeWidth="1.5" rx="3"/>
      <rect x={x+4} y={y+4} width={28} height={28} fill="#FECACA" stroke="#EF4444" strokeWidth="0.5" rx="1"/>
      <rect x={x+15.5} y={y+8} width={5} height={20} fill="#DC2626" rx="1"/>
      <rect x={x+7} y={y+15.5} width={22} height={5} fill="#DC2626" rx="1"/>
    </g>
  );
}

// ─── Venue Canvas SVG ─────────────────────────────────────────────────────────

function VenueCanvas({
  booths, selected, onSelect, showGrid,
}: {
  booths: Booth[]; selected: string|null;
  onSelect: (id:string|null)=>void; showGrid: boolean;
}) {
  const W = 1110; const H = 560;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{cursor:"default"}}
      onClick={(e)=>{ if(e.target===e.currentTarget) onSelect(null); }}>
      <defs>
        <pattern id="grass" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#3A5E28"/>
          <line x1="0" y1="3" x2="3" y2="6" stroke="#344F22" strokeWidth="0.5" opacity="0.4"/>
          <line x1="3" y1="0" x2="6" y2="3" stroke="#42682E" strokeWidth="0.4" opacity="0.3"/>
        </pattern>
        <pattern id="griddots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.7" fill="#ffffff14"/>
          <circle cx="24" cy="0" r="0.7" fill="#ffffff14"/>
          <circle cx="0" cy="24" r="0.7" fill="#ffffff14"/>
          <circle cx="24" cy="24" r="0.7" fill="#ffffff14"/>
        </pattern>
        <pattern id="gravel" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#B8A882"/>
          <circle cx="2" cy="2" r="0.8" fill="#A89870" opacity="0.4"/>
          <circle cx="6" cy="5" r="0.6" fill="#C8B892" opacity="0.3"/>
        </pattern>
        <pattern id="asphalt" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#2A2A2E"/>
        </pattern>
      </defs>

      <rect width={W} height={H} fill="url(#grass)"/>
      {showGrid && <rect width={W} height={H} fill="url(#griddots)"/>}
      <rect x="5" y="5" width={W-10} height={H-10}
        fill="none" stroke="#8B9E7A" strokeWidth="2.5" strokeDasharray="8 5" rx="4" opacity="0.7"/>
      {[[5,5],[W-10,5],[5,H-10],[W-10,H-10]].map(([px,py],i)=>(
        <rect key={i} x={px} y={py} width={5} height={5} fill="#6A7A5A" rx="1"/>
      ))}

      <ParkingLot x={10} y={10} w={72} h={58} label="PARKING"/>
      <ParkingLot x={W-82} y={10} w={72} h={58} label="PARKING"/>
      <StageSVG x={12} y={82} w={70} h={230}/>
      <BuildingSVG x={W-90} y={82} w={78} h={68} label="REGISTRATION"/>
      <BuildingSVG x={W-90} y={160} w={78} h={52} label="INFO BOOTH"/>
      <rect x={W-90} y={224} width={78} height={100} fill="#2A1A08" stroke="#5A3A18" strokeWidth="1" rx="3"/>
      <text x={W-51} y={268} textAnchor="middle" fill="#92400E" fontSize="7.5" fontWeight="700" letterSpacing="1" fontFamily="Inter,sans-serif">FOOD</text>
      <text x={W-51} y={279} textAnchor="middle" fill="#92400E" fontSize="7.5" fontWeight="700" letterSpacing="1" fontFamily="Inter,sans-serif">COURT</text>
      {[[0.25,0.3],[0.7,0.3],[0.25,0.65],[0.7,0.65]].map(([px,py],i)=>(
        <g key={i}>
          <circle cx={W-90+78*px} cy={224+100*py} r={7} fill="#3A2808" stroke="#5A3A18" strokeWidth="0.8"/>
          <circle cx={W-90+78*px} cy={224+100*py} r={3} fill="#2A2010"/>
        </g>
      ))}

      <rect x={82} y={248} width={W-180} height={55} fill="url(#gravel)"/>
      <line x1={82} y1={248} x2={W-98} y2={248} stroke="#D4C8A8" strokeWidth="1.5" opacity="0.6"/>
      <line x1={82} y1={303} x2={W-98} y2={303} stroke="#D4C8A8" strokeWidth="1.5" opacity="0.6"/>
      {Array.from({length:12}).map((_,i)=>(
        <rect key={i} x={82+30+i*78} y={271} width={48} height={4} fill="#C8BA90" opacity="0.3" rx="1"/>
      ))}
      <text x={(82+W-98)/2} y={278} textAnchor="middle"
        fill="#A09070" fontSize="8.5" letterSpacing="6" fontFamily="Inter,sans-serif" fontWeight="500">MAIN AISLE</text>

      <rect x={870} y={10} width={38} height={H-20} fill="url(#asphalt)"/>
      <line x1={889} y1={10} x2={889} y2={H-20} stroke="#3A3A40" strokeWidth="0.8" strokeDasharray="10 7"/>
      <line x1={870} y1={10} x2={870} y2={H-20} stroke="#3A3A40" strokeWidth="1"/>
      <line x1={908} y1={10} x2={908} y2={H-20} stroke="#3A3A40" strokeWidth="1"/>

      <TreeSVG cx={44} cy={54} r={14}/><TreeSVG cx={W-44} cy={54} r={14}/>
      <TreeSVG cx={46} cy={H-50} r={14}/><TreeSVG cx={W-46} cy={H-50} r={14}/>
      {[78,148,314,384].map((ty,i)=><TreeSVG key={i} cx={82} cy={ty+29} r={10}/>)}
      {[150,320,500,680,840].map((bx,i)=><ShrubSVG key={i} cx={bx} cy={274}/>)}

      <FoodTruckSVG x={90}  y={455} label="Smokey's BBQ"/>
      <FoodTruckSVG x={185} y={455} label="Taco Grande"/>
      <FoodTruckSVG x={280} y={455} label="Fresh Press"/>
      <FoodTruckSVG x={375} y={455} label="Noodle Bar"/>
      <FoodTruckSVG x={470} y={455} label="The Creperie"/>

      <RestroomSVG x={600} y={460}/>
      <FirstAidSVG x={660} y={460}/>
      <BuildingSVG x={706} y={460} w={52} h={36} label="SECURITY"/>
      <g>
        <rect x={768} y={462} width={22} height={32} fill="#2A3A2A" stroke="#3A5A3A" strokeWidth="1" rx="2"/>
        <rect x={771} y={466} width={16} height={8} fill="#4A8A6A" rx="1"/>
        <text x={779} y={486} textAnchor="middle" fill="#6ABE8A" fontSize="6" fontFamily="Inter,sans-serif">ATM</text>
      </g>
      {[120,280,450,650].map((bx,i)=>(
        <g key={i}>
          <rect x={bx} y={310} width={24} height={6} fill="#8B7355" stroke="#6A5A3A" strokeWidth="0.5" rx="1"/>
          <rect x={bx+2} y={314} width={5} height={6} fill="#7A6344" rx="1"/>
          <rect x={bx+17} y={314} width={5} height={6} fill="#7A6344" rx="1"/>
        </g>
      ))}
      <g>
        <rect x={W/2-55} y={H-24} width={10} height={22} fill="#5A6A4A" stroke="#6A7A5A" strokeWidth="1" rx="2"/>
        <rect x={W/2+45} y={H-24} width={10} height={22} fill="#5A6A4A" stroke="#6A7A5A" strokeWidth="1" rx="2"/>
        <path d={`M${W/2-55} ${H-20} Q${W/2} ${H-50} ${W/2+55} ${H-20}`}
          fill="none" stroke="#6A8A5A" strokeWidth="2"/>
        <rect x={W/2-50} y={H-18} width={100} height={16} fill="#1A3010" stroke="#22C55E" strokeWidth="1" rx="2"/>
        <text x={W/2} y={H-7} textAnchor="middle"
          fill="#22C55E" fontSize="7" fontWeight="700" letterSpacing="3" fontFamily="Inter,sans-serif">
          MAIN ENTRANCE
        </text>
      </g>

      {["A","B","C","D"].map((row,i)=>{
        const yPos=[92,162,328,398][i];
        return <text key={row} x={82} y={yPos} textAnchor="middle"
          fill="#8A9E7A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.6">{row}</text>;
      })}

      {booths.map((b)=>(
        <BoothSVG key={b.id} booth={b} selected={selected} onSelect={onSelect}/>
      ))}

      <g transform={`translate(${W-160},${H-26})`}>
        <line x1={0} y1={0} x2={70} y2={0} stroke="#8A8A6A" strokeWidth="1.5"/>
        <line x1={0} y1={-4} x2={0} y2={4} stroke="#8A8A6A" strokeWidth="1.5"/>
        <line x1={70} y1={-4} x2={70} y2={4} stroke="#8A8A6A" strokeWidth="1.5"/>
        <line x1={35} y1={-2} x2={35} y2={2} stroke="#8A8A6A" strokeWidth="1"/>
        <text x={35} y={-6} textAnchor="middle" fill="#8A8A6A" fontSize="7" fontFamily="Inter,sans-serif">100 ft</text>
      </g>
      <g transform={`translate(${W-32},28)`}>
        <circle cx={0} cy={0} r={12} fill="#1A2010" stroke="#4A6A3A" strokeWidth="1"/>
        <text x={0} y={-3} textAnchor="middle" fill="#8AB87A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif">N</text>
        <path d="M0,-9 L3,2 L0,-1 L-3,2 Z" fill="#22C55E" opacity="0.8"/>
      </g>
    </svg>
  );
}

// ─── Mini Map ─────────────────────────────────────────────────────────────────

function MiniMap() {
  const ctx = useWorkspaceCtx();
  const booths = ctx?.booths ?? BOOTHS;
  return (
    <div className="absolute bottom-12 right-3 w-28 h-20 bg-card border border-border rounded-lg overflow-hidden shadow-xl">
      <svg viewBox="0 0 1110 560" className="w-full h-full">
        <rect width="1110" height="560" fill="#344F22"/>
        <rect x="5" y="5" width="1100" height="550" fill="none" stroke="#5A7A4A" strokeWidth="4"/>
        <rect x="82" y="248" width="928" height="55" fill="#B8A882" opacity="0.6"/>
        <rect x="870" y="10" width="38" height="540" fill="#2A2A2E" opacity="0.5"/>
        {booths.map((b)=>(
          <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h}
            fill={STATUS_COLORS[b.status].stroke} opacity="0.75" rx="1"/>
        ))}
        <rect x="12" y="82" width="70" height="230" fill="#3B1D72" opacity="0.5"/>
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center py-0.5 text-[8px] text-muted-foreground bg-card/80 font-mono">
        MINIMAP
      </div>
    </div>
  );
}


// ─── Shared panel components ──────────────────────────────────────────────────

function Section({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2"
        style={{fontFamily:"JetBrains Mono,monospace"}}>{label}</p>
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
function Field({ label, value }: { label:string; value:string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
      <div className="bg-input text-foreground text-[11px] px-2 py-1 rounded border border-border/40">{value}</div>
    </div>
  );
}
function Toggle({ label, icon:Icon, active }: {
  label:string; icon:React.ElementType; active:boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={active?"text-primary":"text-muted-foreground"}/>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className={`w-6 h-3.5 rounded-full transition-colors ${active?"bg-primary":"bg-muted"}`}>
        <div className={`w-2.5 h-2.5 mt-0.5 rounded-full bg-white transition-transform ${active?"translate-x-3":"translate-x-0.5"}`}/>
      </div>
    </div>
  );
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────

function InspectorContent({ booth }: { booth:Booth|null }) {
  if (!booth) return (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-8 h-full">
      <SlidersHorizontal size={28} strokeWidth={1.5}/>
      <p className="text-xs text-center">Select a booth on the map to inspect</p>
    </div>
  );
  const c = STATUS_COLORS[booth.status];
  return (
    <div className="overflow-y-auto" style={{scrollbarWidth:"none"}}>
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Booth {booth.id}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{background:c.fill, color:c.stroke, borderColor:c.stroke+"60"}}>
            {c.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{booth.size} · {booth.category||"Unassigned"}</p>
      </div>
      <Section label="Vendor">
        {booth.vendor ? (
          <><Row label="Business" value={booth.vendor}/><Row label="Category" value={booth.category||"—"}/></>
        ) : (
          <button className="w-full text-xs text-primary border border-dashed border-primary/30 rounded py-2 hover:bg-primary/10 transition-colors">
            + Assign Vendor
          </button>
        )}
      </Section>
      <Section label="Reservation">
        <Row label="Status"  value={c.label} colored={c.stroke}/>
        <Row label="Price"   value={`$${booth.price}`}/>
        <Row label="Payment" value={
          booth.status==="paid"?"Paid in full":
          booth.status==="pending"?"Awaiting payment":"—"
        }/>
      </Section>
      <Section label="Dimensions">
        <div className="grid grid-cols-2 gap-2">
          <Field label="X" value={booth.x.toString()}/>
          <Field label="Y" value={booth.y.toString()}/>
          <Field label="W" value={`${booth.w}′`}/>
          <Field label="H" value={`${booth.h}′`}/>
        </div>
      </Section>
      <Section label="Utilities">
        <Toggle label="Electric" icon={Zap}      active={booth.electric}/>
        <Toggle label="Water"    icon={Droplets}  active={booth.water}/>
        <Toggle label="Corner"   icon={Square}    active={booth.corner}/>
        <Toggle label="Premium"  icon={Star}      active={booth.premium}/>
      </Section>
      <Section label="Notes">
        <textarea className="w-full text-xs bg-input rounded p-2 text-foreground resize-none outline-none border border-border/50 focus:border-primary/50"
          rows={3} placeholder="Add notes…" style={{fontFamily:"Inter,sans-serif"}}/>
      </Section>
      <div className="p-3 flex flex-col gap-1.5">
        <button className="w-full text-xs py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity">
          Open Vendor Record
        </button>
        <button className="w-full text-xs py-2 bg-secondary text-secondary-foreground rounded hover:bg-muted transition-colors">
          Save as Template
        </button>
      </div>
    </div>
  );
}

// ─── Object Library ───────────────────────────────────────────────────────────

function ObjectLibrary() {
  const [open, setOpen] = useState<string[]>(["Booths"]);
  const toggle = (l:string) => setOpen(o=>o.includes(l)?o.filter(x=>x!==l):[...o,l]);
  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{scrollbarWidth:"none"}}>
      <div className="px-3 py-2 sticky top-0 bg-card z-10 border-b border-border">
        <div className="flex items-center gap-2 bg-input rounded px-2 py-1.5">
          <Search size={11} className="text-muted-foreground shrink-0"/>
          <input placeholder="Search objects…"
            className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"/>
        </div>
      </div>
      {OBJ_CATEGORIES.map((cat)=>(
        <div key={cat.label} className="border-b border-border">
          <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors"
            onClick={()=>toggle(cat.label)}>
            <span className="text-[11px] font-medium text-foreground">{cat.label}</span>
            <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open.includes(cat.label)?"":"-rotate-90"}`}/>
          </button>
          {open.includes(cat.label) && (
            <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
              {cat.items.map((item)=>(
                <div key={item}
                  className="flex flex-col items-center gap-1 p-2 rounded bg-secondary/50 hover:bg-secondary border border-border/40 cursor-grab transition-colors active:scale-95"
                  draggable>
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <LayoutGrid size={14} className="text-muted-foreground"/>
                  </div>
                  <span className="text-[9px] text-center text-muted-foreground leading-tight">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Layers Panel ─────────────────────────────────────────────────────────────

function LayersPanel() {
  const [layers, setLayers] = useState(LAYERS_DATA);
  const toggleVis  = (id:string) => setLayers(l=>l.map(x=>x.id===id?{...x,visible:!x.visible}:x));
  const toggleLock = (id:string) => setLayers(l=>l.map(x=>x.id===id?{...x,locked:!x.locked}:x));
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border">
        <span className="text-[11px] font-medium text-foreground">Layers</span>
        <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-secondary">
          <Plus size={12} className="text-muted-foreground"/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>
        {layers.map((layer)=>(
          <div key={layer.id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 group border-b border-border/40">
            <div className="w-2 h-2 rounded-full shrink-0" style={{background:layer.color}}/>
            <span className={`flex-1 text-[11px] ${layer.visible?"text-foreground":"text-muted-foreground line-through"}`}>
              {layer.label}
            </span>
            <button onClick={()=>toggleVis(layer.id)} className="opacity-0 group-hover:opacity-100 p-1">
              {layer.visible?<Eye size={12} className="text-muted-foreground"/>:<EyeOff size={12} className="text-muted-foreground"/>}
            </button>
            <button onClick={()=>toggleLock(layer.id)} className="opacity-0 group-hover:opacity-100 p-1">
              {layer.locked?<Lock size={12} className="text-muted-foreground"/>:<Unlock size={12} className="text-muted-foreground"/>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Legend ────────────────────────────────────────────────────────────

function Legend() {
  const counts: Record<BoothStatus,number> = {
    available:0, reserved:0, paid:0, pending:0, sponsor:0, unavailable:0,
  };
  BOOTHS.forEach(b=>counts[b.status]++);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {(Object.entries(STATUS_COLORS) as [BoothStatus, typeof STATUS_COLORS[BoothStatus]][]).map(([st,c])=>(
        <div key={st} className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm border" style={{background:c.fill, borderColor:c.stroke}}/>
          <span className="text-[10px] text-muted-foreground capitalize">
            {c.label} <span className="text-foreground/60">{counts[st]}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Bottom Sheet (mobile) ────────────────────────────────────────────────────

function BottomSheet({
  open, title, onClose, children, peek = false,
}: {
  open: boolean; title: string; onClose: ()=>void;
  children: React.ReactNode; peek?: boolean;
}) {
  return (
    <>
      {open && !peek && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose}/>
      )}
      <div className={`
        fixed bottom-0 left-0 right-0 z-40 md:hidden
        bg-card border-t border-border rounded-t-2xl shadow-2xl
        transition-transform duration-300 ease-out
        ${open ? "translate-y-0" : "translate-y-full"}
      `} style={{maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
        {/* Handle */}
        <div className="flex flex-col items-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30"/>
          <div className="flex items-center justify-between w-full px-4 pt-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary">
              <X size={14} className="text-muted-foreground"/>
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>
          {children}
        </div>
      </div>
    </>
  );
}

// ─── Mobile Bottom Dock ───────────────────────────────────────────────────────

function MobileDock({
  activeTool, setActiveTool, onOpenSheet, mode, setMode,
}: {
  activeTool: Tool;
  setActiveTool: (t:Tool)=>void;
  onOpenSheet: (s:Sheet)=>void;
  mode: Mode;
  setMode: (m:Mode)=>void;
}) {
  const primaryTools: { id:Tool; icon:React.ElementType; label:string }[] = [
    { id:"select",  icon:MousePointer2, label:"Select" },
    { id:"pan",     icon:Hand,          label:"Pan"    },
    { id:"booth",   icon:LayoutGrid,    label:"Booth"  },
    { id:"measure", icon:Ruler,         label:"Measure"},
    { id:"ai",      icon:Wand2,         label:"AI"     },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border">
      {/* Mode strip */}
      <div className="flex justify-center gap-1 px-4 pt-2">
        {(["design","reservations","operations"] as Mode[]).map((m)=>(
          <button key={m} onClick={()=>setMode(m)}
            className={`flex-1 py-1 rounded text-[10px] capitalize font-medium transition-colors ${
              mode===m?"bg-primary/20 text-primary":"text-muted-foreground"
            }`}>{m}</button>
        ))}
      </div>
      {/* Tool row */}
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {primaryTools.map((t)=>(
          <button key={t.id} onClick={()=>setActiveTool(t.id)}
            className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl transition-colors ${
              activeTool===t.id?"bg-primary/15 text-primary":"text-muted-foreground"
            }`}>
            <t.icon size={20} strokeWidth={1.5}/>
            <span className="text-[9px]">{t.label}</span>
          </button>
        ))}
        <div className="w-px h-8 bg-border mx-1"/>
        <button onClick={()=>onOpenSheet("objects")}
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors">
          <Package size={20} strokeWidth={1.5}/>
          <span className="text-[9px]">Objects</span>
        </button>
        <button onClick={()=>onOpenSheet("layers")}
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors">
          <Layers3 size={20} strokeWidth={1.5}/>
          <span className="text-[9px]">Layers</span>
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function WorkspaceApp() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const [activeTool, setActiveTool]     = useState<Tool>("select");
  const [activeTab, setActiveTab]       = useState("objects");
  const [selectedId, setSelectedId]     = useState<string|null>(null);
  const [zoom, setZoom]                 = useState(100);
  const [showGrid, setShowGrid]         = useState(true);
  const [snapEnabled, setSnapEnabled]   = useState(true);
  const [mode, setMode]                 = useState<Mode>("design");
  const [showMiniMap, setShowMiniMap]   = useState(true);
  const [leftOpen, setLeftOpen]         = useState(true);
  const [rightOpen, setRightOpen]       = useState(true);
  const [sheet, setSheet]               = useState<Sheet>(null);

  const selectedBooth = BOOTHS.find(b=>b.id===selectedId)??null;

  // On mobile: auto-open inspector sheet when booth is selected
  const handleSelect = (id: string|null) => {
    setSelectedId(id);
    if (id && isMobile) setSheet("inspector");
  };

  const closeSheet = () => {
    setSheet(null);
    if (sheet === "inspector") setSelectedId(null);
  };

  return (
    <div className="flex flex-col w-screen bg-background text-foreground overflow-hidden select-none"
      style={{fontFamily:"Inter,sans-serif",fontSize:13,height:"100dvh"}}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header className="h-11 flex items-center gap-0 border-b border-border bg-card shrink-0 px-3 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-3 border-r border-border mr-3 shrink-0">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center shrink-0">
            <Layers3 size={12} className="text-white"/>
          </div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap hidden sm:inline">EventScape</span>
        </div>

        {/* Venue breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2 sm:mr-3 min-w-0 overflow-hidden">
          <span className="hidden sm:inline shrink-0">Riverside Fairgrounds</span>
          <ChevronRight size={12} className="hidden sm:inline shrink-0"/>
          <span className="text-foreground font-medium truncate">Summer Market 2025</span>
        </div>

        {/* Mode toggle — hidden on mobile (shown in dock) */}
        <div className="hidden md:flex items-center gap-0.5 bg-secondary rounded p-0.5 mr-4 shrink-0">
          {(["design","reservations","operations"] as Mode[]).map((m)=>(
            <button key={m} onClick={()=>setMode(m)}
              className={`px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${
                mode===m?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"
              }`}>{m}</button>
          ))}
        </div>

        {/* Undo/Redo — hidden on mobile */}
        <div className="hidden md:flex items-center gap-0.5 mr-3 shrink-0">
          <TBtn icon={Undo2} label="Undo"/>
          <TBtn icon={Redo2} label="Redo"/>
        </div>

        <div className="flex-1"/>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Search — compact on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 bg-input rounded px-2.5 py-1 mr-2">
            <Search size={11} className="text-muted-foreground"/>
            <span className="text-[11px] text-muted-foreground">Search or ⌘K</span>
          </div>
          <button className="sm:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground">
            <Search size={16}/>
          </button>
          <TBtn icon={Bell}     label="Notifications"/>
          <TBtn icon={Sparkles} label="AI" accent/>
          <button className="hidden sm:flex items-center gap-1.5 text-[11px] bg-secondary border border-border text-foreground px-2.5 py-1.5 rounded hover:bg-muted transition-colors shrink-0">
            <Save size={11}/> Save
          </button>
          <button className="flex items-center gap-1.5 text-[11px] bg-primary text-primary-foreground px-2.5 py-1.5 rounded hover:opacity-90 transition-opacity shrink-0">
            <Play size={11}/>
            <span className="hidden sm:inline">Publish</span>
          </button>
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center ml-1 shrink-0">
            <span className="text-[10px] font-semibold text-primary">JK</span>
          </div>
        </div>
      </header>

      {/* ══ WORKSPACE BODY ═══════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT TOOLBAR (hidden on mobile) ── */}
        <div className="hidden md:flex w-11 flex-col items-center py-2 gap-0.5 bg-card border-r border-border shrink-0 overflow-y-auto z-20"
          style={{scrollbarWidth:"none"}}>
          {LEFT_TOOLS.map((t,i)=>{
            const divider = i===2||i===6||i===13;
            return (
              <div key={t.id} className="flex flex-col items-center w-full">
                {divider && <div className="w-6 h-px bg-border my-1"/>}
                <button title={`${t.label}${t.shortcut?` (${t.shortcut})`:""}`}
                  onClick={()=>setActiveTool(t.id)}
                  className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    activeTool===t.id
                      ?"bg-primary/20 text-primary"
                      :"text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}>
                  <t.icon size={15} strokeWidth={1.5}/>
                </button>
              </div>
            );
          })}
        </div>

        {/* ── LEFT SIDEBAR (hidden on mobile, collapsible on tablet) ── */}
        {(isDesktop || (isTablet && leftOpen)) && (
          <div className="w-56 flex flex-col bg-card border-r border-border shrink-0 z-20 hidden md:flex">
            <div className="flex overflow-x-auto border-b border-border" style={{scrollbarWidth:"none"}}>
              {LEFT_TABS.map((tab)=>(
                <button key={tab.id} title={tab.label} onClick={()=>setActiveTab(tab.id)}
                  className={`flex items-center justify-center shrink-0 w-10 h-9 transition-colors ${
                    activeTab===tab.id
                      ?"text-primary border-b-2 border-primary"
                      :"text-muted-foreground hover:text-foreground"
                  }`}>
                  <tab.icon size={14} strokeWidth={1.5}/>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab==="objects" && <ObjectLibrary/>}
              {activeTab==="layers"  && <LayersPanel/>}
              {activeTab!=="objects" && activeTab!=="layers" && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4">
                  <Package size={24} strokeWidth={1.5}/>
                  <p className="text-xs text-center capitalize">
                    {LEFT_TABS.find(t=>t.id===activeTab)?.label} panel
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CENTER CANVAS ── */}
        <div className="flex-1 relative overflow-hidden bg-[#111113] min-w-0">

          {/* Ruler (desktop/tablet only) */}
          <div className="hidden md:flex absolute top-0 left-0 right-0 h-5 bg-card border-b border-border z-10 items-center px-2">
            <div className="flex-1 h-px"
              style={{backgroundImage:"repeating-linear-gradient(90deg,#2E2E34 0,#2E2E34 1px,transparent 1px,transparent 20px)"}}/>
          </div>

          {/* Tablet sidebar toggles */}
          {isTablet && (
            <>
              <button onClick={()=>setLeftOpen(v=>!v)}
                className="absolute left-2 top-7 z-20 w-8 h-8 bg-card border border-border rounded flex items-center justify-center shadow-md hover:bg-secondary transition-colors">
                {leftOpen?<PanelLeftClose size={14} className="text-muted-foreground"/>:<PanelLeftOpen size={14} className="text-muted-foreground"/>}
              </button>
              <button onClick={()=>setRightOpen(v=>!v)}
                className="absolute right-2 top-7 z-20 w-8 h-8 bg-card border border-border rounded flex items-center justify-center shadow-md hover:bg-secondary transition-colors">
                {rightOpen?<PanelRightClose size={14} className="text-muted-foreground"/>:<PanelRightOpen size={14} className="text-muted-foreground"/>}
              </button>
            </>
          )}

          {/* Floating context toolbar when selected (desktop/tablet) */}
          {selectedId && !isMobile && (
            <div className="absolute top-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1">
              {[AlignLeft, MoreHorizontal, Lock, Eye, X].map((Icon,i)=>(
                <button key={i} onClick={i===4?()=>setSelectedId(null):undefined}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                  <Icon size={13}/>
                </button>
              ))}
            </div>
          )}

          {/* Canvas */}
          <div className="absolute inset-0 md:pt-5 flex items-center justify-center">
            <div className="w-full h-full p-3 md:p-6">
              <VenueCanvas
                booths={BOOTHS} selected={selectedId} onSelect={handleSelect}
                showGrid={showGrid}/>
            </div>
          </div>

          {/* Legend overlay */}
          <div className="absolute bottom-14 md:bottom-10 left-3 z-10 bg-card/85 backdrop-blur-sm border border-border/50 rounded px-2.5 py-1.5">
            <Legend/>
          </div>

          {/* Zoom controls (floating on mobile) */}
          {isMobile && (
            <div className="absolute bottom-14 right-3 z-10 flex flex-col gap-1">
              <button onClick={()=>setZoom(z=>Math.min(400,z+25))}
                className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-transform">
                <ZoomIn size={18} className="text-foreground"/>
              </button>
              <button onClick={()=>setZoom(z=>Math.max(25,z-25))}
                className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-transform">
                <ZoomOut size={18} className="text-foreground"/>
              </button>
            </div>
          )}

          {/* Minimap (hide on mobile) */}
          {showMiniMap && !isMobile && <MiniMap/>}
        </div>

        {/* ── RIGHT INSPECTOR (hidden on mobile, collapsible on tablet) ── */}
        {!isMobile && (isDesktop || (isTablet && rightOpen)) && (
          <div className="w-56 flex flex-col bg-card border-l border-border shrink-0 z-20 hidden md:flex">
            <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
              <span className="text-[11px] font-semibold text-foreground">Inspector</span>
              <SlidersHorizontal size={13} className="text-muted-foreground"/>
            </div>
            <InspectorContent booth={selectedBooth}/>
          </div>
        )}
      </div>

      {/* ══ BOTTOM STATUS BAR (hidden on mobile) ═════════════════════════════ */}
      <footer className="hidden md:flex h-7 items-center gap-4 px-3 bg-card border-t border-border shrink-0 z-20">
        <div className="flex items-center gap-1">
          <button onClick={()=>setZoom(z=>Math.max(25,z-10))} className="hover:text-foreground text-muted-foreground">
            <ZoomOut size={12}/>
          </button>
          <span className="text-[10px] text-muted-foreground w-10 text-center"
            style={{fontFamily:"JetBrains Mono,monospace"}}>{zoom}%</span>
          <button onClick={()=>setZoom(z=>Math.min(400,z+10))} className="hover:text-foreground text-muted-foreground">
            <ZoomIn size={12}/>
          </button>
        </div>
        <div className="w-px h-3 bg-border"/>
        <span className="text-[10px] text-muted-foreground" style={{fontFamily:"JetBrains Mono,monospace"}}>
          x: 482  y: 264
        </span>
        <div className="w-px h-3 bg-border"/>
        <SToggle label="Grid" active={showGrid}  onClick={()=>setShowGrid(v=>!v)}  icon={Grid3x3}/>
        <SToggle label="Snap" active={snapEnabled} onClick={()=>setSnapEnabled(v=>!v)} icon={Magnet}/>
        <div className="w-px h-3 bg-border"/>
        <span className="text-[10px] text-muted-foreground">ft</span>
        {selectedId
          ? <span className="text-[10px] text-primary">1 object selected</span>
          : <span className="text-[10px] text-muted-foreground">{BOOTHS.length} booths</span>
        }
        <div className="flex-1"/>
        <SToggle label="Map" active={showMiniMap} onClick={()=>setShowMiniMap(v=>!v)} icon={Map}/>
        <div className="flex items-center gap-1">
          <Activity size={11} className="text-green-500"/>
          <span className="text-[10px] text-muted-foreground">AI Ready</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"/>
          <span className="text-[10px] text-muted-foreground">Saved</span>
        </div>
      </footer>

      {/* ══ MOBILE BOTTOM DOCK ════════════════════════════════════════════════ */}
      <MobileDock
        activeTool={activeTool} setActiveTool={setActiveTool}
        onOpenSheet={setSheet} mode={mode} setMode={setMode}/>

      {/* ══ MOBILE BOTTOM SHEETS ══════════════════════════════════════════════ */}
      <BottomSheet open={sheet==="objects"} title="Object Library" onClose={closeSheet}>
        <ObjectLibrary/>
      </BottomSheet>

      <BottomSheet open={sheet==="layers"} title="Layers" onClose={closeSheet}>
        <LayersPanel/>
      </BottomSheet>

      <BottomSheet open={sheet==="inspector"} title={selectedBooth?`Booth ${selectedBooth.id}`:"Inspector"} onClose={closeSheet}>
        <InspectorContent booth={selectedBooth}/>
      </BottomSheet>
    </div>
  );
}

// ─── Utility Button Components ────────────────────────────────────────────────

function TBtn({ icon:Icon, label, accent }: {
  icon:React.ElementType; label:string; accent?:boolean;
}) {
  return (
    <button title={label}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        accent
          ?"text-primary hover:bg-primary/10"
          :"text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}>
      <Icon size={14} strokeWidth={1.5}/>
    </button>
  );
}

function SToggle({ label, active, onClick, icon:Icon }: {
  label:string; active:boolean; onClick:()=>void; icon:React.ElementType;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 text-[10px] transition-colors ${
        active?"text-primary":"text-muted-foreground hover:text-foreground"
      }`}>
      <Icon size={11}/>{label}
    </button>
  );
}
