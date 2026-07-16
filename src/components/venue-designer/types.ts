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
  | "arrow"
  | "booth_canopy"
  | "table"
  | "chair"
  | "fence"
  | "road";

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

export interface BackgroundLayer {
  /**
   * "image" - a raster/PDF uploaded to venue-assets (has `url`).
   * "satellite" - legacy static satellite PNG (has `url`).
   * "google-satellite" - live Google Maps JS satellite tile, rendered client-side.
   *   No `url`; positioning uses lat/lng/zoom from `meta`.
   */
  kind: "satellite" | "image" | "google-satellite";
  /** Image URL (empty string for "google-satellite"). */
  url: string;
  /** World-space placement in feet. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number; // 0..1
  locked: boolean;
  calibrated?: boolean;
  hidden?: boolean;
  attribution?: string;
  meta?: { lat?: number; lng?: number; zoom?: number; address?: string; mapPixelSize?: number };
  /**
   * Optional crop, expressed in fractions (0..1) of the background's own
   * un-rotated {w,h} box. Applied as a visual clip; the underlying image/
   * tiles are not modified. Defaults to full extent when absent.
   */
  crop?: { x: number; y: number; w: number; h: number } | null;
}

export interface LayoutSettings {
  addTax?: boolean;
  renderAssignments?: boolean;
  redactAssignments?: boolean;
  hideUnassignedIds?: boolean;
  background?: BackgroundLayer | null;
}

export interface Layout {
  name: string;
  settings: LayoutSettings;
  elements: AnyElement[];
}
