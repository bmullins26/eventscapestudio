## Fix "Invalid enum value" error

The zod validator on the server rejects object types (e.g. `generator`, `electrical`, `water`, `hydrant`, `dumpster`, `food_truck`, `trailer`, `picnic_area`, `tent`, `security`, `playground`, `gate`, `bush`, `arrow`, `measurement`, `chair`) that exist in the catalog but not in the `venue_object_type` Postgres enum. Widen the enum so the catalog and DB stay in sync.

**Migration:** `ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS '...'` for every catalog type missing from the enum. After types regenerate, `createVenueObject`'s zod schema (derived from the Supabase enum) will accept all catalog types.

## Drag-and-drop object placement

Replace the current "click tile → click canvas" flow with real HTML5 drag-and-drop, while keeping click-to-arm as a fallback (nothing removed).

**`ObjectLibrary` (panels.tsx)** — make each catalog tile and each "My Library" tile `draggable`. On `dragstart`, set:
- `dataTransfer.setData("application/x-vd-object", JSON.stringify({ kind: "catalog", type }))` for catalog tiles
- `dataTransfer.setData("application/x-vd-object", JSON.stringify({ kind: "library", id }))` for library tiles
- Set a small drag preview (a canvas element mirroring the tile swatch).

**`MapCanvas` (map-canvas.tsx)** — on the Leaflet container:
- `onDragOver`: `e.preventDefault()` so drop is allowed and set `dropEffect = "copy"`.
- `onDrop`: read the payload, use the existing `svgToCanvas(clientX, clientY)` to get canvas coords, and invoke a new prop `onCanvasDrop({ payload, point })`.

**Designer route** — implement `handleCanvasDrop`:
- If payload is `catalog`, run the same `placeMutation` path used by `handleCanvasClick`'s type branch.
- If payload is `library`, run the library-item branch.
- No arming required, tool stays as-is, and selection jumps to the new object.

Keyboard/keyboard-users still get the click-to-arm placement flow untouched.

## Files touched

- `supabase/migrations/<new>.sql` — widen `venue_object_type` enum.
- `src/components/venue-designer/panels.tsx` — add `draggable` + `onDragStart` handlers to library tiles.
- `src/components/venue-designer/map-canvas.tsx` — add `onDragOver`/`onDrop` on the map wrapper; expose `onCanvasDrop` prop.
- `src/components/venue-designer/client-map-canvas.tsx` — thread the new prop through.
- `src/routes/_authenticated/studio.venues.$venueId.designer.tsx` — implement `handleCanvasDrop`, pass to `ClientMapCanvas`.

## Verification

- Drag "Generator" from the library to the map → object appears at the drop point, no zod error in the network response.
- Drag "Booth" → placed and selected.
- Drag a "My Library" tile → placed with saved geometry/style.
- Existing click-to-arm placement still works.

## Out of scope

- Touch-drag / mobile drag (HTML5 drag events don't work on iOS Safari — a later pass can add pointer-based dragging).
- Ghost preview that follows the cursor with real object dimensions.
