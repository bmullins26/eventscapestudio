# Remove primitives + editable names on every object

## 1. Purge primitive tools/shapes end-to-end

Currently primitive shapes (`rect`, `circle`, `triangle`, `line`) still live in the type union and factory, and the semantic presets (Road/Walkway/Building/Parking/Measure/Table/Chair/Fence) internally create `rect`/`line` shapes. Result: users can still end up with generic shapes. We remove them cleanly and go icon/preset-only.

- `types.ts` — drop `rect | circle | triangle | line` from `ElementKind`, delete `ShapeElement`, narrow `AnyElement` to `BoothElement | TextElement | IconElement`.
- `factory.ts` — delete `makeShape`; rebuild `makePreset` so every preset returns an `IconElement` (or a `BoothElement` for the "Table" preset if we want the labelable behavior). Realistic icons: Road/Walkway/Building/Parking/Table/Chair/Fence/Measure all map to existing `IconKey`s (`road`, `building`, `parking`, `table`, `chair`, `fence`, plus we add `walkway` and `measure` icons — simple line/dashed glyphs) so they render as scaled realistic glyphs, not filled rectangles.
- `canvas.tsx` — narrow `CanvasTool` union, remove all `rect|circle|triangle|line` branches in hit-test, render, drag-create, and resize code paths. Any legacy saved element whose `kind` is one of the primitives is filtered out at load time with a one-time console warning (kept simple; matches user intent to "get rid of").
- `designer.tsx` — `installFactory` already skips primitives; no toolbar buttons for them (already removed). Keyboard shortcuts `R/C/L` remain unbound.
- `object-explorer.tsx` / `inspector.tsx` — remove any UI branches that reference the removed kinds.

## 2. Every object has an editable, on-canvas label

Booths already render `label`. Icons and text don't. We unify around a single `name` field that's:
- Editable in the Inspector (single "Name" input for all kinds).
- Editable directly on the canvas via double-click (opens an inline `contentEditable`/`<input>` overlay positioned at the element).
- Rendered under (or on, for booths) the element with auto-fitting text.

Details:

- **Types** — keep `BaseElement.name?: string`. For `BoothElement`, `label` stays as the "booth number" (unique id shown big); add `name?` (already inherited) for the human name ("Kate's Pretzels"). Icons and text elements use `name` as the display label.
- **Auto-fit label rendering** (`canvas.tsx`):
  - New helper `<ElementLabel>` that renders an SVG `<text>` centered under the element bbox, with `textLength` + `lengthAdjust="spacingAndGlyphs"` capped by the element width so long names shrink to fit; wraps to 2 lines via `<tspan>` when the natural length exceeds width and vertical room allows.
  - Booths: keep the big centered `label` (booth number). If `name` is set, render it as a smaller second line inside the booth (or below if the booth is too small — threshold on `w*scale`).
  - Icons: render `name` in a chip below the glyph (background pill using `--card` token so it stays legible on satellite/map backgrounds). Auto-hide when zoomed out below a threshold to reduce clutter.
  - Text elements: unchanged (the element IS the label); Inspector "Name" edits `text` for these to keep one control.
- **Inline rename**:
  - Double-click an element on the canvas → overlay HTML `<input>` positioned over the label area, autofocused, Enter/blur commits via `actions.update(id, { name })` (or `{ label }` for booth number if double-click hits the number area — simplest: always edit `name`, booth number stays editable in inspector).
  - Escape cancels.
- **Inspector**:
  - Add a top "Name" field visible for all kinds (`booth`, `icon`, `text`). For booths, also keep the existing "Booth #" (`label`) and "Price" fields.
  - Multi-select: name field disabled with placeholder "Multiple selected".
- **Defaults on create**: `makeBooth` no longer sets `name`; the auto-incremented number stays in `label`. `makeIcon` sets `name` to the icon's human label (e.g. "Food truck") so a newly placed food truck immediately reads "Food truck" under it. `makePreset` sets `name` from `PRESETS[kind].name` ("Road", "Table", etc.). User can then rename each independently — placing 5 food trucks and renaming to "Kate's Pretzels", "Ben's BBQ", etc. works as expected.
- **Object Explorer** — row label already uses `describe(el)`; update `describe` to prefer `name` over kind fallbacks so renames show immediately in the layer list.

## 3. Files touched

- `src/components/venue-designer/types.ts`
- `src/components/venue-designer/factory.ts`
- `src/components/venue-designer/canvas.tsx` (label rendering, inline rename overlay, narrow `CanvasTool`, drop shape render/hit/resize branches)
- `src/components/venue-designer/inspector.tsx` (unified Name field, drop shape-only sections)
- `src/components/venue-designer/object-explorer.tsx` (describe prefers `name`)
- `src/components/venue-designer-v2/designer.tsx` (filter out legacy primitive kinds on hydrate; keyboard `F2` to rename selection)

## Out of scope

- Rich text formatting on labels (bold/italic per-element beyond existing text-element controls).
- Per-element label font-family override — inherits designer font.
- Migration of legacy `rect/circle/triangle/line` elements into icons (they're dropped, not converted). Say the word if you want auto-conversion instead of drop.
