
# Venue Designer → Full Workspace (revised with full canvas & tool spec)

Locked layout (from your sketch):

```text
┌─────────────────────────────────────────────────────────────┐
│ Menu   Venue   Edit   View   Insert   AI   Publish          │
├───────────────┬──────────────────────────────┬──────────────┤
│ Object Library│        HUGE CANVAS           │ Properties   │
├───────────────┴──────────────────────────────┴──────────────┤
│ Layers │ History │ AI │ Assets │ Templates │ Objects        │
└─────────────────────────────────────────────────────────────┘
```

## 1. Shell

- Route escapes `AppShell` with a `fixed inset-0 z-40 bg-background` container so the workspace goes edge-to-edge.
- 3-row grid: `[topbar auto] [main 1fr] [drawer auto]`; main row: `[left 260px] [canvas 1fr] [right 320px]`.
- Every panel/drawer is resizable + collapsible (chevron collapses to a 40px icon rail). Widths, collapsed state, drawer height, and active tab persisted per user in `user_org_prefs.value.venue_designer`.

## 2. Top menu bar

Real dropdown menu bar (shadcn `DropdownMenu`), not a toolbar:

- **Menu** — Back to Venues, Open venue…, Duplicate venue, Import, Export (PNG/PDF/SVG/JSON), Print, Close.
- **Venue** — Rename, Canvas size, Units (ft/m), Background, Reference alignment, Snapshot for event.
- **Edit** — Undo, Redo, Cut, Copy, Paste, Duplicate (⌘D), Delete, Select All, Find, **Group / Ungroup**, **Lock / Unlock**, **Hide / Show**, **Rename**, **Save as asset**.
- **View** — Zoom In/Out/Fit/100%, **Grid**, **Rulers**, **Guides**, **Smart snap**, Minimap, Toggle Left/Right/Bottom panels, **Presentation mode**.
- **Arrange** (new) — Align L/C/R/T/M/B, Distribute H/V, **Bring forward / Send backward / To front / To back**, Flip H/V, Rotate 90°.
- **Insert** — every drawing tool below (mirrored), Reference image/PDF, Text label, Guide line, Measurement, Custom SVG, From org library…
- **AI** — Trace reference, Generate booth grid, Auto-label, Suggest layout, Ask AI (opens AI drawer).
- **Publish** — Publish version, Restore version, Manage versions, Snapshot to event.

Below the menu bar: slim **tool strip** (36px) with the drawing tools + zoom controls + Publish CTA.

## 3. Canvas — full feature set

**Infinite canvas** implemented as an SVG world with a viewport transform (translate + scale) held in the Zustand store. Bounds are effectively unlimited; content is placed in world coordinates.

- **Pan** — hand tool, Space+drag, middle-mouse drag, two-finger trackpad.
- **Zoom** — ⌘+scroll, pinch, tool strip buttons, Fit/100%, focal-point zoom (already partially in `useCanvasInput`).
- **Rotate** — object handle + numeric input; Shift snaps to 15°.
- **Grid** — dotted/lined, size follows units, snap when enabled.
- **Rulers** — top + left, follow zoom + units, hover crosshair readout.
- **Guides** — draggable from rulers, snap targets, per-guide lock, list in Layers→Guides section.
- **Smart snapping** — grid, object edges/centers, guides, reference outlines; live snap indicators.
- **Marquee select** — click-drag on empty canvas; Shift extends, Alt subtracts.
- **Multi-select** — Shift-click; group transform box for the whole selection.
- **Grouping** — ⌘G / ⌘⇧G. Groups stored as `metadata.group_id` on `venue_objects` (no schema change).
- **Alignment / Distribution** — Arrange menu, contextual toolbar, and keyboard shortcuts.
- **Bring forward / Send backward** — z-order stored in existing `venue_objects.z` (or add `z` if missing).
- **Duplicate** — ⌘D (in place) and Alt-drag (offset).
- **Lock / Hide / Rename** — per-object flags on `venue_objects` (already present) and per-layer.
- **Save as asset** — writes selection to `org_object_library` with chosen name + category (already partially wired).
- **Context menus** — right-click on canvas, on objects, on the ruler; long-press on touch.
- **Command palette** — ⌘K (`cmdk`); every action addressable ("place stage 30×20 near north road", "assign vendor Acme to selected booth", "publish v3").
- **Presentation mode** — F5 / View menu; hides chrome, keeps canvas + optional legend.
- **Contextual floating toolbar** above selection: align, distribute, rotate, flip, forward/back, assign vendor, save-to-library, duplicate, delete.
- **Minimap** in bottom-right of canvas; drag to pan.

