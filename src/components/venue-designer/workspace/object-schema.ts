/**
 * Object schema registry.
 *
 * Every workspace object kind (booth, road, fence, building, stage, tree,
 * parking, sign, custom) registers an `ObjectSchema` that declares:
 *   - inspectorFields  → what to render in the Properties tab
 *   - hoverFields      → what to render in the hover card
 *   - badges           → predicates that surface icons inside the object
 *   - derive           → contributes to `deriveObjectState()` (color/status/…)
 *   - intelligenceRules→ Layer-1 (deterministic) Venue Intelligence rules
 *
 * The Context Panel renders from these schemas, so adding a new object
 * kind means "register a schema" — no more `if (kind === "booth")`.
 */
import type { AnyElement, BoothElement, ElementKind } from "../types";

/* ----------------------------- Field types ----------------------------- */

export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "color"
  | "textarea";

interface FieldBase {
  key: string;                 // dot-path into the element ("meta.width")
  label: string;
  help?: string;
  when?: (el: AnyElement) => boolean;
  group?: string;              // optional grouping heading in the panel
}

export interface TextField     extends FieldBase { kind: "text";     placeholder?: string; }
export interface NumberField   extends FieldBase { kind: "number";   step?: number; min?: number; max?: number; unit?: string; }
export interface BooleanField  extends FieldBase { kind: "boolean"; }
export interface SelectField   extends FieldBase { kind: "select";   options: Array<{ value: string; label: string }>; }
export interface ColorField    extends FieldBase { kind: "color"; }
export interface TextareaField extends FieldBase { kind: "textarea"; rows?: number; placeholder?: string; }

export type SchemaField =
  | TextField
  | NumberField
  | BooleanField
  | SelectField
  | ColorField
  | TextareaField;

/* --------------------------- Schema definition ------------------------- */

export interface BadgeDefinition {
  id: string;
  /** Emoji glyph rendered inside the object. */
  glyph: string;
  /** Tooltip / a11y label. */
  label: string;
  /** Whether to render this badge for the given element + optional event state. */
  when: (el: AnyElement) => boolean;
}

export interface HoverField {
  label: string;
  value: (el: AnyElement) => string | number | null | undefined;
}

export interface ObjectSchema {
  kind: ElementKind;
  /** Displayed as the panel header label. */
  displayName: string;
  /** Fields rendered in the Properties tab (top → bottom). */
  inspectorFields: SchemaField[];
  /** Fields rendered in the floating hover card. */
  hoverFields: HoverField[];
  /** Optional badge predicates (empty for now for non-booth kinds). */
  badges?: BadgeDefinition[];
}

/* ------------------------------ Registry ------------------------------- */

const registry = new Map<ElementKind, ObjectSchema>();

export function registerObjectKind(schema: ObjectSchema): void {
  registry.set(schema.kind, schema);
}

export function getObjectSchema(kind: ElementKind): ObjectSchema | null {
  return registry.get(kind) ?? null;
}

export function listObjectSchemas(): ObjectSchema[] {
  return Array.from(registry.values());
}

/* ---------------------------- Built-in schemas ------------------------- */

const boothSchema: ObjectSchema = {
  kind: "booth",
  displayName: "Booth",
  inspectorFields: [
    { key: "label",         kind: "text",   label: "Booth ID / label", group: "Identity" },
    { key: "name",          kind: "text",   label: "Display name",     group: "Identity", placeholder: "e.g. Kate's Pretzels" },
    { key: "category",      kind: "text",   label: "Category",         group: "Identity", placeholder: "Food · Crafts · Retail…" },
    { key: "price",         kind: "number", label: "Price",            group: "Commerce", unit: "$" },
    { key: "isPremium",     kind: "boolean", label: "Premium",         group: "Traits" },
    { key: "isCorner",      kind: "boolean", label: "Corner booth",    group: "Traits" },
    { key: "isElectric",    kind: "boolean", label: "Electric",        group: "Traits" },
    { key: "isWater",       kind: "boolean", label: "Water",           group: "Traits" },
  ],
  hoverFields: [
    { label: "Booth",    value: (el) => (el as BoothElement).label },
    { label: "Category", value: (el) => (el as BoothElement).category ?? "—" },
    { label: "Price",    value: (el) => {
        const p = (el as BoothElement).price;
        return p == null ? "—" : `$${p}`;
    }},
  ],
  badges: [
    { id: "electric", glyph: "⚡", label: "Electric",   when: (el) => (el as BoothElement).isElectric === true },
    { id: "water",    glyph: "💧", label: "Water",      when: (el) => (el as BoothElement).isWater === true },
    { id: "premium",  glyph: "⭐", label: "Premium",    when: (el) => (el as BoothElement).isPremium === true },
  ],
};

const textSchema: ObjectSchema = {
  kind: "text",
  displayName: "Text",
  inspectorFields: [
    { key: "text",  kind: "text",   label: "Text" },
    { key: "color", kind: "color",  label: "Color" },
  ],
  hoverFields: [
    { label: "Text", value: (el) => (el as { text?: string }).text ?? "" },
  ],
};

const iconSchema: ObjectSchema = {
  kind: "icon",
  displayName: "Object",
  inspectorFields: [
    { key: "name", kind: "text",  label: "Name" },
    { key: "tint", kind: "color", label: "Tint" },
  ],
  hoverFields: [
    { label: "Object", value: (el) => el.name ?? el.kind },
  ],
};

registerObjectKind(boothSchema);
registerObjectKind(textSchema);
registerObjectKind(iconSchema);

/* --------------------- Dot-path get / set helpers ---------------------- */

export function getFieldValue(el: AnyElement, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = el;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function setFieldValue(el: AnyElement, path: string, value: unknown): Partial<AnyElement> {
  const parts = path.split(".");
  if (parts.length === 1) {
    return { [parts[0]]: value } as Partial<AnyElement>;
  }
  // Nested — clone the top-level container and mutate the leaf.
  const [head, ...rest] = parts;
  const container = { ...(((el as Record<string, unknown>)[head]) as Record<string, unknown> | undefined ?? {}) };
  let cursor: Record<string, unknown> = container;
  for (let i = 0; i < rest.length - 1; i++) {
    const k = rest[i];
    cursor[k] = { ...((cursor[k] as Record<string, unknown> | undefined) ?? {}) };
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[rest[rest.length - 1]] = value;
  return { [head]: container } as Partial<AnyElement>;
}
