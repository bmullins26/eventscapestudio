
## Goal

Replace the current map/Leaflet-based venue designer with a fresh, grid-based **Layout Designer** for venues. Keep the URL (`/studio/venues/$venueId/designer`) but rebuild every UI, interaction, and data flow. Reverse-engineer the interaction model from Marketspread's Layout Designer, with an original visual design and code.

## Interaction model (target UX, original implementation)

- **Infinite grid canvas** drawn to scale — small square = 5 ft × 5 ft; major grid every 10 ft.
- **Pan**: hold Space (or Alt/Option) + drag; **Zoom**: wheel / trackpad pinch, with cursor-anchored zoom; on-screen zoom % + fit-to-content button.
- **Click-to-place from toolbar**: clicking a toolbar tool (e.g. Booth) drops one element at canvas center-ish (with slight offset per click, like Marketspread). Selecting the Select tool cancels placement.
- **Selection**: click element → single-select; shift-click adds to selection; drag on empty canvas → marquee. Selected elements show 8 resize handles + a rotation handle on a leader line.
- **Move**: drag body. Arrow keys nudge 1 grid unit; Shift+Arrow nudges 5 units. Hold Ctrl for 1 px.
- **Resize**: drag handles; Shift preserves aspect. Corner values update the inspector live.
- **Rotate**: drag rotation handle; Shift snaps to 15°/45°.
- **Duplicate/Delete/Copy/Paste/Undo/Redo**: standard shortcuts (Cmd/Ctrl+D, Del, Cmd+C/V, Cmd+Z, Cmd+Shift+Z).
- **Right-click context menu**: bring to front, send to back, forward/backward one, duplicate, lock, hide, delete.
- **Object Explorer (left panel)**: flat list of every element with name, visibility toggle, lock toggle, and a "center on canvas" button; reorder = z-order.
- **Inspector (right panel)**: element-specific fields when one item is selected; global layout settings when nothing is selected (name, add tax, render assignment names, redact, hide unassigned IDs).
- **Booths are first-class**: metadata (id/label, width × depth in ft, price, amenities, orientation, fill, outline, outline width, outline style, outline radius, font size/weight).
- **Other elements**: rectangle, circle, triangle, straight line, polyline path, freehand path, text label, and an icon set (tree, building, restroom, stage, food, parking, entrance, first aid, ATM, info, arrow).
- **Auto-save + local undo/redo stack** (in-memory, at least 50 steps). Save & close returns to venues list.

## Deletions

Delete every current venue-designer file:

- `src/components/venue-designer/` (whole directory)
  - `bottom-drawer.tsx`, `client-map-canvas.tsx`, `floating-tools.tsx`, `floating-topbar.tsx`, `floating-zoom.tsx`, `map-canvas.tsx`, `map-search.tsx`, `menu-bar.tsx`, `object-catalog.ts`, `panels.tsx`, `properties-card.tsx`, `side-sheet.tsx`, `tool-strip.tsx`
- `src/routes/_authenticated/studio.venues.$venueId.designer.tsx` — replaced with a new skeleton.
- `src/lib/venue-designer.functions.ts` — replaced with a new file exposing only the server fns the new UI calls.

Also drop the map-related deps from usage (no removal from package.json required — unused code is tree-shaken; leaving react-leaflet/leaflet installed is fine and avoids touching the lockfile in the same turn).

## New file structure

```text
src/components/venue-designer/
  designer-shell.tsx        // top bar + left panel + canvas + right panel layout
  canvas/
    grid-canvas.tsx         // SVG canvas, viewport (pan/zoom), grid, marquee
    element-node.tsx        // renders one element (booth/shape/icon/text)
    selection-frame.tsx     // 8 resize handles + rotation handle
    use-viewport.ts         // pan/zoom state, screen<->canvas math
    use-pointer-tools.ts    // click-place, drag-move, marquee, resize, rotate
    use-keyboard.ts         // shortcuts: nudge, del, copy/paste, undo/redo
  panels/
    toolbar.tsx             // top toolbar: tools + undo/redo + save + name
    object-explorer.tsx     // left: element list w/ lock/hide/center
    inspector.tsx           // right: global or per-element props
    inspector-booth.tsx
    inspector-shape.tsx
    inspector-text.tsx
    inspector-icon.tsx
  state/
    types.ts                // Element, Booth, Shape, Icon, TextEl, Layout
    store.ts                // Zustand store: elements, selection, history, dirty
    history.ts              // undo/redo stack helper
    catalog.ts              // available icons + default element factories
  icons/                    // small SVG components for the icon set
```

Route: `src/routes/_authenticated/studio.venues.$venueId.designer.tsx` — thin wrapper that loads the layout, hydrates the store, renders `<DesignerShell />`.

Server fns (`src/lib/venue-designer.functions.ts`):
- `getVenueLayout({ venueId })` — returns `{ venue, layout: { name, elements, settings } }` (elements = JSON blob).
- `saveVenueLayout({ venueId, name, settings, elements })` — protected by `requireSupabaseAuth`; upserts one row in `venue_layouts`.

## Data model

Reuse the existing `venue_layouts` table if present; otherwise a new migration:

```sql
create table if not exists public.venue_layouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null default 'Untitled layout',
  settings jsonb not null default '{}'::jsonb,
  elements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (venue_id)
);
grant select, insert, update, delete on public.venue_layouts to authenticated;
grant all on public.venue_layouts to service_role;
alter table public.venue_layouts enable row level security;
-- org-membership policy via existing helper
```

(Exact policy wired to the existing `is_org_member` helper; only inserted if the table doesn't already exist.)

`Element` union in TS:
```text
Booth   { id, kind: 'booth',   x, y, w, h, rotation, label, price, amenities[], style{ fill, stroke, strokeWidth, strokeStyle, radius, fontSize, fontWeight } }
Shape   { id, kind: 'rect'|'circle'|'triangle'|'line'|'path', ... geometry, style }
Text    { id, kind: 'text',   x, y, text, fontSize, fontWeight, color, rotation }
Icon    { id, kind: 'icon',   x, y, w, h, rotation, iconKey, tint }
Common: locked?: boolean, hidden?: boolean, z: number
```

## Rendering & math

- One SVG canvas, `viewBox` fixed, elements drawn in world coords.
- Viewport is a `{ x, y, scale }` transform on the outer `<g>`; wheel zoom anchors on cursor position.
- 1 world unit = 1 foot; grid drawn with two `<pattern>`s (5 ft minor, 10 ft major).
- Screen↔world conversion helpers in `use-viewport.ts`.
- Selection handles rendered in screen space (constant pixel size regardless of zoom) using an inverse-scale group.

## Save flow

- Zustand store tracks a `dirty` flag.
- Debounced auto-save (~1.2 s idle) calls `saveVenueLayout`.
- Explicit "Save & Close" button in the toolbar.
- Undo/redo local only.

## Out of scope (for this turn)

- Publishing versions, presenting mode, sharing, AI import, and Mapbox-style basemap — all removed with the old designer. They can be reintroduced later on top of the new foundation if the user wants.
- Vendor assignment UI beyond a booth-inspector "price/label" surface. Assignment flow already lives elsewhere in the app.

## Verification

- `bun run build` (auto-run) passes.
- Load `/studio/venues/<any>/designer`: canvas renders, tools place elements, selection/move/resize/rotate/undo/redo work, save writes to the DB, reload restores the layout.