## 4. Drawing tools

Tool strip + Insert menu expose every tool below. Each armed tool changes cursor + shows a hint bar.

**Primitive tools** (draw freely, produce a `venue_object` with corresponding `shape`):
- Select · Pan · Rectangle · Circle · Polygon · Polyline · Line · Bezier · Text · Arrow · **Measurement Line** (records distance in units into metadata) · **Custom SVG** (paste/upload SVG path; stored on object).

To support Polygon/Polyline/Bezier/Line/Arrow/Custom SVG cleanly, extend `venue_objects.shape` to accept: `rect | circle | polygon | polyline | line | bezier | text | svg`, and store points/path in `geometry` (already `jsonb`). No column changes, only wider union.

**Preset object tools** (armed tool places a preconfigured object; edits allowed after):
- **Vendor & event stalls**: Booth · Sponsor Banner · Food Truck · Trailer · Beer Garden · Food Court · Picnic Area
- **Structures**: Building · Pavilion · Stage · Tent · Restroom · Ticket Booth · Information Booth · Registration · First Aid · Security · ATM · Playground
- **Circulation**: Road · Walkway · Parking · Fence · Gate · Sign · Arrow
- **Utilities**: Generator · Electrical Panel · Water Hookup · Fire Hydrant · Dumpster
- **Landscape / furniture**: Tree · Bush · Bench · Table · Chair

Every preset has: default size, default fill/stroke, default layer, default metadata schema (e.g. Booth → price/electric/water/vendor; Tree → species; Electrical Panel → amps/circuits). Defaults live in one config file `src/components/venue-designer/object-catalog.ts` — single source of truth for the palette, the Insert menu, and the tool strip.

## 5. Left panel — Object Library

Accordion in the order from your sketch: ⭐ Favorites, Booths, Buildings, Roads, Parking, Utilities, Landscaping, Signs, Furniture, Custom.
- Populated from the object catalog + `org_object_library` for Favorites/Custom.
- Search across all categories.
- Click = arm placement; drag = drag-drop onto canvas.
- "Save selection as asset" pinned at the bottom.

## 6. Right panel — Properties inspector

Sections match your sketch, driven by the selected object's catalog entry:

- **Position** (x, y)
- **Size** (w, h, aspect-lock)
- **Rotation**
- **Layer**
- **Metadata** — dynamic fields per object type (e.g. Booth: code, capacity, tags; Stage: capacity; Sign: text; Measurement: shows computed length)
- **Vendor** (for booths) — searchable combobox from event applications
- **Price** · **Electric** (amps) · **Water** (yes/no) — for booths
- **Notes**

Editable inline; every change writes to `venue_objects` via a debounced mutation. Multi-select shows shared fields with mixed-value indicators.

Empty selection → shows Venue-level properties (name, canvas size, units, background, reference alignment).

## 7. Bottom drawer — tabbed workspace

Tabs in your exact order:

1. **Layers** — drag-reorder, color, visibility, lock, opacity slider, solo, object counts; guides live under a "Guides" sublayer.
2. **History** — timeline from a new append-only `venue_history` table (venue_id, actor_user_id, action, target_type, target_id, before jsonb, after jsonb, created_at); click any entry to preview; "Revert to here".
3. **AI** — chat-style prompt + quick actions; proposed changes render as a diff card the user Applies or Discards; powered by Lovable AI via a `runAiVenueCommand` server function using structured output.
4. **Assets** — reference PDFs/images: upload, replace, remove; per-asset opacity, rotation, scale, lock, visibility; drag to canvas.
5. **Templates** — published `venue_templates`: thumbnails, labels, dates, Restore/Delete/Snapshot-to-event; "Publish current design" pinned.
6. **Objects** — flat outline grouped by layer; search, multi-select, inline rename; click to select on canvas.

