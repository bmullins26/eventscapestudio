export type ElementKind =
  | "booth"
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
  | "road"
  | "walkway"
  | "measure";

export interface BaseElement {
  id: string;
  /**
   * Stable UUID that survives label changes, renumbering, and copy/paste
   * within the same layout. This is what event snapshots key `event_booths`
   * rows against (`event_object_id`). Backfilled on layout load for
   * legacy elements missing it.
   */
  objectId: string;
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
  /** Human-readable label rendered under/on the element. Editable in-place. */
  name?: string;
  /** Optional label color (hex). Falls back to theme foreground. */
  labelColor?: string;
  /**
   * Free-form per-kind metadata. Used by schema-driven inspector fields for
   * non-core object kinds (road/parking/building/tree/fence/stage/…).
   * Booth uses its own typed fields below; new kinds should prefer `meta`.
   */
  meta?: Record<string, unknown>;
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
  /** Vendor category, e.g. "Food", "Crafts". Drives clustering intelligence. */
  category?: string | null;
  /** Booth traits — surface as badges + drive intelligence rules. */
  isPremium?: boolean;
  isCorner?: boolean;
  isElectric?: boolean;
  isWater?: boolean;
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

export type AnyElement = BoothElement | TextElement | IconElement;

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
