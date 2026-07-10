export type ElementKind =
  | "booth"
  | "rect"
  | "circle"
  | "triangle"
  | "line"
  | "text"
  | "icon";

export type IconKey =
  | "tree"
  | "building"
  | "restroom"
  | "stage"
  | "food"
  | "parking"
  | "entrance"
  | "first_aid"
  | "atm"
  | "info"
  | "arrow";

export interface BaseElement {
  id: string;
  kind: ElementKind;
  /** Top-left x in world units (feet). */
  x: number;
  y: number;
  /** For sized elements. */
  w: number;
  h: number;
  rotation: number; // degrees
  locked?: boolean;
  hidden?: boolean;
  name?: string;
}

export interface BoothElement extends BaseElement {
  kind: "booth";
  label: string;
  price?: number | null;
  amenities?: string[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed";
  radius: number;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
}

export interface ShapeElement extends BaseElement {
  kind: "rect" | "circle" | "triangle" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed";
}

export interface TextElement extends BaseElement {
  kind: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
}

export interface IconElement extends BaseElement {
  kind: "icon";
  iconKey: IconKey;
  tint: string;
}

export type AnyElement = BoothElement | ShapeElement | TextElement | IconElement;

export interface LayoutSettings {
  addTax?: boolean;
  renderAssignments?: boolean;
  redactAssignments?: boolean;
  hideUnassignedIds?: boolean;
}

export interface Layout {
  name: string;
  settings: LayoutSettings;
  elements: AnyElement[];
}