Drawer height, active tab, collapse state persisted.

## 8. Organization assets (reuse)

- Every object is fully editable in place; nothing is a locked stamp.
- Every object carries metadata via `venue_objects.metadata jsonb` — schemas defined per object type in the catalog.
- **Reuse** — "Save as asset" writes the object (shape, geometry, style, metadata schema) to `org_object_library`. Any org user can drag it back into any venue from Object Library → Favorites/Custom. Editing a library item does NOT retro-update placed copies (placed copies are snapshots); we add an optional `library_item_id` reference on the placed object so we can offer "Update to latest library version" per-selection later.

## 9. Keyboard

Full shortcut map: V select · H pan · R rect · O circle · P polygon · L line · B booth · T text · M measurement · G grid · Shift+G snap · ⌘G / ⌘⇧G group/ungroup · ⌘L lock · ⌘⇧H hide · ⌘D duplicate · ⌫ delete · ⌘Z / ⌘⇧Z undo/redo · ⌘K palette · ⌘S publish version · F5 present · Space+drag pan · 1–6 switch drawer tabs.

## 10. Refactor (mandatory)

Current file is 1262 lines. Split before growing:

```text
src/routes/_authenticated/studio.venues.$venueId.designer.tsx      (thin route)
src/components/venue-designer/
  workspace.tsx                grid shell, resize/collapse, prefs persistence
  menu-bar.tsx                 top menu bar dropdowns
  tool-strip.tsx               drawing tool buttons + zoom + publish
  object-catalog.ts            single source of truth for every tool/preset
  canvas/
    Canvas.tsx                 viewport + world SVG
    SelectionOverlay.tsx       handles, marquee, snap indicators, HUD
    RulersGrid.tsx
    Guides.tsx
    Minimap.tsx
    ContextualToolbar.tsx
    ContextMenu.tsx
  left/ObjectLibrary.tsx
  right/Inspector.tsx          (venue props when empty)
  drawer/
    BottomDrawer.tsx
    tabs/{Layers,History,Ai,Assets,Templates,Objects}Tab.tsx
  command-palette.tsx
  presentation.tsx
  store.ts                     Zustand: tool, selection, viewport, panels, snap flags, guides
  shortcuts.ts
  types.ts
```

## 11. Data + server

Reuse existing tables — no destructive migrations:

- `venue_objects` (widen `shape` union + start using `geometry.points`/`geometry.path`/`geometry.rotation` for new shapes; add optional `library_item_id` and `z` if not present).
- New table `venue_history` for the History tab and cross-session undo.
- New server fns: `alignVenueObjects`, `distributeVenueObjects`, `groupVenueObjects`, `reorderZ`, `assignVendorToBooth`, `listVenueHistory`, `revertVenueTo`, `runAiVenueCommand`.
- Layout prefs on `user_org_prefs.value.venue_designer`.

## 12. Phasing

- **Phase A — Shell + refactor + catalog**: new grid, menu bar, tool strip, all three panels/drawer wired to existing data; object catalog file introduced; nothing lost. Shippable.
- **Phase B — Canvas power-ups**: rulers, grid, guides, smart snap, marquee, multi-select, group, align/distribute, z-order, rotate/resize HUD, contextual toolbar, minimap, context menus, presentation mode, command palette.
- **Phase C — Full tool set + org assets**: Polygon/Polyline/Line/Bezier/Arrow/Text/Measurement/Custom SVG + every preset object with metadata schema; Object Library reflects catalog; Save-as-asset + library placement.
- **Phase D — History + AI + Vendors + Publish polish**: `venue_history` + undo/redo/revert; AI drawer with diff-apply; vendor assign from Inspector and drag from drawer; version thumbnails, snapshot-to-event, export PNG/PDF/SVG/JSON.

Each phase leaves the app shippable.

## Out of scope this pass

- Realtime multi-user cursors/comments (hooks left in store).
- 3D / isometric view.
- Native mobile app.

Ready to start with **Phase A (shell + refactor + object catalog)** on approval.
